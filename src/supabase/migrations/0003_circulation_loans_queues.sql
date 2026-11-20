-- =============================================================================
-- ShelfHelp — 0003_circulation_loans_queues.sql
-- Circulation, Loans, Charges, Receipts, and Reservations
--
-- Features:
--   007-circulation (Handover, Counter Payments, UC-20, FR-CIRC-01, FR-CIRC-02, FR-CIRC-07)
--   005b-loans-admin (Return Flow & Assessment, UC-21, FR-CIRC-03, FR-CIRC-04, FR-COND-01)
--   006b-reservations-admin (Queues Oversight, UC-29, FR-RES-05)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. loan_requests (SRS §12.1)
-- -----------------------------------------------------------------------------
create table if not exists public.loan_requests (
  id               uuid primary key default gen_random_uuid(),
  uid              uuid not null references public.profiles(id) on delete cascade,
  pickup_code      text not null,
  pickup_code_hash text,
  status           text not null default 'pending'
                     check (status in ('pending', 'completed', 'cancelled', 'expired')),
  idempotency_key  text,
  payment_id       uuid,
  created_at       timestamptz not null default app_now(),
  updated_at       timestamptz not null default app_now()
);

create index if not exists loan_requests_uid_idx on public.loan_requests (uid);
create index if not exists loan_requests_status_idx on public.loan_requests (status);

drop trigger if exists trg_loan_requests_updated_at on public.loan_requests;
create trigger trg_loan_requests_updated_at
  before update on public.loan_requests
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. loan_items (SRS §12.1, §12.2)
-- -----------------------------------------------------------------------------
create table if not exists public.loan_items (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid references public.loan_requests(id) on delete set null,
  uid               uuid not null references public.profiles(id) on delete cascade,
  book_id           uuid not null references public.books(id) on delete restrict,
  copy_id           uuid references public.copies(id) on delete restrict,
  source            text not null default 'cart'
                      check (source in ('cart', 'reservation')),
  status            text not null default 'ready_for_pickup'
                      check (status in ('awaiting_payment', 'payment_failed', 'ready_for_pickup', 'borrowed', 'returned', 'overdue', 'lost')),
  is_premium        boolean not null default false,
  fee               integer not null default 0 check (fee >= 0),
  duration_days     integer not null default 14 check (duration_days > 0),
  payment_deadline  timestamptz,
  pickup_deadline   timestamptz,
  handover_at       timestamptz,
  due_at            timestamptz,
  returned_at       timestamptz,
  renewals_used     integer not null default 0 check (renewals_used >= 0),
  condition_out     text check (condition_out is null or condition_out in ('good', 'fair', 'poor', 'damaged')),
  condition_in      text check (condition_in is null or condition_in in ('good', 'fair', 'poor', 'damaged')),
  lost_at           timestamptz,
  lost_resolved_at  timestamptz,
  notes             text,
  created_at        timestamptz not null default app_now(),
  updated_at        timestamptz not null default app_now()
);

create index if not exists loan_items_uid_status_due_idx on public.loan_items (uid, status, due_at);
create index if not exists loan_items_status_due_idx on public.loan_items (status, due_at);
create index if not exists loan_items_status_pickup_idx on public.loan_items (status, pickup_deadline);
create index if not exists loan_items_book_status_idx on public.loan_items (book_id, status);
create index if not exists loan_items_copy_id_idx on public.loan_items (copy_id);

drop trigger if exists trg_loan_items_updated_at on public.loan_items;
create trigger trg_loan_items_updated_at
  before update on public.loan_items
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. reservations (SRS §12.1, §12.2, 006b)
-- -----------------------------------------------------------------------------
create table if not exists public.reservations (
  id                  uuid primary key default gen_random_uuid(),
  uid                 uuid not null references public.profiles(id) on delete cascade,
  book_id             uuid not null references public.books(id) on delete restrict,
  copy_id             uuid references public.copies(id) on delete set null,
  status              text not null default 'waiting'
                        check (status in ('waiting', 'ready_for_pickup', 'fulfilled', 'cancelled', 'expired')),
  queue_position      integer check (queue_position is null or queue_position >= 1),
  hold_until          timestamptz,
  pickup_code         text,
  cancelled_by        uuid references public.profiles(id) on delete set null,
  cancellation_reason text,
  outcome             text,
  created_at          timestamptz not null default app_now(),
  updated_at          timestamptz not null default app_now()
);

create index if not exists reservations_book_status_created_idx on public.reservations (book_id, status, created_at);
create index if not exists reservations_status_hold_idx on public.reservations (status, hold_until);
create index if not exists reservations_uid_idx on public.reservations (uid);

