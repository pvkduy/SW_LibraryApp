-- =============================================================================
-- ShelfHelp — 0013_admin_audit_fixes_and_uc_completion.sql
--
-- Fixes bugs identified in admin audit and completes UC-20, UC-21, UC-28,
-- UC-29, UC-30, and FR-CIRC-05:
--   1. Schema additions: notifications, reservation_strike_events,
--      loan_items.last_reminded_at / handover_by / returned_by,
--      profiles.reservation_strikes, reservations.cancelled_at
--   2. Books/Inventory RPC fixes:
--      - rpc_save_book: allow clearing cover_path when key is present
--      - rpc_change_copy_status: release reservation hold when held copy becomes
--        damaged/under_repair (EC-12), generate pickup_code + sync queue on
--        promotion, fix Path A waived loss_fee deduction
--   3. Circulation RPC fixes & UC-20/UC-21/FR-CIRC-05 completion:
--      - Row locking (FOR UPDATE) across handover, return, counter payment,
--        reservation cancellation (EC-03 / EC-19)
--      - Set inventory actor context so inventory_transactions records librarian
--      - Handover: Asia/Ho_Chi_Minh 23:59:59 due_at & due_date, barcode check,
--        counter fee collection for awaiting_payment items (UC-20 §2.2.4),
--        borrow_count increment, loan_requests/reservations sync, notification
--      - Return: reconcile existing paid/unpaid overdue_fine charges with cap at
--        replacement_price (no double-charging!), custom/tier damage fees,
--        explicit next copy status even when replacement_price is null,
--        immediate counter settlement (settle_now) with typed receipts & change,
--        Path A lost recovery (UC-21 §2.2.4), FIFO promotion with pickup_code
--      - Counter settlement: typed receipt, created_by_id, unlock restricted
--        student accounts when debt clears
--      - Mark loan lost (FR-CIRC-05)
--   4. Queues & Reminders RPCs (UC-29 & UC-30):
--      - rpc_cancel_reservation_staff: cancelled_at, notification, pickup_code
--        on promotion, queue_position & queue_length sync
--      - rpc_send_loan_reminders_for_admin: single + bulk 24h cooldown dispatch
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Schema additions
-- -----------------------------------------------------------------------------
alter table public.loan_items
  add column if not exists last_reminded_at timestamptz,
  add column if not exists handover_by uuid references public.profiles(id) on delete set null,
  add column if not exists returned_by uuid references public.profiles(id) on delete set null;

alter table public.profiles
  add column if not exists reservation_strikes integer not null default 0
    check (reservation_strikes >= 0);

alter table public.reservations
  add column if not exists cancelled_at timestamptz;

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  uid        uuid not null references public.profiles(id) on delete cascade,
  type       text not null default 'general'
               check (type in (
                 'handover', 'return', 'reminder',
                 'reservation_ready', 'reservation_cancelled',
                 'lost', 'general'
               )),
  title      text not null,
  body       text not null,
  ref_type   text,
  ref_id     uuid,
  dedupe_key text,
  read_at    timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default app_now()
);

create index if not exists notifications_uid_created_idx
  on public.notifications (uid, created_at desc);
create index if not exists notifications_uid_unread_idx
  on public.notifications (uid, created_at desc) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own_or_admin on public.notifications;
create policy notifications_select_own_or_admin on public.notifications
  for select to authenticated
  using (uid = auth.uid() or public.is_admin());

drop policy if exists notifications_update_own_read on public.notifications;
create policy notifications_update_own_read on public.notifications
  for update to authenticated
  using (uid = auth.uid())
  with check (uid = auth.uid());

