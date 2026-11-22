-- ============================================================================
-- Migration 0004: Reader Loans (Renew, Overdue Fines, Reviews) & Financial Ledger
-- Spec References: 005a-loans-reader, 006a-reservations-reader, 009-receipts, 005b-loans-admin
-- Figma Mockups: Active Loans, Fines, FineCheckout, BookReview, FinancialLedger
-- ============================================================================

-- Ensure loan_items has due_date and renew_count columns for reader views & renew RPC
alter table public.loan_items
  add column if not exists due_date timestamptz,
  add column if not exists renew_count integer not null default 0;

update public.loan_items
set due_date = due_at, renew_count = renewals_used
where due_date is null and due_at is not null;

-- 1. Create table for Book Reviews (UC-15 / FR-LOAN-04)
create table if not exists public.book_reviews (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  loan_item_id uuid references public.loan_items(id) on delete set null,
  uid uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default app_now(),
  updated_at timestamptz not null default app_now(),
  constraint uq_book_reviews_user_loan unique (uid, loan_item_id)
);

create index if not exists idx_book_reviews_book on public.book_reviews(book_id);
create index if not exists idx_book_reviews_user on public.book_reviews(uid);

-- Enable RLS
alter table public.book_reviews enable row level security;

-- Policies for book_reviews
drop policy if exists "Anyone can read book reviews" on public.book_reviews;
create policy "Anyone can read book reviews"
  on public.book_reviews for select
  using (true);

drop policy if exists "Users can create reviews for their loans" on public.book_reviews;
create policy "Users can create reviews for their loans"
  on public.book_reviews for insert
  with check (auth.uid() = uid);

drop policy if exists "Users can update their own reviews" on public.book_reviews;
create policy "Users can update their own reviews"
  on public.book_reviews for update
  using (auth.uid() = uid);

-- 2. Function: Renew Loan (UC-12 / FR-LOAN-03)
-- Rules:
-- 1. Must be currently borrowed and not returned/lost
-- 2. Student cannot exceed renewal limit (max 2 renewals per loan item)
-- 3. No waiting reservations for this title by other members
-- 4. Due date is extended by 14 days
create or replace function public.rpc_renew_loan(
  p_loan_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_item record;
  v_waiting_count integer;
  v_new_due_date timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  end if;

  select li.*, b.id as book_id, b.title as book_title
  into v_item
  from public.loan_items li
  join public.copies c on c.id = li.copy_id
  join public.books b on b.id = c.book_id
  where li.id = p_loan_item_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'LOAN_NOT_FOUND', 'message', 'Không tìm thấy lượt mượn.');
  end if;

  if v_item.uid <> v_uid then
    return jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Bạn không có quyền gia hạn cuốn sách này.');
  end if;

  if v_item.status <> 'borrowed' then
    return jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', 'Chỉ có thể gia hạn khi sách đang được mượn.');
  end if;

  if coalesce(v_item.renew_count, 0) >= 2 then
    return jsonb_build_object('success', false, 'error', 'RENEWAL_LIMIT_REACHED', 'message', 'Bạn đã đạt giới hạn tối đa số lần gia hạn (2/2 lần).');
  end if;

  -- Check if another member is waiting in reservation queue
  select count(*) into v_waiting_count
  from public.reservations
  where book_id = v_item.book_id
    and status = 'waiting'
    and uid <> v_uid;

  if v_waiting_count > 0 then
    return jsonb_build_object('success', false, 'error', 'RESERVATION_HOLD', 'message', 'Không thể gia hạn vì đã có người đặt trước cuốn sách này.');
  end if;

  v_new_due_date := v_item.due_date + interval '14 days';

  update public.loan_items
  set due_date = v_new_due_date,
      renew_count = coalesce(renew_count, 0) + 1,
      updated_at = app_now()
  where id = p_loan_item_id;

  return jsonb_build_object(
    'success', true,
    'loan_item_id', p_loan_item_id,
    'new_due_date', v_new_due_date,
    'renew_count', coalesce(v_item.renew_count, 0) + 1,
    'message', 'Gia hạn thành công thêm 14 ngày.'
  );
