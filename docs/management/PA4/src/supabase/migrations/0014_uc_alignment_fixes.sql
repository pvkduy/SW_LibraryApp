-- =============================================================================
-- ShelfHelp — 0014_uc_alignment_fixes.sql
-- Aligns rpc_toggle_wishlist and rpc_checkout_cart with PA3 Use-Case specs:
--   * UC-08 §2.2.4: Block restricted/inactive accounts from wishlist changes
--   * UC-09 §2.1.1 / DEC-22: Count ready_for_pickup reservations in active quota
--   * UC-10 §2.2.2 / DEC-12: Set 48-hour payment_deadline for counter payments
--   * PL/pgSQL safety: Avoid accessing v_copy.id on unassigned record variable
-- =============================================================================

create or replace function public.rpc_toggle_wishlist(p_book_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_exists boolean;
  v_count integer;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'reason', 'UNAUTHENTICATED', 'message', 'Please sign in first.');
  end if;

  select status into v_status from public.profiles where id = v_uid;
  if v_status is distinct from 'active' then
    return jsonb_build_object(
      'success', false,
      'reason', 'ACCOUNT_RESTRICTED',
      'message', 'Your account is restricted. Wishlist and notification features are unavailable until restrictions are resolved.'
    );
  end if;

  select exists (
    select 1 from public.wishlists where uid = v_uid and book_id = p_book_id
  ) into v_exists;

  if v_exists then
    delete from public.wishlists where uid = v_uid and book_id = p_book_id;
    update public.books set wishlist_count = greatest(0, wishlist_count - 1) where id = p_book_id;
    return jsonb_build_object('success', true, 'wishlisted', false, 'message', 'Removed from your wishlist.');
  end if;

  select count(*) into v_count from public.wishlists where uid = v_uid;
  if v_count >= 50 then
    return jsonb_build_object(
      'success', false,
      'reason', 'WISHLIST_FULL',
      'message', 'Wishlist limit reached (maximum 50 titles). Please remove one or more items first.'
    );
  end if;

  insert into public.wishlists (uid, book_id) values (v_uid, p_book_id) on conflict do nothing;
  update public.books set wishlist_count = wishlist_count + 1 where id = p_book_id;

  return jsonb_build_object('success', true, 'wishlisted', true, 'message', 'Added to wishlist!');
end;
$$;