drop trigger if exists trg_reservations_updated_at on public.reservations;
create trigger trg_reservations_updated_at
  before update on public.reservations
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. charges (SRS §12.1, 005b, 007)
-- -----------------------------------------------------------------------------
create table if not exists public.charges (
  id            uuid primary key default gen_random_uuid(),
  uid           uuid not null references public.profiles(id) on delete cascade,
  type          text not null
                  check (type in ('overdue_fine', 'damage_fee', 'loss_fee', 'borrow_fee')),
  loan_item_id  uuid references public.loan_items(id) on delete set null,
  amount        integer not null check (amount >= 0),
  status        text not null default 'unpaid'
                  check (status in ('unpaid', 'paid', 'waived')),
  days_from     timestamptz,
  days_to       timestamptz,
  rate          integer default 5000,
  frozen        boolean not null default false,
  paid_at       timestamptz,
  notes         text,
  created_at    timestamptz not null default app_now(),
  updated_at    timestamptz not null default app_now()
);

create index if not exists charges_uid_status_idx on public.charges (uid, status);
create index if not exists charges_loan_item_id_idx on public.charges (loan_item_id);

drop trigger if exists trg_charges_updated_at on public.charges;
create trigger trg_charges_updated_at
  before update on public.charges
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. receipts (SRS §12.1, §10.7, FR-CIRC-07)
-- -----------------------------------------------------------------------------
create table if not exists public.receipts (
  id              uuid primary key default gen_random_uuid(),
  number          text not null unique,
  uid             uuid not null references public.profiles(id) on delete cascade,
  amount          integer not null,
  method          text not null default 'cash'
                    check (method in ('cash', 'card', 'transfer', 'counter')),
  type            text not null
                    check (type in ('fine', 'damage', 'loss', 'borrow_fee', 'membership')),
  ref_type        text,
  ref_id          uuid,
  charge_id       uuid references public.charges(id) on delete set null,
  reason_code     text,
  notes           text,
  created_by_type text not null default 'admin'
                    check (created_by_type in ('admin', 'system')),
  created_by_id   uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default app_now()
);

create index if not exists receipts_uid_created_idx on public.receipts (uid, created_at);
create index if not exists receipts_type_created_idx on public.receipts (type, created_at);

-- Receipts table is append-only (SRS §10.7)
drop trigger if exists trg_receipts_reject_mutation on public.receipts;
create trigger trg_receipts_reject_mutation
  before update or delete on public.receipts
  for each row execute function reject_mutation();

-- -----------------------------------------------------------------------------
-- 6. Row Level Security Policies
-- -----------------------------------------------------------------------------
alter table public.loan_requests enable row level security;
alter table public.loan_items    enable row level security;
alter table public.reservations  enable row level security;
alter table public.charges       enable row level security;
alter table public.receipts      enable row level security;

-- Admin policies (Full access for library staff)
create policy loan_requests_admin_all on public.loan_requests
  for all to authenticated
  using (is_admin())
  with check (is_admin());

create policy loan_items_admin_all on public.loan_items
  for all to authenticated
  using (is_admin())
  with check (is_admin());

create policy reservations_admin_all on public.reservations
  for all to authenticated
  using (is_admin())
  with check (is_admin());

create policy charges_admin_all on public.charges
  for all to authenticated
  using (is_admin())
  with check (is_admin());

create policy receipts_admin_select on public.receipts
  for select to authenticated
  using (is_admin() or uid = auth.uid());

create policy receipts_admin_insert on public.receipts
  for insert to authenticated
  with check (is_admin());

-- Allow admin to update copies status & shelf_location
drop policy if exists copies_admin_update on public.copies;
create policy copies_admin_update on public.copies
  for update to authenticated
  using (is_admin())
  with check (is_admin());

-- Student policies (Read own rows)
create policy loan_requests_student_select on public.loan_requests
  for select to authenticated
  using (uid = auth.uid());

create policy loan_items_student_select on public.loan_items
  for select to authenticated
  using (uid = auth.uid());

create policy reservations_student_select on public.reservations
  for select to authenticated
  using (uid = auth.uid());

create policy charges_student_select on public.charges
  for select to authenticated
  using (uid = auth.uid());

-- -----------------------------------------------------------------------------
-- 7. Database RPCs for Circulation Transactions (UC-20, UC-21, UC-29)
-- -----------------------------------------------------------------------------