revoke update on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create table if not exists public.reservation_strike_events (
  id             uuid primary key default gen_random_uuid(),
  uid            uuid not null references public.profiles(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  reason         text not null default 'Pickup hold expired (48h)',
  occurred_at    timestamptz not null default app_now()
);

create index if not exists reservation_strike_events_uid_idx
  on public.reservation_strike_events (uid, occurred_at desc);

alter table public.reservation_strike_events enable row level security;

drop policy if exists reservation_strike_events_select on public.reservation_strike_events;
create policy reservation_strike_events_select on public.reservation_strike_events
  for select to authenticated
  using (uid = auth.uid() or public.is_admin());

grant select on public.reservation_strike_events to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Shared helpers for pickup code & queue normalization
-- -----------------------------------------------------------------------------
create or replace function public.next_pickup_code()
returns text
language sql
volatile
as $$
  select 'RES-' || upper(substring(gen_random_uuid()::text, 1, 6))
$$;

create or replace function public.sync_book_queue_state(p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with ranked as (
    select id, row_number() over (order by created_at asc, id asc) as rn
    from public.reservations
    where book_id = p_book_id
      and status = 'waiting'
  )
  update public.reservations r
  set queue_position = ranked.rn
  from ranked
  where r.id = ranked.id
    and r.queue_position is distinct from ranked.rn;

  update public.reservations
  set queue_position = null
  where book_id = p_book_id
    and status <> 'waiting'
    and queue_position is not null;

  update public.books
  set queue_length = (
    select count(*)
    from public.reservations
    where book_id = p_book_id
      and status in ('waiting', 'ready_for_pickup')
  )
  where id = p_book_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Fix rpc_save_book: allow clearing cover_path when key is present
-- -----------------------------------------------------------------------------
create or replace function public.rpc_save_book(
  p_actor_id uuid,
  p_book jsonb,
  p_copies jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_book public.books%rowtype;
  v_id uuid;
  v_existing uuid;
  v_status text;
  v_collection text;
  v_copy jsonb;
  v_barcode text;
  v_condition text;
  v_shelf text;
  v_source text;
  v_copies jsonb;
  v_title text;
  v_authors text[];
  v_keywords text[];
begin
  v_actor := public.inventory_require_admin(p_actor_id);

  v_title := btrim(coalesce(p_book->>'title', ''));
  if v_title = '' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Title is required');
  end if;

  v_authors := array(
    select jsonb_array_elements_text(coalesce(p_book->'authors', '[]'::jsonb))
  );
  v_keywords := array(
    select jsonb_array_elements_text(coalesce(p_book->'keywords', '[]'::jsonb))
  );

  v_status := coalesce(nullif(p_book->>'status', ''), 'active');
  if v_status not in ('active', 'draft') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Book status must be active or draft');
  end if;

  v_collection := coalesce(nullif(p_book->>'collection', ''), 'standard');
  if v_collection not in ('standard', 'premium') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Collection must be standard or premium');
  end if;

  v_id := nullif(p_book->>'id', '')::uuid;

  if nullif(p_book->>'isbn13', '') is not null then
    select id into v_existing
    from public.books
    where isbn13 = nullif(p_book->>'isbn13', '')
      and (v_id is null or id <> v_id)
    limit 1;

    if v_existing is not null then
      return jsonb_build_object(
        'success', false,
        'reason', 'DUPLICATE',
        'message', 'This ISBN is already registered in the catalog.',
        'existing_book_id', v_existing
      );
    end if;
  end if;

  if v_id is null then
    insert into public.books (
      title, authors, isbn10, isbn13, publisher, year, language, category, field,
      description, toc, keywords, collection, replacement_price, shelf_location,
      cover_path, status
    ) values (
      v_title,
      v_authors,
      nullif(p_book->>'isbn10', ''),
      nullif(p_book->>'isbn13', ''),
      nullif(p_book->>'publisher', ''),
      nullif(p_book->>'year', '')::integer,
      nullif(p_book->>'language', ''),
      nullif(p_book->>'category', ''),
      nullif(p_book->>'field', ''),
      nullif(p_book->>'description', ''),
      nullif(p_book->>'toc', ''),
      v_keywords,
      v_collection,
      nullif(p_book->>'replacement_price', '')::integer,
      nullif(p_book->>'shelf_location', ''),
      nullif(p_book->>'cover_path', ''),
      v_status
    )
    returning * into v_book;
  else
    select * into v_book from public.books where id = v_id for update;
    if not found then
      return jsonb_build_object('success', false, 'reason', 'NOT_FOUND',
                                'message', 'Book not found');
    end if;

    update public.books
    set title = v_title,
        authors = case when p_book ? 'authors' then v_authors else authors end,
        isbn10 = nullif(p_book->>'isbn10', ''),
        isbn13 = nullif(p_book->>'isbn13', ''),
        publisher = nullif(p_book->>'publisher', ''),
        year = nullif(p_book->>'year', '')::integer,
        language = nullif(p_book->>'language', ''),
        category = nullif(p_book->>'category', ''),
        field = nullif(p_book->>'field', ''),
        description = nullif(p_book->>'description', ''),
        toc = nullif(p_book->>'toc', ''),
        keywords = case when p_book ? 'keywords' then v_keywords else keywords end,
        collection = v_collection,
        replacement_price = nullif(p_book->>'replacement_price', '')::integer,
        shelf_location = nullif(p_book->>'shelf_location', ''),
        cover_path = case when p_book ? 'cover_path' then nullif(p_book->>'cover_path', '') else cover_path end,
        status = v_status,
        embedding_hash = case
          when v_book.title is distinct from v_title
            or v_book.authors is distinct from case when p_book ? 'authors' then v_authors else v_book.authors end
            or v_book.description is distinct from nullif(p_book->>'description', '')
            or v_book.keywords is distinct from case when p_book ? 'keywords' then v_keywords else v_book.keywords end
            or v_book.category is distinct from nullif(p_book->>'category', '')
          then null
          else embedding_hash
        end
    where id = v_id
    returning * into v_book;
  end if;

  perform public.inventory_set_context(
    v_actor,
    'manual_addition',
    case when v_id is null then 'Initial catalog registration' else 'Copy added to existing title' end,
    'book', v_book.id
  );

  for v_copy in select * from jsonb_array_elements(coalesce(p_copies, '[]'::jsonb)) loop
    v_condition := coalesce(nullif(v_copy->>'condition', ''), 'good');
    if v_condition not in ('good', 'fair', 'poor', 'damaged') then
      v_condition := 'good';
    end if;
    v_shelf := coalesce(nullif(v_copy->>'shelf_location', ''), v_book.shelf_location);
    v_source := coalesce(nullif(v_copy->>'source_type', ''), 'manual_addition');
    v_barcode := nullif(v_copy->>'barcode', '');
    if v_barcode is null or exists (select 1 from public.copies where barcode = v_barcode) then
      v_barcode := public.next_copy_barcode(v_book.id);
    end if;

    insert into public.copies (book_id, barcode, status, shelf_location, condition, source_type)
    values (v_book.id, v_barcode, 'available', v_shelf, v_condition, v_source);
  end loop;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb)
  into v_copies
  from public.copies c
  where c.book_id = v_book.id;

  select * into v_book from public.books where id = v_book.id;

  return jsonb_build_object(
    'success', true,
    'book', to_jsonb(v_book),
    'copies', v_copies
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Fix rpc_change_copy_status: release reservation hold on EC-12, generate
--    pickup_code on promotion, exact waived loss_fee deduction
-- -----------------------------------------------------------------------------
create or replace function public.rpc_change_copy_status(
  p_actor_id uuid,
  p_copy_id uuid,
  p_target_status text,
  p_reason text,
  p_shelf_location text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_copy public.copies%rowtype;
  v_book_title text;
  v_target text;
  v_type text := 'status_change';
  v_reservation public.reservations%rowtype;
  v_held_res public.reservations%rowtype;
  v_item public.loan_items%rowtype;
  v_receipt public.receipts%rowtype;
  v_actual text;
  v_reversal_number text;
  v_pickup_code text;
  v_waived_amount integer := 0;
begin
  v_actor := public.inventory_require_admin(p_actor_id);

  if coalesce(btrim(p_reason), '') = '' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'A mandatory reason is required for a status change');
  end if;

  select * into v_copy from public.copies where id = p_copy_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND', 'message', 'Copy not found');
  end if;

  select title into v_book_title from public.books where id = v_copy.book_id;

  v_target := lower(coalesce(p_target_status, ''));
  if v_target = 'found' then
    if v_copy.status <> 'lost' then
      return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                                'message', 'Only a lost copy can be resolved with Found');
    end if;
    v_target := 'available';
    v_type := 'found';
  end if;

  if v_target in ('borrowed', 'held') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'borrowed and held are set automatically by circulation, not manually');
  end if;

  if v_target not in ('available', 'damaged', 'under_repair', 'lost') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Target status must be available, damaged, under_repair, found, or lost');
  end if;

  if v_copy.status = 'retired' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'A retired copy is terminal; add a new copy instead');
  end if;

  if v_copy.status in ('borrowed', 'overdue') and v_target = 'lost' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'An on-loan copy is marked lost through the loan Lost workflow (FR-CIRC-05)');
  end if;

  if v_copy.status = 'held' and v_target = 'lost' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Release the hold first; a held copy cannot be set lost directly');
  end if;

  if v_copy.status = v_target then
    if nullif(btrim(p_shelf_location), '') is not null
       and p_shelf_location is distinct from v_copy.shelf_location then
      update public.copies set shelf_location = btrim(p_shelf_location) where id = v_copy.id;
      return jsonb_build_object('success', true, 'copy_id', v_copy.id, 'status', v_copy.status,
                                'shelf_location', btrim(p_shelf_location),
                                'message', 'Shelf location updated');
    end if;
    return jsonb_build_object('success', true, 'copy_id', v_copy.id, 'status', v_copy.status,
                              'message', 'Status unchanged');
  end if;

  perform public.inventory_set_context(v_actor, v_type, btrim(p_reason), 'copy', v_copy.id);

  v_actual := v_target;

  if v_target = 'available' then
    select * into v_reservation
    from public.reservations
    where book_id = v_copy.book_id
      and status = 'waiting'
    order by queue_position asc nulls last, created_at asc
    limit 1
    for update;

    if found then
      v_pickup_code := public.next_pickup_code();
      update public.reservations
      set status = 'ready_for_pickup',
          copy_id = v_copy.id,
          hold_until = app_now() + interval '48 hours',
          pickup_code = v_pickup_code,
          queue_position = null,
          updated_at = app_now()
      where id = v_reservation.id;

      v_actual := 'held';
      update public.copies
      set status = 'held',
          shelf_location = coalesce(nullif(btrim(p_shelf_location), ''), shelf_location),
          held_for_type = 'reservation',
          held_for_id = v_reservation.id,
          held_until = app_now() + interval '48 hours',
          updated_at = app_now()
      where id = v_copy.id;

      perform public.sync_book_queue_state(v_copy.book_id);

      insert into public.notifications (uid, type, title, body, ref_type, ref_id, created_by)
      values (
        v_reservation.uid,
        'reservation_ready',
        'Reserved book ready for pickup',
        'Your reserved copy of "' || coalesce(v_book_title, 'Book') || '" is ready for pickup. Pickup code: ' || v_pickup_code || ' (held for 48 hours).',
        'reservation',
        v_reservation.id,
        v_actor
      );
    else
      update public.copies
      set status = 'available',
          shelf_location = coalesce(nullif(btrim(p_shelf_location), ''), shelf_location),
          held_for_type = null,
          held_for_id = null,
          held_until = null,
          updated_at = app_now()
      where id = v_copy.id;
    end if;
  else
    -- EC-12: If the copy was held for a reservation, return that reservation to waiting.
    if v_copy.status = 'held' and v_copy.held_for_type = 'reservation' then
      select * into v_held_res
      from public.reservations
      where (id = v_copy.held_for_id or copy_id = v_copy.id)
        and status = 'ready_for_pickup'
      limit 1
      for update;

      if found then
        update public.reservations
        set status = 'waiting',
            copy_id = null,
            hold_until = null,
            pickup_code = null,
            updated_at = app_now()
        where id = v_held_res.id;

        perform public.sync_book_queue_state(v_copy.book_id);

        insert into public.notifications (uid, type, title, body, ref_type, ref_id, created_by)
        values (
          v_held_res.uid,
          'reservation_cancelled',
          'Held copy withdrawn for maintenance',
          'The copy held for "' || coalesce(v_book_title, 'Book') || '" was marked ' || v_target || '. Your reservation has been returned to the front of the waitlist without penalty.',
          'reservation',
          v_held_res.id,
          v_actor
        );
      end if;
    end if;

    update public.copies
    set status = v_target,
        shelf_location = coalesce(nullif(btrim(p_shelf_location), ''), shelf_location),
        held_for_type = case when v_copy.status = 'held' then null else held_for_type end,
        held_for_id = case when v_copy.status = 'held' then null else held_for_id end,
        held_until = case when v_copy.status = 'held' then null else held_until end,
        updated_at = app_now()
    where id = v_copy.id;
  end if;

  -- Path A lost resolution: restore the loan and waive/refund the replacement fee.
  if v_copy.status = 'lost' and v_actual in ('available', 'damaged', 'held') then
    select * into v_item
    from public.loan_items
    where copy_id = v_copy.id and status = 'lost'
    order by lost_at desc nulls last
    limit 1
    for update;

    if found then
      update public.loan_items
      set status = 'returned',
          returned_at = app_now(),
          lost_resolved_at = app_now(),
          returned_by = v_actor,
          updated_at = app_now()
      where id = v_item.id;

      with waived as (
        update public.charges
        set status = 'waived', updated_at = app_now()
        where loan_item_id = v_item.id and type = 'loss_fee' and status = 'unpaid'
        returning amount
      )
      select coalesce(sum(amount), 0) into v_waived_amount from waived;

      if v_waived_amount > 0 then
        update public.profiles
        set debt_outstanding = (
              select coalesce(sum(amount), 0)
              from public.charges
              where uid = v_item.uid and status = 'unpaid'
            ),
            updated_at = app_now()
        where id = v_item.uid;
      end if;

      select * into v_receipt
      from public.receipts
      where uid = v_item.uid
        and type in ('loss', 'loss_fee')
        and amount > 0
        and created_at >= app_now() - interval '90 days'
        and (ref_id = v_item.id or ref_id in (
          select id from public.charges where loan_item_id = v_item.id and type = 'loss_fee'
        ))
      order by created_at desc
      limit 1;

      if found and not exists (
        select 1 from public.receipts where reverses_receipt_id = v_receipt.id
      ) then
        v_reversal_number := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-RV' ||
                             upper(substring(gen_random_uuid()::text, 1, 4));
        insert into public.receipts
          (number, uid, amount, method, type, ref_type, ref_id, reverses_receipt_id,
           reason_code, notes, created_by_type, created_by_id)
        values
          (v_reversal_number, v_item.uid, -v_receipt.amount, v_receipt.method, 'reversal',
           'receipt', v_receipt.id, v_receipt.id, 'lost_returned',
           'Reversal: lost copy returned within 90 days', 'admin', v_actor);
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'copy_id', v_copy.id,
    'status', v_actual,
    'previous_status', v_copy.status,
    'transaction_type', v_type
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Fix & complete rpc_confirm_handover_for_admin (UC-20)
-- -----------------------------------------------------------------------------
drop function if exists public.rpc_confirm_handover_for_admin(uuid, uuid, text, text, text[]);