end;
$$;

-- 3. Function: Settle Charges Online for Reader (UC-13 / FR-LOAN-05, FR-LOAN-06, FR-LOAN-10)
create or replace function public.rpc_pay_reader_charges(
  p_charge_ids uuid[],
  p_method text default 'online'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_total_amount numeric := 0;
  v_charge record;
  v_receipt_number text;
  v_remaining_debt numeric;
  v_receipt_ids uuid[] := array[]::uuid[];
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  end if;

  if p_charge_ids is null or array_length(p_charge_ids, 1) = 0 then
    return jsonb_build_object('success', false, 'error', 'NO_CHARGES_SELECTED', 'message', 'Vui lòng chọn khoản phạt cần thanh toán.');
  end if;

  for v_charge in
    select * from public.charges
    where id = any(p_charge_ids) and uid = v_uid and status = 'unpaid'
  loop
    v_total_amount := v_total_amount + v_charge.amount;

    -- Update charge
    update public.charges
    set status = 'paid',
        paid_at = app_now(),
        updated_at = app_now()
    where id = v_charge.id;

    -- Generate Receipt
    v_receipt_number := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
    insert into public.receipts (
      number, uid, amount, method, type, ref_type, ref_id, charge_id, notes
    ) values (
      v_receipt_number, v_uid, v_charge.amount, p_method, v_charge.type, 'charge', v_charge.id, v_charge.id, 'Thanh toán trực tuyến phí ' || v_charge.type
    );
  end loop;

  if v_total_amount = 0 then
    return jsonb_build_object('success', false, 'error', 'NO_PAYABLE_CHARGES', 'message', 'Không có khoản nợ nào hợp lệ để thanh toán.');
  end if;

  -- Recalculate remaining debt
  select coalesce(sum(amount), 0) into v_remaining_debt
  from public.charges
  where uid = v_uid and status = 'unpaid';

  update public.profiles
  set debt_outstanding = v_remaining_debt,
      status = case when v_remaining_debt = 0 and status = 'restricted' then 'active' else status end,
      updated_at = app_now()
  where id = v_uid;

  return jsonb_build_object(
    'success', true,
    'total_paid', v_total_amount,
    'remaining_debt', v_remaining_debt,
    'message', 'Thanh toán phí phạt thành công.'
  );
end;
$$;

-- 4. Function: Submit Book Review (UC-15 / FR-LOAN-04)
create or replace function public.rpc_submit_book_review(
  p_loan_item_id uuid,
  p_rating integer,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_item record;
  v_review_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  end if;

  if p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('success', false, 'error', 'INVALID_RATING', 'message', 'Số sao đánh giá phải từ 1 đến 5.');
  end if;

  select li.*, c.book_id
  into v_item
  from public.loan_items li
  join public.copies c on c.id = li.copy_id
  where li.id = p_loan_item_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Không tìm thấy thông tin mượn sách.');
  end if;

  if v_item.uid <> v_uid then
    return jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Bạn không có quyền đánh giá lượt mượn này.');
  end if;

  if v_item.status <> 'returned' then
    return jsonb_build_object('success', false, 'error', 'NOT_RETURNED', 'message', 'Bạn chỉ có thể đánh giá sách sau khi đã hoàn thành việc trả sách.');
  end if;

  insert into public.book_reviews (book_id, loan_item_id, uid, rating, comment, updated_at)
  values (v_item.book_id, p_loan_item_id, v_uid, p_rating, p_comment, app_now())
  on conflict (uid, loan_item_id)
  do update set rating = excluded.rating, comment = excluded.comment, updated_at = app_now()
  returning id into v_review_id;

  return jsonb_build_object(
    'success', true,
    'review_id', v_review_id,
    'message', 'Cảm ơn bạn đã gửi đánh giá!'
  );
end;
$$;