create or replace function public.rpc_checkout_cart(
  p_items            jsonb,
  p_payment_method   text default 'mobile_banking',
  p_idempotency_key  text default null,
  p_simulate_failure boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid             uuid := auth.uid();
  v_profile         record;
  v_existing_req    record;
  v_item_in         jsonb;
  v_book_id         uuid;
  v_pref_copy_id    uuid;
  v_duration        integer;
  v_book            record;
  v_copy            record;
  v_copy_found      boolean;
  v_active_loans    integer;
  v_ready_res       integer;
  v_active_count    integer;
  v_max_items       integer := 3;
  v_req_count       integer;
  v_line_fee        integer;
  v_total_fee       integer := 0;
  v_request_id      uuid;
  v_pickup_code     text;
  v_ref_id          text;
  v_payment_id      uuid;
  v_loan_item_id    uuid;
  v_item_status     text;
  v_receipt_method  text;
  v_receipt_no      text;
  v_pickup_location text := 'Main Library Circulation Desk';
  v_line_errors     jsonb := '[]'::jsonb;
  v_created_items   jsonb := '[]'::jsonb;
  v_locked_copies   jsonb := '[]'::jsonb;
  v_entry           jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'reason', 'UNAUTHENTICATED', 'message', 'Please sign in first.');
  end if;

  -- Idempotency check (FR-CART-03)
  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select id, pickup_code, created_at into v_existing_req
    from public.loan_requests
    where uid = v_uid and idempotency_key = p_idempotency_key;

    if found then
      return jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'request_id', v_existing_req.id,
        'pickup_code', v_existing_req.pickup_code,
        'reference_id', 'RSH-' || right(v_existing_req.pickup_code, 6),
        'timestamp', v_existing_req.created_at
      );
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED', 'message', 'Your cart is empty.');
  end if;

  -- 1. Validate reader standing & gating (FR-CART-03)
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found or v_profile.status <> 'active' then
    return jsonb_build_object(
      'success', false,
      'reason', case when v_profile.status = 'restricted' then 'ACCOUNT_RESTRICTED' else 'ACCOUNT_NOT_ACTIVE' end,
      'message', 'Your account is currently ' || coalesce(v_profile.status, 'inactive') || '. Borrowing is disabled.'
    );
  end if;

  if v_profile.debt_outstanding > 0 then
    return jsonb_build_object(
      'success', false,
      'reason', 'DEBT_HOLD',
      'message', 'Please settle your outstanding debt (' || v_profile.debt_outstanding || ' VND) before borrowing.'
    );
  end if;

  -- Count currently active items + ready_for_pickup reservations (DEC-22, UC-09/10)
  select count(*) into v_active_loans
  from public.loan_items
  where uid = v_uid
    and status in ('awaiting_payment', 'payment_failed', 'ready_for_pickup', 'borrowed', 'overdue');

  select count(*) into v_ready_res
  from public.reservations
  where uid = v_uid
    and status = 'ready_for_pickup';

  v_active_count := v_active_loans + v_ready_res;
  v_req_count := jsonb_array_length(p_items);
  if v_active_count + v_req_count > v_max_items then
    return jsonb_build_object(
      'success', false,
      'reason', 'LIMIT_REACHED',
      'message', 'You have reached your limit of ' || v_max_items || ' active items (currently ' || v_active_count || ').'
    );
  end if;

  -- 2. Validate & atomically lock one available copy per line (FOR UPDATE SKIP LOCKED)
  for v_item_in in select * from jsonb_array_elements(p_items)
  loop
    v_book_id := (v_item_in ->> 'book_id')::uuid;
    v_pref_copy_id := nullif(v_item_in ->> 'preferred_copy_id', '')::uuid;
    -- Non-member default duration is 7 days (UC-09 §3.2)
    v_duration := 7;

    select * into v_book from public.books where id = v_book_id and status = 'active';
    if not found then
      v_line_errors := v_line_errors || jsonb_build_object(
        'book_id', v_book_id, 'reason', 'NOT_FOUND', 'message', 'Book is no longer in the catalog.'
      );
      continue;
    end if;

    -- Prevent duplicate active loan/request for the same book (FR-CART-01)
    if exists (
      select 1 from public.loan_items
      where uid = v_uid and book_id = v_book_id
        and status in ('awaiting_payment', 'payment_failed', 'ready_for_pickup', 'borrowed', 'overdue')
    ) then
      v_line_errors := v_line_errors || jsonb_build_object(
        'book_id', v_book_id, 'reason', 'DUPLICATE_ACTIVE_LOAN', 'message', v_book.title || ' is already in your active loans.'
      );
      continue;
    end if;

    -- Lock preferred copy first if available, else pick lowest barcode available copy
    v_copy_found := false;
    if v_pref_copy_id is not null then
      select * into v_copy
      from public.copies
      where id = v_pref_copy_id and book_id = v_book_id and status = 'available'
      for update skip locked;
      v_copy_found := found;
    end if;

    if not v_copy_found then
      select * into v_copy
      from public.copies
      where book_id = v_book_id and status = 'available'
      order by barcode asc
      limit 1
      for update skip locked;
      v_copy_found := found;
    end if;

    if not v_copy_found then
      v_line_errors := v_line_errors || jsonb_build_object(
        'book_id', v_book_id, 'reason', 'NOT_AVAILABLE', 'message', v_book.title || ' is no longer available.'
      );
      continue;
    end if;

    -- Calculate fee (POL-05: 5,000 VND per 7 days for non-member Premium)
    v_line_fee := case
      when v_book.collection = 'premium' then ceil(v_duration::numeric / 7.0)::integer * 5000
      else 0
    end;
    v_total_fee := v_total_fee + v_line_fee;

    if v_copy.shelf_location is not null and v_copy.shelf_location <> '' then
      v_pickup_location := v_copy.shelf_location;
    end if;

    v_locked_copies := v_locked_copies || jsonb_build_object(
      'book_id', v_book.id,
      'title', v_book.title,
      'collection', v_book.collection,
      'copy_id', v_copy.id,
      'barcode', v_copy.barcode,
      'shelf_location', coalesce(v_copy.shelf_location, v_book.shelf_location, 'Circulation Desk'),
      'duration_days', v_duration,
      'fee', v_line_fee
    );
  end loop;

  -- Atomic rejection: if any line failed, keep cart intact and return per-line errors (SC-002)
  if jsonb_array_length(v_line_errors) > 0 then
    return jsonb_build_object(
      'success', false,
      'reason', 'NOT_AVAILABLE',
      'message', 'Some items in your cart could not be checked out.',
      'line_errors', v_line_errors
    );
  end if;

  -- 3. Create Loan Request with 6-digit pickup code (FR-CART-08)
  v_pickup_code := lpad((floor(random() * 900000) + 100000)::integer::text, 6, '0');
  v_ref_id := 'RSH-' || v_pickup_code;

  insert into public.loan_requests (uid, pickup_code, status, idempotency_key)
  values (v_uid, v_pickup_code, 'pending', nullif(btrim(coalesce(p_idempotency_key, '')), ''))
  returning id into v_request_id;

  -- 4. Handle Payment record if total fee > 0 (FR-CART-05, FR-CART-06)
  v_receipt_method := case p_payment_method
    when 'card' then 'card'
    when 'counter' then 'counter'
    else 'transfer'
  end;

  if v_total_fee > 0 then
    insert into public.payments (
      uid, request_id, purpose, amount, method, status, provider, reference_code, deadline, idempotency_key
    )
    values (
      v_uid,
      v_request_id,
      'borrow_fee',
      v_total_fee,
      case when p_payment_method in ('mobile_banking', 'card', 'counter', 'online') then p_payment_method else 'mobile_banking' end,
      case
        when p_payment_method = 'counter' then 'pending'
        when p_simulate_failure then 'failed'
        else 'succeeded'
      end,
      'simulated',
      v_ref_id,
      case
        when p_payment_method = 'counter' then app_now() + interval '48 hours'
        else app_now() + interval '30 minutes'
      end,
      nullif(btrim(coalesce(p_idempotency_key, '')), '')
    )
    returning id into v_payment_id;

    update public.loan_requests set payment_id = v_payment_id where id = v_request_id;
  end if;

  -- 5. Hold copies, create Loan Items, and emit receipts (one per paid line, SC-003)
  for v_entry in select * from jsonb_array_elements(v_locked_copies)
  loop
    v_line_fee := (v_entry ->> 'fee')::integer;
    v_item_status := case
      when v_line_fee = 0 then 'ready_for_pickup'
      when p_payment_method = 'counter' then 'awaiting_payment'
      when p_simulate_failure then 'payment_failed'
      else 'ready_for_pickup'
    end;

    insert into public.loan_items (
      request_id, uid, book_id, copy_id, source, status, is_premium, fee, duration_days,
      payment_deadline, pickup_deadline, created_at, updated_at
    )
    values (
      v_request_id,
      v_uid,
      (v_entry ->> 'book_id')::uuid,
      (v_entry ->> 'copy_id')::uuid,
      'cart',
      v_item_status,
      (v_entry ->> 'collection') = 'premium',
      v_line_fee,
      (v_entry ->> 'duration_days')::integer,
      case
        when v_item_status = 'awaiting_payment' and p_payment_method = 'counter' then app_now() + interval '48 hours'
        when v_item_status in ('awaiting_payment', 'payment_failed') then app_now() + interval '30 minutes'
        else null
      end,
      app_now() + interval '48 hours',
      app_now(),
      app_now()
    )
    returning id into v_loan_item_id;

    -- Hold physical copy atomically
    update public.copies
    set status = 'held',
        held_for_type = 'loan_item',
        held_for_id = v_loan_item_id,
        held_until = app_now() + interval '48 hours',
        updated_at = app_now()
    where id = (v_entry ->> 'copy_id')::uuid;

    -- Emit immutable receipt for each online-paid line (SC-003)
    if v_line_fee > 0 and p_payment_method <> 'counter' and not p_simulate_failure then
      v_receipt_no := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
      insert into public.receipts (
        number, uid, amount, method, type, ref_type, ref_id, notes, created_by_type
      )
      values (
        v_receipt_no, v_uid, v_line_fee, v_receipt_method, 'borrow_fee',
        'loan_item', v_loan_item_id,
        'Borrow fee for ' || (v_entry ->> 'title') || ' (' || (v_entry ->> 'barcode') || ')',
        'system'
      );
    end if;

    -- Increment borrow count
    update public.books
    set borrow_count = borrow_count + 1,
        popularity_score = popularity_score + 1
    where id = (v_entry ->> 'book_id')::uuid;

    v_created_items := v_created_items || jsonb_build_object(
      'loan_item_id', v_loan_item_id,
      'book_id', v_entry ->> 'book_id',
      'title', v_entry ->> 'title',
      'barcode', v_entry ->> 'barcode',
      'status', v_item_status,
      'fee', v_line_fee,
      'duration_days', (v_entry ->> 'duration_days')::integer
    );
  end loop;

  -- Clear user's persistent cart
  delete from public.cart_items where uid = v_uid;

  return jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'payment_id', v_payment_id,
    'payment_status', case
      when v_total_fee = 0 then 'free'
      when p_payment_method = 'counter' then 'counter_pending'
      when p_simulate_failure then 'failed'
      else 'succeeded'
    end,
    'pickup_code', v_pickup_code,
    'reference_id', v_ref_id,
    'timestamp', app_now(),
    'patron_name', v_profile.full_name,
    'student_id', v_profile.student_id,
    'pickup_location', v_pickup_location,
    'payment_method', p_payment_method,
    'total_amount', v_total_fee,
    'items', v_created_items
  );
end;
$$;

-- Preserve 0012 server-authoritative execution restrictions
revoke execute on function public.rpc_toggle_wishlist(uuid) from public, anon, authenticated;
grant execute on function public.rpc_toggle_wishlist(uuid) to service_role;
revoke execute on function public.rpc_checkout_cart(jsonb, text, text, boolean) from public, anon, authenticated;
grant execute on function public.rpc_checkout_cart(jsonb, text, text, boolean) to service_role;