create or replace function public.rpc_confirm_handover_for_admin(
  p_admin_id uuid,
  p_loan_item_id uuid,
  p_condition_out text default 'good',
  p_notes text default null,
  p_condition_out_media text[] default '{}',
  p_expected_barcode text default null,
  p_collect_counter_fee boolean default false,
  p_amount_collected integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_copy record;
  v_book record;
  v_profile record;
  v_due_date timestamptz;
  v_receipt_number text;
  v_change integer := 0;
  v_fee_charge_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_admin_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;

  perform set_config('request.jwt.claim.sub', p_admin_id::text, true);

  -- 1. Lock item row (EC-03 / EC-19)
  select * into v_item
  from public.loan_items
  where id = p_loan_item_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND', 'error', 'Loan item not found');
  end if;

  if v_item.copy_id is not null then
    select * into v_copy from public.copies where id = v_item.copy_id for update;
  end if;
  select * into v_book from public.books where id = v_item.book_id;

  -- UC-20 §2.2.3: Optional scanned physical barcode verification
  if nullif(btrim(coalesce(p_expected_barcode, '')), '') is not null then
    if v_copy.barcode is null or lower(btrim(p_expected_barcode)) <> lower(v_copy.barcode) then
      return jsonb_build_object(
        'success', false,
        'reason', 'VALIDATION_FAILED',
        'error', 'Scanned copy ' || btrim(p_expected_barcode) || ' does not match staged copy ' || coalesce(v_copy.barcode, 'N/A') || ' for this title.'
      );
    end if;
  end if;

  -- 2. Validate standing & status
  select * into v_profile from public.profiles where id = v_item.uid for update;
  if v_profile.status <> 'active' then
    return jsonb_build_object('success', false, 'reason', 'ACCOUNT_NOT_ACTIVE',
                              'error', 'Student account is not active (' || v_profile.status || ')');
  end if;

  if v_profile.debt_outstanding > 0 then
    return jsonb_build_object('success', false, 'reason', 'DEBT_HOLD',
                              'error', 'Outstanding debt: ' || v_profile.debt_outstanding || ' VND. Settle outstanding charges first.');
  end if;

  if v_item.pickup_deadline is not null and v_item.pickup_deadline < app_now() then
    return jsonb_build_object('success', false, 'reason', 'DEADLINE_PASSED',
                              'error', 'Pickup deadline passed. Request has expired.');
  end if;

  -- UC-20 §2.2.4: Counter fee settlement for awaiting_payment items
  if v_item.status = 'awaiting_payment' then
    if not p_collect_counter_fee then
      return jsonb_build_object('success', false, 'reason', 'STATUS_CHANGED',
                                'error', 'Item is awaiting counter payment (' || v_item.fee || ' VND). Collect fee to hand over.');
    end if;
    if p_amount_collected < v_item.fee then
      return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                                'error', 'Collected amount (' || p_amount_collected || ' VND) is less than required fee (' || v_item.fee || ' VND).');
    end if;

    v_change := p_amount_collected - v_item.fee;

    if v_item.fee > 0 then
      select id into v_fee_charge_id
      from public.charges
      where loan_item_id = v_item.id and type = 'borrow_fee' and status = 'unpaid'
      limit 1
      for update;

      if v_fee_charge_id is not null then
        update public.charges
        set status = 'paid', paid_at = app_now(), updated_at = app_now()
        where id = v_fee_charge_id;
      else
        insert into public.charges (uid, type, loan_item_id, amount, status, paid_at, notes, created_at, updated_at)
        values (v_item.uid, 'borrow_fee', v_item.id, v_item.fee, 'paid', app_now(), 'Counter premium checkout fee', app_now(), app_now())
        returning id into v_fee_charge_id;
      end if;

      v_receipt_number := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
      insert into public.receipts (
        number, uid, amount, method, type, ref_type, ref_id, charge_id, notes, created_by_type, created_by_id
      ) values (
        v_receipt_number, v_item.uid, v_item.fee, 'cash', 'borrow_fee', 'loan_item', v_item.id, v_fee_charge_id,
        'Counter checkout fee settled at handover', 'admin', p_admin_id
      );
    end if;
  elsif v_item.status <> 'ready_for_pickup' then
    return jsonb_build_object('success', false, 'reason', 'STATUS_CHANGED',
                              'error', 'Item is not ready for pickup (status: ' || v_item.status || ')');
  end if;

  if p_condition_out is null or p_condition_out not in ('good', 'fair', 'poor', 'damaged') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'error', 'Outgoing condition must be good, fair, poor, or damaged.');
  end if;

  -- 3. Due date at 23:59:59 Asia/Ho_Chi_Minh (UC-20 §3.4)
  v_due_date := ((((app_now() at time zone 'Asia/Ho_Chi_Minh')::date + v_item.duration_days) + time '23:59:59') at time zone 'Asia/Ho_Chi_Minh');

  -- 4. Set inventory context so audit log records the librarian
  perform public.inventory_set_context(
    p_admin_id, 'status_change', 'Book handover at circulation desk', 'loan_item', v_item.id
  );

  -- 5. Update loan item
  update public.loan_items
  set status = 'borrowed',
      condition_out = p_condition_out,
      condition_out_media = coalesce(p_condition_out_media, '{}'),
      handover_at = app_now(),
      handover_by = p_admin_id,
      due_at = v_due_date,
      due_date = v_due_date,
      notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes),
      updated_at = app_now()
  where id = p_loan_item_id;

  -- 6. Update physical copy
  if v_item.copy_id is not null then
    update public.copies
    set status = 'borrowed',
        condition = p_condition_out,
        held_for_type = null,
        held_for_id = null,
        held_until = null,
        updated_at = app_now()
    where id = v_item.copy_id;
  end if;

  -- 7. Update counters & parent request / reservation
  update public.books
  set borrow_count = borrow_count + 1,
      updated_at = app_now()
  where id = v_item.book_id;

  update public.profiles
  set active_items = active_items + 1,
      updated_at = app_now()
  where id = v_item.uid;

  if v_item.request_id is not null then
    if not exists (
      select 1 from public.loan_items
      where request_id = v_item.request_id
        and status in ('ready_for_pickup', 'awaiting_payment')
    ) then
      update public.loan_requests
      set status = 'completed', updated_at = app_now()
      where id = v_item.request_id and status = 'pending';
    end if;
  end if;

  if v_item.source = 'reservation' then
    update public.reservations
    set status = 'fulfilled', updated_at = app_now()
    where uid = v_item.uid
      and book_id = v_item.book_id
      and status = 'ready_for_pickup'
      and (copy_id = v_item.copy_id or copy_id is null);
    perform public.sync_book_queue_state(v_item.book_id);
  end if;

  -- 8. Dispatch handover notification (UC-20 step 11)
  insert into public.notifications (uid, type, title, body, ref_type, ref_id, created_by)
  values (
    v_item.uid,
    'handover',
    'Loan confirmed: ' || coalesce(v_book.title, 'Book'),
    'Handover confirmed for "' || coalesce(v_book.title, 'Book') || '" (' || coalesce(v_copy.barcode, 'copy') || '). Due on ' || to_char(v_due_date at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI') || '.',
    'loan_item',
    v_item.id,
    p_admin_id
  );

  return jsonb_build_object(
    'success', true,
    'loan_item_id', p_loan_item_id,
    'status', 'borrowed',
    'due_at', v_due_date,
    'receipt_number', v_receipt_number,
    'change', v_change
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Fix & complete rpc_process_return_with_evidence_for_admin (UC-21)
-- -----------------------------------------------------------------------------
drop function if exists public.rpc_process_return_with_evidence_for_admin(
  uuid, text, text, integer, boolean, integer, text, text[]
);

create or replace function public.rpc_process_return_with_evidence_for_admin(
  p_admin_id uuid,
  p_copy_barcode text,
  p_condition_in text default 'good',
  p_damage_tier integer default 0,
  p_settle_now boolean default false,
  p_amount_collected integer default 0,
  p_condition_in_notes text default null,
  p_condition_in_media text[] default '{}',
  p_next_copy_status text default null,
  p_custom_damage_amount integer default null,
  p_allow_lost_recovery boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_copy record;
  v_book record;
  v_item record;
  v_overdue_days integer := 0;
  v_cap integer;
  v_computed_fine integer := 0;
  v_existing_paid_fine integer := 0;
  v_existing_unpaid_fine integer := 0;
  v_incremental_fine integer := 0;
  v_unpaid_fine_total integer := 0;
  v_damage_amount integer := 0;
  v_total_due_now integer := 0;
  v_fine_charge_id uuid;
  v_damage_charge_id uuid;
  v_receipt_number text;
  v_receipt_numbers text[] := '{}';
  v_change integer := 0;
  v_next_reservation record;
  v_target_copy_status text := 'available';
  v_pickup_code text;
  v_remaining_debt integer := 0;
  v_has_other_lost boolean := false;
  v_is_lost_recovery boolean := false;
  v_waived_loss integer := 0;
  v_loss_receipt record;
  v_reversal_number text;
  v_chg record;
  v_effective_due timestamptz;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_admin_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;

  perform set_config('request.jwt.claim.sub', p_admin_id::text, true);

  if p_condition_in is null or p_condition_in not in ('good', 'fair', 'poor', 'damaged') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'error', 'Incoming condition must be good, fair, poor, or damaged.');
  end if;

  -- 1. Lock copy row
  select * into v_copy from public.copies where barcode = p_copy_barcode for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND',
                              'error', 'No copy found with barcode ' || p_copy_barcode);
  end if;

  -- 2. Lock active (or lost if recovery enabled) loan item
  select * into v_item
  from public.loan_items
  where copy_id = v_copy.id
    and (
      status in ('borrowed', 'overdue')
      or (p_allow_lost_recovery and status = 'lost')
    )
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'NOT_AVAILABLE',
                              'error', 'Copy ' || p_copy_barcode || ' is currently marked as ' || v_copy.status || '. No active borrowed loan found.');
  end if;

  v_is_lost_recovery := (v_item.status = 'lost');
  select * into v_book from public.books where id = v_item.book_id;
  v_effective_due := coalesce(v_item.due_at, v_item.due_date);

  -- 3. Reconciled & capped overdue fine calculation (UC-21 §2.2.1 & §3.2)
  if v_effective_due is not null and app_now() > v_effective_due then
    if v_is_lost_recovery and v_item.lost_at is not null then
      v_overdue_days := greatest(
        0,
        ((v_item.lost_at at time zone 'Asia/Ho_Chi_Minh')::date - (v_effective_due at time zone 'Asia/Ho_Chi_Minh')::date)
      );
    else
      v_overdue_days := greatest(
        1,
        ((app_now() at time zone 'Asia/Ho_Chi_Minh')::date - (v_effective_due at time zone 'Asia/Ho_Chi_Minh')::date)
      );
    end if;
    v_computed_fine := v_overdue_days * 5000;
    v_cap := nullif(coalesce(v_book.replacement_price, 0), 0);
    if v_cap is not null then
      v_computed_fine := least(v_computed_fine, v_cap);
    end if;
  end if;

  select
    coalesce(sum(amount) filter (where status = 'paid'), 0),
    coalesce(sum(amount) filter (where status = 'unpaid'), 0)
  into v_existing_paid_fine, v_existing_unpaid_fine
  from public.charges
  where loan_item_id = v_item.id
    and type = 'overdue_fine';

  v_incremental_fine := greatest(0, v_computed_fine - v_existing_paid_fine - v_existing_unpaid_fine);
  v_unpaid_fine_total := v_existing_unpaid_fine + v_incremental_fine;

  -- 4. Damage fee calculation (tier or custom capped at replacement_price)
  if p_custom_damage_amount is not null and p_custom_damage_amount > 0 then
    v_damage_amount := p_custom_damage_amount;
    v_cap := nullif(coalesce(v_book.replacement_price, 0), 0);
    if v_cap is not null then
      v_damage_amount := least(v_damage_amount, v_cap);
    end if;
  elsif coalesce(p_damage_tier, 0) > 0 and coalesce(v_book.replacement_price, 0) > 0 then
    v_damage_amount := round((v_book.replacement_price * p_damage_tier)::numeric / 100)::integer;
  end if;

  -- Determine target copy status (independent of replacement_price!)
  if p_next_copy_status in ('available', 'damaged', 'under_repair') then
    v_target_copy_status := p_next_copy_status;
    if p_condition_in = 'damaged' and v_target_copy_status = 'available' then
      v_target_copy_status := 'damaged';
    end if;
  elsif p_condition_in = 'damaged' or coalesce(p_damage_tier, 0) >= 30 then
    v_target_copy_status := 'damaged';
  else
    v_target_copy_status := 'available';
  end if;

  v_total_due_now := v_unpaid_fine_total + v_damage_amount;

  if p_settle_now and v_total_due_now > 0 and p_amount_collected < v_total_due_now then
    return jsonb_build_object(
      'success', false,
      'reason', 'VALIDATION_FAILED',
      'error', 'Collected amount (' || p_amount_collected || ' VND) is less than total charges due (' || v_total_due_now || ' VND).'
    );
  end if;

  -- 5. Path A Lost Recovery: waive unpaid loss_fee or reverse paid loss_fee within 90d
  if v_is_lost_recovery then
    with waived as (
      update public.charges
      set status = 'waived', updated_at = app_now()
      where loan_item_id = v_item.id and type = 'loss_fee' and status = 'unpaid'
      returning amount
    )
    select coalesce(sum(amount), 0) into v_waived_loss from waived;

    select * into v_loss_receipt
    from public.receipts
    where uid = v_item.uid
      and type in ('loss', 'loss_fee')
      and amount > 0
      and created_at >= app_now() - interval '90 days'
      and (ref_id = v_item.id or ref_id in (
        select id from public.charges where loan_item_id = v_item.id and type = 'loss_fee'
      ))
    order by created_at desc
    limit 1;

    if found and not exists (
      select 1 from public.receipts where reverses_receipt_id = v_loss_receipt.id
    ) then
      v_reversal_number := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-RV' ||
                           upper(substring(gen_random_uuid()::text, 1, 4));
      insert into public.receipts (
        number, uid, amount, method, type, ref_type, ref_id, reverses_receipt_id,
        reason_code, notes, created_by_type, created_by_id
      ) values (
        v_reversal_number, v_item.uid, -v_loss_receipt.amount, v_loss_receipt.method, 'reversal',
        'receipt', v_loss_receipt.id, v_loss_receipt.id, 'lost_returned',
        'Reversal: lost copy returned within 90 days', 'admin', p_admin_id
      );
    end if;
  end if;

  -- 6. Create incremental fine & damage charges
  if v_incremental_fine > 0 then
    insert into public.charges (
      uid, type, loan_item_id, amount, status, rate, paid_at, notes, created_at, updated_at
    ) values (
      v_item.uid, 'overdue_fine', v_item.id, v_incremental_fine,
      case when p_settle_now then 'paid' else 'unpaid' end,
      5000,
      case when p_settle_now then app_now() else null end,
      'Overdue fine (' || v_overdue_days || ' day(s))',
      app_now(), app_now()
    )
    returning id into v_fine_charge_id;
  end if;

  if v_damage_amount > 0 then
    insert into public.charges (
      uid, type, loan_item_id, amount, status, paid_at, notes, created_at, updated_at
    ) values (
      v_item.uid, 'damage_fee', v_item.id, v_damage_amount,
      case when p_settle_now then 'paid' else 'unpaid' end,
      case when p_settle_now then app_now() else null end,
      case
        when p_custom_damage_amount is not null and p_custom_damage_amount > 0
          then 'Custom damage assessment: ' || coalesce(nullif(btrim(coalesce(p_condition_in_notes, '')), ''), 'Damaged return')
        else 'Damage assessment tier: ' || p_damage_tier || '%'
      end,
      app_now(), app_now()
    )
    returning id into v_damage_charge_id;
  end if;

  -- 7. Immediate counter settlement (UC-21 §2.2.5)
  if p_settle_now and v_total_due_now > 0 then
    v_change := p_amount_collected - v_total_due_now;

    -- Settle any pre-existing unpaid overdue fines for this loan
    for v_chg in
      select id, amount, type from public.charges
      where loan_item_id = v_item.id and type = 'overdue_fine' and status = 'unpaid'
      for update
    loop
      update public.charges
      set status = 'paid', paid_at = app_now(), updated_at = app_now()
      where id = v_chg.id;

      v_receipt_number := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
      insert into public.receipts (
        number, uid, amount, method, type, ref_type, ref_id, charge_id, notes, created_by_type, created_by_id
      ) values (
        v_receipt_number, v_item.uid, v_chg.amount, 'cash', 'overdue_fine', 'charge', v_chg.id, v_chg.id,
        'Counter return settlement (overdue fine)', 'admin', p_admin_id
      );
      v_receipt_numbers := array_append(v_receipt_numbers, v_receipt_number);
    end loop;

    if v_fine_charge_id is not null then
      v_receipt_number := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
      insert into public.receipts (
        number, uid, amount, method, type, ref_type, ref_id, charge_id, notes, created_by_type, created_by_id
      ) values (
        v_receipt_number, v_item.uid, v_incremental_fine, 'cash', 'overdue_fine', 'charge', v_fine_charge_id, v_fine_charge_id,
        'Counter return settlement (overdue fine)', 'admin', p_admin_id
      );
      v_receipt_numbers := array_append(v_receipt_numbers, v_receipt_number);
    end if;

    if v_damage_charge_id is not null then
      v_receipt_number := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
      insert into public.receipts (
        number, uid, amount, method, type, ref_type, ref_id, charge_id, notes, created_by_type, created_by_id
      ) values (
        v_receipt_number, v_item.uid, v_damage_amount, 'cash', 'damage_fee', 'charge', v_damage_charge_id, v_damage_charge_id,
        'Counter return settlement (damage fee)', 'admin', p_admin_id
      );
      v_receipt_numbers := array_append(v_receipt_numbers, v_receipt_number);
    end if;
  end if;

  -- 8. Update loan_item status to returned
  update public.loan_items
  set status = 'returned',
      condition_in = p_condition_in,
      condition_in_notes = p_condition_in_notes,
      condition_in_media = coalesce(p_condition_in_media, '{}'),
      returned_at = app_now(),
      returned_by = p_admin_id,
      lost_resolved_at = case when v_is_lost_recovery then app_now() else lost_resolved_at end,
      updated_at = app_now()
  where id = v_item.id;

  -- 9. Set inventory actor context & update copy status + FIFO promotion
  perform public.inventory_set_context(
    p_admin_id,
    case when v_is_lost_recovery then 'found' else 'status_change' end,
    case
      when v_is_lost_recovery then 'Lost copy recovered and returned at counter'
      when v_target_copy_status = 'available' then 'Book return check-in'
      else 'Book returned with status ' || v_target_copy_status
    end,
    'loan_item',
    v_item.id
  );

  if v_target_copy_status = 'available' then
    select * into v_next_reservation
    from public.reservations
    where book_id = v_item.book_id
      and status = 'waiting'
    order by queue_position asc nulls last, created_at asc
    limit 1
    for update;

    if found then
      v_pickup_code := public.next_pickup_code();
      update public.reservations
      set status = 'ready_for_pickup',
          copy_id = v_copy.id,
          hold_until = app_now() + interval '48 hours',
          pickup_code = v_pickup_code,
          queue_position = null,
          updated_at = app_now()
      where id = v_next_reservation.id;

      update public.copies
      set status = 'held',
          condition = p_condition_in,
          held_for_type = 'reservation',
          held_for_id = v_next_reservation.id,
          held_until = app_now() + interval '48 hours',
          updated_at = app_now()
      where id = v_copy.id;

      perform public.sync_book_queue_state(v_item.book_id);

      insert into public.notifications (uid, type, title, body, ref_type, ref_id, created_by)
      values (
        v_next_reservation.uid,
        'reservation_ready',
        'Reserved book ready for pickup',
        'Your reserved book "' || coalesce(v_book.title, 'Book') || '" is ready for pickup. Pickup code: ' || v_pickup_code || ' (48-hour hold).',
        'reservation',
        v_next_reservation.id,
        p_admin_id
      );

      v_target_copy_status := 'held (promoted to reservation)';
    else
      update public.copies
      set status = 'available',
          condition = p_condition_in,
          held_for_type = null,
          held_for_id = null,
          held_until = null,
          updated_at = app_now()
      where id = v_copy.id;
    end if;
  else
    update public.copies
    set status = v_target_copy_status,
        condition = p_condition_in,
        held_for_type = null,
        held_for_id = null,
        held_until = null,
        updated_at = app_now()
    where id = v_copy.id;
  end if;

  -- 10. Reconcile student debt, active_items, and account status
  select coalesce(sum(amount), 0) into v_remaining_debt
  from public.charges
  where uid = v_item.uid and status = 'unpaid';

  select exists (
    select 1 from public.loan_items where uid = v_item.uid and status = 'lost'
  ) into v_has_other_lost;

  update public.profiles
  set active_items = case when v_is_lost_recovery then active_items else greatest(0, active_items - 1) end,
      debt_outstanding = v_remaining_debt,
      status = case
        when v_remaining_debt = 0 and not v_has_other_lost and status = 'restricted' then 'active'
        else status
      end,
      updated_at = app_now()
  where id = v_item.uid;

  -- 11. Notify student of completed return + review invitation (UC-21 §6.3)
  insert into public.notifications (uid, type, title, body, ref_type, ref_id, created_by)
  values (
    v_item.uid,
    'return',
    'Book returned: ' || coalesce(v_book.title, 'Book'),
    'Your return of "' || coalesce(v_book.title, 'Book') || '" (' || v_copy.barcode || ') has been processed. You can now rate and review this title in My Loans.',
    'loan_item',
    v_item.id,
    p_admin_id
  );

  return jsonb_build_object(
    'success', true,
    'loan_item_id', v_item.id,
    'overdue_days', v_overdue_days,
    'fine_amount', v_unpaid_fine_total,
    'incremental_fine', v_incremental_fine,
    'damage_amount', v_damage_amount,
    'total_fee', v_total_due_now,
    'copy_status', v_target_copy_status,
    'settled', p_settle_now and v_total_due_now > 0,
    'change', v_change,
    'receipt_number', v_receipt_numbers[1],
    'receipt_numbers', v_receipt_numbers,
    'lost_recovery', v_is_lost_recovery,
    'waived_loss_fee', v_waived_loss,
    'reversal_receipt', v_reversal_number
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Fix rpc_settle_counter_charge: row lock, typed receipt, created_by_id,
--    accurate debt reconciliation + restricted unlock
-- -----------------------------------------------------------------------------
create or replace function public.rpc_settle_counter_charge(
  p_charge_id uuid,
  p_amount_collected integer,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge record;
  v_receipt_number text;
  v_change integer := 0;
  v_remaining_debt integer := 0;
  v_has_lost boolean := false;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  ) then
    return jsonb_build_object('success', false, 'error', 'FORBIDDEN_ROLE');
  end if;

  select * into v_charge from public.charges where id = p_charge_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Charge record not found');
  end if;

  if v_charge.status = 'paid' then
    return jsonb_build_object('success', false, 'error', 'Charge is already paid');
  end if;

  if p_amount_collected < v_charge.amount then
    return jsonb_build_object('success', false, 'error', 'Amount collected (' || p_amount_collected || ') is less than charge (' || v_charge.amount || ')');
  end if;

  v_change := p_amount_collected - v_charge.amount;

  update public.charges
  set status = 'paid',
      paid_at = app_now(),
      notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes),
      updated_at = app_now()
  where id = p_charge_id;

  select coalesce(sum(amount), 0) into v_remaining_debt
  from public.charges
  where uid = v_charge.uid and status = 'unpaid';

  select exists (
    select 1 from public.loan_items where uid = v_charge.uid and status = 'lost'
  ) into v_has_lost;

  update public.profiles
  set debt_outstanding = v_remaining_debt,
      status = case
        when v_remaining_debt = 0 and not v_has_lost and status = 'restricted' then 'active'
        else status
      end,
      updated_at = app_now()
  where id = v_charge.uid;

  v_receipt_number := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
  insert into public.receipts (
    number, uid, amount, method, type, ref_type, ref_id, charge_id, notes, created_by_type, created_by_id
  ) values (
    v_receipt_number, v_charge.uid, v_charge.amount, 'cash', v_charge.type, 'charge', p_charge_id, p_charge_id,
    p_notes, 'admin', auth.uid()
  );

  return jsonb_build_object(
    'success', true,
    'charge_id', p_charge_id,
    'amount_paid', v_charge.amount,
    'amount_collected', p_amount_collected,
    'change', v_change,
    'remaining_debt', v_remaining_debt,
    'receipt_number', v_receipt_number
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. NEW RPC: rpc_mark_loan_lost_for_admin (FR-CIRC-05)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_mark_loan_lost_for_admin(
  p_admin_id uuid,
  p_loan_item_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_copy record;
  v_book record;
  v_loss_fee integer := 0;
  v_charge_id uuid;
  v_remaining_debt integer := 0;
  v_non_circulating boolean := false;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_admin_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'error', 'A mandatory reason is required to mark a loan as lost.');
  end if;

  perform set_config('request.jwt.claim.sub', p_admin_id::text, true);

  select * into v_item from public.loan_items where id = p_loan_item_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND', 'error', 'Loan item not found.');
  end if;

  if v_item.status not in ('borrowed', 'overdue') then
    return jsonb_build_object('success', false, 'reason', 'STATUS_CHANGED',
                              'error', 'Only an active or overdue loan can be marked lost (current: ' || v_item.status || ').');
  end if;

  if v_item.copy_id is not null then
    select * into v_copy from public.copies where id = v_item.copy_id for update;
  end if;
  select * into v_book from public.books where id = v_item.book_id;

  v_loss_fee := coalesce(v_book.replacement_price, 0);

  perform public.inventory_set_context(
    p_admin_id, 'lost', btrim(p_reason), 'loan_item', v_item.id
  );

  update public.loan_items
  set status = 'lost',
      lost_at = app_now(),
      notes = coalesce(nullif(notes, '') || E'\n', '') || 'Marked lost: ' || btrim(p_reason),
      updated_at = app_now()
  where id = v_item.id;

  if v_item.copy_id is not null then
    update public.copies
    set status = 'lost',
        held_for_type = null,
        held_for_id = null,
        held_until = null,
        updated_at = app_now()
    where id = v_item.copy_id;
  end if;

  if v_loss_fee > 0 then
    insert into public.charges (uid, type, loan_item_id, amount, status, notes, created_at, updated_at)
    values (
      v_item.uid, 'loss_fee', v_item.id, v_loss_fee, 'unpaid',
      'Replacement fee for lost copy (' || coalesce(v_copy.barcode, 'N/A') || '): ' || btrim(p_reason),
      app_now(), app_now()
    )
    returning id into v_charge_id;
  end if;

  select coalesce(sum(amount), 0) into v_remaining_debt
  from public.charges
  where uid = v_item.uid and status = 'unpaid';

  update public.profiles
  set status = 'restricted',
      debt_outstanding = v_remaining_debt,
      active_items = greatest(0, active_items - 1),
      updated_at = app_now()
  where id = v_item.uid;

  -- POL-07: cancel waiting reservations if no circulating copy remains
  select not exists (
    select 1 from public.copies
    where book_id = v_item.book_id and status not in ('retired', 'lost')
  ) into v_non_circulating;

  if v_non_circulating then
    update public.reservations
    set status = 'cancelled',
        cancellation_reason = 'book_not_circulating',
        cancelled_at = app_now(),
        outcome = 'cancelled_book_not_circulating',
        updated_at = app_now()
    where book_id = v_item.book_id and status = 'waiting';
    perform public.sync_book_queue_state(v_item.book_id);
  end if;

  insert into public.notifications (uid, type, title, body, ref_type, ref_id, created_by)
  values (
    v_item.uid,
    'lost',
    'Loan marked as lost: ' || coalesce(v_book.title, 'Book'),
    'Your loan for "' || coalesce(v_book.title, 'Book') || '" (' || coalesce(v_copy.barcode, 'copy') || ') was marked lost. Replacement charge: ' || v_loss_fee || ' VND. Account status is now restricted.',
    'loan_item',
    v_item.id,
    p_admin_id
  );

  return jsonb_build_object(
    'success', true,
    'loan_item_id', v_item.id,
    'status', 'lost',
    'loss_fee', v_loss_fee,
    'charge_id', v_charge_id,
    'student_status', 'restricted'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Fix rpc_cancel_reservation_staff (UC-29): lock, cancelled_at, pickup_code
--    on promotion, queue_position/queue_length sync, notifications
-- -----------------------------------------------------------------------------
create or replace function public.rpc_cancel_reservation_staff(
  p_reservation_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
  v_next record;
  v_book_title text;
  v_pickup_code text;
  v_promoted_id uuid := null;
begin
  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if auth.uid() is null or (
    auth.uid() <> v_res.uid and not exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and status = 'active'
    )
  ) then
    return jsonb_build_object('success', false, 'error', 'FORBIDDEN_ROLE');
  end if;

  if v_res.status in ('fulfilled', 'cancelled', 'expired') then
    return jsonb_build_object('success', false, 'error', 'Reservation is already ' || v_res.status);
  end if;

  select title into v_book_title from public.books where id = v_res.book_id;

  -- Cancel reservation without strike (POL-07)
  update public.reservations
  set status = 'cancelled',
      cancellation_reason = p_reason,
      cancelled_by = auth.uid(),
      cancelled_at = app_now(),
      queue_position = null,
      updated_at = app_now()
  where id = p_reservation_id;

  insert into public.notifications (uid, type, title, body, ref_type, ref_id, created_by)
  values (
    v_res.uid,
    'reservation_cancelled',
    'Reservation cancelled: ' || coalesce(v_book_title, 'Book'),
    'Your reservation for "' || coalesce(v_book_title, 'Book') || '" was cancelled. Reason: ' || coalesce(p_reason, 'Cancelled') || '. No penalty strike was added.',
    'reservation',
    v_res.id,
    auth.uid()
  );

  if v_res.status = 'ready_for_pickup' and v_res.copy_id is not null then
    select * into v_next
    from public.reservations
    where book_id = v_res.book_id
      and status = 'waiting'
    order by queue_position asc nulls last, created_at asc
    limit 1
    for update;

    if found then
      v_pickup_code := public.next_pickup_code();
      v_promoted_id := v_next.id;

      update public.reservations
      set status = 'ready_for_pickup',
          copy_id = v_res.copy_id,
          hold_until = app_now() + interval '48 hours',
          pickup_code = v_pickup_code,
          queue_position = null,
          updated_at = app_now()
      where id = v_next.id;

      update public.copies
      set status = 'held',
          held_for_type = 'reservation',
          held_for_id = v_next.id,
          held_until = app_now() + interval '48 hours',
          updated_at = app_now()
      where id = v_res.copy_id;

      insert into public.notifications (uid, type, title, body, ref_type, ref_id, created_by)
      values (
        v_next.uid,
        'reservation_ready',
        'Reserved book ready for pickup',
        'Your reserved book "' || coalesce(v_book_title, 'Book') || '" is ready for pickup. Pickup code: ' || v_pickup_code || ' (held for 48 hours).',
        'reservation',
        v_next.id,
        auth.uid()
      );
    else
      update public.copies
      set status = 'available',
          held_for_type = null,
          held_for_id = null,
          held_until = null,
          updated_at = app_now()
      where id = v_res.copy_id;
    end if;
  end if;

  perform public.sync_book_queue_state(v_res.book_id);

  return jsonb_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'status', 'cancelled',
    'promoted_reservation_id', v_promoted_id
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. NEW RPC: rpc_send_loan_reminders_for_admin (UC-30 / FR-NOTIF-04)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_send_loan_reminders_for_admin(
  p_admin_id uuid,
  p_loan_item_ids uuid[],
  p_mode text default 'bulk',
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_cutoff timestamptz := app_now() - interval '24 hours';
  v_sent_count integer := 0;
  v_skipped_count integer := 0;
  v_sent_uids uuid[] := '{}';
  v_skipped_uids uuid[] := '{}';
  v_title text;
  v_body text;
  v_due timestamptz;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_admin_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;

  if p_loan_item_ids is null or array_length(p_loan_item_ids, 1) = 0 then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'error', 'Select at least one active or overdue loan to remind.');
  end if;

  if p_mode = 'single' then
    select
      li.id, li.uid, li.status, li.due_at, li.due_date, li.last_reminded_at,
      b.title as book_title, p.full_name as student_name
    into v_row
    from public.loan_items li
    join public.books b on b.id = li.book_id
    join public.profiles p on p.id = li.uid
    where li.id = p_loan_item_ids[1]
      and li.status in ('borrowed', 'overdue')
    for update of li;

    if not found then
      return jsonb_build_object('success', false, 'reason', 'NOT_FOUND',
                                'error', 'Active or overdue loan item not found.');
    end if;

    if not p_force and v_row.last_reminded_at is not null and v_row.last_reminded_at > v_cutoff then
      return jsonb_build_object(
        'success', false,
        'reason', 'PRECONDITION_FAILED',
        'error', 'This student was already reminded within the last 24 hours.',
        'already_reminded_at', v_row.last_reminded_at,
        'student_name', v_row.student_name
      );
    end if;

    v_due := coalesce(v_row.due_at, v_row.due_date);
    if v_row.status = 'overdue' or (v_due is not null and v_due < app_now()) then
      v_title := 'Overdue Notice: ' || v_row.book_title;
      v_body := 'Overdue Notice: Your loan for "' || v_row.book_title || '" was due on ' ||
                coalesce(to_char(v_due at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY'), 'its due date') ||
                '. Fines accrue daily. Please return it promptly to avoid account restriction.';
    else
      v_title := 'Return Reminder: ' || v_row.book_title;
      v_body := 'Reminder: Your borrowed book "' || v_row.book_title || '" is due on ' ||
                coalesce(to_char(v_due at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY'), 'soon') ||
                '. Please renew or return it on time.';
    end if;

    insert into public.notifications (uid, type, title, body, ref_type, ref_id, created_by)
    values (v_row.uid, 'reminder', v_title, v_body, 'loan_item', v_row.id, p_admin_id);

    update public.loan_items
    set last_reminded_at = app_now(), updated_at = app_now()
    where id = v_row.id;

    return jsonb_build_object(
      'success', true,
      'sent_count', 1,
      'skipped_count', 0,
      'student_name', v_row.student_name
    );
  end if;

  -- Bulk mode: group by distinct student and enforce strict 24h cooldown (UC-30 §2.2.3 & §3.1)
  for v_row in
    select
      li.uid,
      max(p.full_name) as student_name,
      count(*) as item_count,
      bool_or(li.status = 'overdue' or coalesce(li.due_at, li.due_date) < app_now()) as has_overdue,
      max(li.last_reminded_at) as latest_reminded_at,
      array_agg(li.id) as loan_ids,
      string_agg(b.title, ', ' order by coalesce(li.due_at, li.due_date) asc) as titles
    from public.loan_items li
    join public.books b on b.id = li.book_id
    join public.profiles p on p.id = li.uid
    where li.id = any(p_loan_item_ids)
      and li.status in ('borrowed', 'overdue')
    group by li.uid
  loop
    if v_row.latest_reminded_at is not null and v_row.latest_reminded_at > v_cutoff then
      v_skipped_count := v_skipped_count + 1;
      v_skipped_uids := array_append(v_skipped_uids, v_row.uid);
      continue;
    end if;

    if v_row.has_overdue then
      v_title := 'Overdue Return Reminder (' || v_row.item_count || ' item' || case when v_row.item_count > 1 then 's' else '' end || ')';
      v_body := 'Overdue Notice: Please return your overdue book(s): ' || v_row.titles || ' to avoid additional daily fines and account restriction.';
    else
      v_title := 'Upcoming Return Reminder (' || v_row.item_count || ' item' || case when v_row.item_count > 1 then 's' else '' end || ')';
      v_body := 'Reminder: Your borrowed book(s) (' || v_row.titles || ') are approaching their due date. Please renew or return on time.';
    end if;

    insert into public.notifications (uid, type, title, body, ref_type, ref_id, created_by)
    values (v_row.uid, 'reminder', v_title, v_body, 'loan_item', v_row.loan_ids[1], p_admin_id);

    update public.loan_items
    set last_reminded_at = app_now(), updated_at = app_now()
    where id = any(v_row.loan_ids);

    v_sent_count := v_sent_count + 1;
    v_sent_uids := array_append(v_sent_uids, v_row.uid);
  end loop;

  return jsonb_build_object(
    'success', true,
    'sent_count', v_sent_count,
    'skipped_count', v_skipped_count,
    'sent_uids', v_sent_uids,
    'skipped_uids', v_skipped_uids
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Lock down execution grants to service_role only (consistent with 0012)
-- -----------------------------------------------------------------------------
revoke execute on function public.rpc_save_book(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.rpc_save_book(uuid, jsonb, jsonb) to service_role;

revoke execute on function public.rpc_change_copy_status(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.rpc_change_copy_status(uuid, uuid, text, text, text) to service_role;

revoke execute on function public.rpc_confirm_handover_for_admin(uuid, uuid, text, text, text[], text, boolean, integer) from public, anon, authenticated;
grant execute on function public.rpc_confirm_handover_for_admin(uuid, uuid, text, text, text[], text, boolean, integer) to service_role;

revoke execute on function public.rpc_process_return_with_evidence_for_admin(uuid, text, text, integer, boolean, integer, text, text[], text, integer, boolean) from public, anon, authenticated;
grant execute on function public.rpc_process_return_with_evidence_for_admin(uuid, text, text, integer, boolean, integer, text, text[], text, integer, boolean) to service_role;

revoke execute on function public.rpc_settle_counter_charge(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.rpc_settle_counter_charge(uuid, integer, text) to service_role;

revoke execute on function public.rpc_mark_loan_lost_for_admin(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_mark_loan_lost_for_admin(uuid, uuid, text) to service_role;

revoke execute on function public.rpc_cancel_reservation_staff(uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_cancel_reservation_staff(uuid, text) to service_role;

revoke execute on function public.rpc_send_loan_reminders_for_admin(uuid, uuid[], text, boolean) from public, anon, authenticated;
grant execute on function public.rpc_send_loan_reminders_for_admin(uuid, uuid[], text, boolean) to service_role;