-- 7.1 Confirm Handover (UC-20 / FR-CIRC-02)
create or replace function public.rpc_confirm_handover(
  p_loan_item_id uuid,
  p_condition_out text default 'good',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_profile record;
  v_due_date timestamptz;
begin
  -- 1. Fetch item
  select * into v_item from public.loan_items where id = p_loan_item_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Loan item not found');
  end if;

  if v_item.status <> 'ready_for_pickup' then
    return jsonb_build_object('success', false, 'error', 'Item is not ready for pickup (status: ' || v_item.status || ')');
  end if;

  -- 2. Fetch student profile and verify standing
  select * into v_profile from public.profiles where id = v_item.uid;
  if v_profile.status <> 'active' then
    return jsonb_build_object('success', false, 'error', 'Student account is not active (' || v_profile.status || ')');
  end if;

  if v_profile.debt_outstanding > 0 then
    return jsonb_build_object('success', false, 'error', 'Settle outstanding charges first (Debt: ' || v_profile.debt_outstanding || ' VND)');
  end if;

  if v_item.pickup_deadline is not null and v_item.pickup_deadline < app_now() then
    return jsonb_build_object('success', false, 'error', 'Pickup deadline has passed');
  end if;

  -- 3. Calculate due date (23:59:59 on the due day)
  v_due_date := (app_now() + (v_item.duration_days || ' days')::interval)::date + time '23:59:59';

  -- 4. Update loan item
  update public.loan_items
  set status = 'borrowed',
      condition_out = coalesce(p_condition_out, 'good'),
      handover_at = app_now(),
      due_at = v_due_date,
      notes = coalesce(p_notes, notes),
      updated_at = app_now()
  where id = p_loan_item_id;

  -- 5. Update physical copy
  if v_item.copy_id is not null then
    update public.copies
    set status = 'borrowed',
        held_for_type = null,
        held_for_id = null,
        held_until = null,
        updated_at = app_now()
    where id = v_item.copy_id;
  end if;

  -- 6. Increment active items for student
  update public.profiles
  set active_items = active_items + 1,
      updated_at = app_now()
  where id = v_item.uid;

  return jsonb_build_object(
    'success', true,
    'loan_item_id', p_loan_item_id,
    'status', 'borrowed',
    'due_at', v_due_date
  );
end;
$$;

-- 7.2 Process Return (UC-21 / FR-CIRC-03, FR-CIRC-04)
create or replace function public.rpc_process_return(
  p_copy_barcode text,
  p_condition_in text default 'good',
  p_damage_tier integer default 0, -- 0, 10, 30, 100 (%)
  p_settle_now boolean default false,
  p_amount_collected integer default 0
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
  v_profile record;
  v_overdue_days integer := 0;
  v_fine_amount integer := 0;
  v_damage_amount integer := 0;
  v_total_fee integer := 0;
  v_fine_charge_id uuid;
  v_damage_charge_id uuid;
  v_receipt_number text;
  v_next_reservation record;
  v_target_copy_status text := 'available';
begin
  -- 1. Lookup copy by barcode
  select * into v_copy from public.copies where barcode = p_copy_barcode;
  if not found then
    return jsonb_build_object('success', false, 'error', 'No copy found with barcode ' || p_copy_barcode);
  end if;

  -- 2. Lookup active loan item
  select * into v_item
  from public.loan_items
  where copy_id = v_copy.id
    and status in ('borrowed', 'overdue')
  order by due_at desc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Copy is not currently on loan (Status: ' || v_copy.status || ')');
  end if;

  select * into v_book from public.books where id = v_item.book_id;
  select * into v_profile from public.profiles where id = v_item.uid;

  -- 3. Calculate overdue fine (5,000 VND / day)
  if v_item.due_at is not null and app_now() > v_item.due_at then
    v_overdue_days := greatest(1, ceil(extract(epoch from (app_now() - v_item.due_at)) / 86400));
    v_fine_amount := v_overdue_days * 5000;
  end if;

  -- 4. Calculate damage fee based on book replacement price
  if p_damage_tier > 0 and v_book.replacement_price is not null then
    v_damage_amount := (v_book.replacement_price * p_damage_tier) / 100;
    if p_damage_tier >= 30 then
      v_target_copy_status := 'damaged';
    end if;
  end if;

  v_total_fee := v_fine_amount + v_damage_amount;

  -- 5. Create Charges if applicable
  if v_fine_amount > 0 then
    insert into public.charges (uid, type, loan_item_id, amount, status, rate, created_at, updated_at)
    values (v_item.uid, 'overdue_fine', v_item.id, v_fine_amount, case when p_settle_now then 'paid' else 'unpaid' end, 5000, app_now(), app_now())
    returning id into v_fine_charge_id;
  end if;

  if v_damage_amount > 0 then
    insert into public.charges (uid, type, loan_item_id, amount, status, notes, created_at, updated_at)
    values (v_item.uid, 'damage_fee', v_item.id, v_damage_amount, case when p_settle_now then 'paid' else 'unpaid' end, 'Damage assessment tier: ' || p_damage_tier || '%', app_now(), app_now())
    returning id into v_damage_charge_id;
  end if;

  -- 6. Settlement or Debt hold
  if p_settle_now and v_total_fee > 0 then
    v_receipt_number := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
    insert into public.receipts (number, uid, amount, method, type, ref_type, ref_id, notes)
    values (v_receipt_number, v_item.uid, v_total_fee, 'cash', 'fine', 'loan_item', v_item.id, 'Counter return settlement');
  elsif not p_settle_now and v_total_fee > 0 then
    -- Accumulate to student's debt_outstanding
    update public.profiles
    set debt_outstanding = debt_outstanding + v_total_fee,
        updated_at = app_now()
    where id = v_item.uid;
  end if;

  -- 7. Update loan_item status to returned
  update public.loan_items
  set status = 'returned',
      condition_in = p_condition_in,
      returned_at = app_now(),
      updated_at = app_now()
  where id = v_item.id;

  -- 8. Check for waiting reservations on this book (FIFO promotion)
  if v_target_copy_status = 'available' then
    select * into v_next_reservation
    from public.reservations
    where book_id = v_item.book_id
      and status = 'waiting'
    order by queue_position asc nulls last, created_at asc
    limit 1;

    if found then
      -- Hold for next student
      update public.reservations
      set status = 'ready_for_pickup',
          copy_id = v_copy.id,
          hold_until = app_now() + interval '48 hours',
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

      v_target_copy_status := 'held (promoted to reservation)';
    else
      -- Make available
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
    -- Copy is damaged/under repair
    update public.copies
    set status = v_target_copy_status,
        condition = p_condition_in,
        updated_at = app_now()
    where id = v_copy.id;
  end if;

  -- 9. Decrement active_items for student
  update public.profiles
  set active_items = greatest(0, active_items - 1),
      updated_at = app_now()
  where id = v_item.uid;

  return jsonb_build_object(
    'success', true,
    'loan_item_id', v_item.id,
    'overdue_days', v_overdue_days,
    'fine_amount', v_fine_amount,
    'damage_amount', v_damage_amount,
    'total_fee', v_total_fee,
    'copy_status', v_target_copy_status,
    'settled', p_settle_now,
    'receipt_number', v_receipt_number
  );
end;
$$;

-- 7.3 Settle Counter Charge (FR-CIRC-07)
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
begin
  select * into v_charge from public.charges where id = p_charge_id;
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

  -- 1. Mark charge paid
  update public.charges
  set status = 'paid',
      paid_at = app_now(),
      notes = coalesce(p_notes, notes),
      updated_at = app_now()
  where id = p_charge_id;

  -- 2. Deduct debt from student profile
  update public.profiles
  set debt_outstanding = greatest(0, debt_outstanding - v_charge.amount),
      updated_at = app_now()
  where id = v_charge.uid;

  -- 3. Emit immutable receipt
  v_receipt_number := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
  insert into public.receipts (number, uid, amount, method, type, ref_type, ref_id, charge_id, notes)
  values (v_receipt_number, v_charge.uid, v_charge.amount, 'cash', 'fine', 'charge', p_charge_id, p_notes);

  return jsonb_build_object(
    'success', true,
    'charge_id', p_charge_id,
    'amount_paid', v_charge.amount,
    'amount_collected', p_amount_collected,
    'change', v_change,
    'receipt_number', v_receipt_number
  );
end;
$$;

-- 7.4 Cancel Reservation by Staff (FR-RES-05 / UC-29)
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
  v_copy record;
  v_next record;
begin
  select * into v_res from public.reservations where id = p_reservation_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if v_res.status in ('fulfilled', 'cancelled', 'expired') then
    return jsonb_build_object('success', false, 'error', 'Reservation is already ' || v_res.status);
  end if;

  -- Cancel reservation without strike
  update public.reservations
  set status = 'cancelled',
      cancellation_reason = p_reason,
      cancelled_by = auth.uid(),
      updated_at = app_now()
  where id = p_reservation_id;

  -- If this reservation was holding a copy, promote next in line or release
  if v_res.status = 'ready_for_pickup' and v_res.copy_id is not null then
    select * into v_next
    from public.reservations
    where book_id = v_res.book_id
      and status = 'waiting'
    order by queue_position asc nulls last, created_at asc
    limit 1;

    if found then
      -- Promote next student
      update public.reservations
      set status = 'ready_for_pickup',
          copy_id = v_res.copy_id,
          hold_until = app_now() + interval '48 hours',
          updated_at = app_now()
      where id = v_next.id;

      update public.copies
      set held_for_id = v_next.id,
          held_until = app_now() + interval '48 hours',
          updated_at = app_now()
      where id = v_res.copy_id;
    else
      -- Release copy to available
      update public.copies
      set status = 'available',
          held_for_type = null,
          held_for_id = null,
          held_until = null,
          updated_at = app_now()
      where id = v_res.copy_id;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'status', 'cancelled'
  );
end;
$$;
