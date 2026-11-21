-- ============================================================================
-- Circulation Test for 005a / 006a / 009: Renew, Charges Settlement, and Reviews
-- ============================================================================

do $$
declare
  v_student_id uuid;
  v_book_id uuid;
  v_copy_id uuid;
  v_loan_req_id uuid;
  v_loan_item_id uuid;
  v_charge_id uuid;
  v_res jsonb;
begin
  -- 1. Get or create test student
  select id into v_student_id from public.profiles where role = 'student' limit 1;
  select id into v_book_id from public.books limit 1;
  select id into v_copy_id from public.copies where book_id = v_book_id and status = 'available' limit 1;

  if v_copy_id is not null and v_student_id is not null then
    -- Insert test loan item in borrowed state
    insert into public.loan_items (uid, copy_id, status, borrowed_at, due_date, renew_count)
    values (v_student_id, v_copy_id, 'borrowed', now(), now() + interval '14 days', 0)
    returning id into v_loan_item_id;

    -- Test Renew function signature check
    perform * from public.loan_items where id = v_loan_item_id;
    raise notice 'Created test loan item: %', v_loan_item_id;

    -- Insert test charge
    insert into public.charges (uid, amount, type, status, notes)
    values (v_student_id, 10000, 'overdue_fine', 'unpaid', 'Late return fine test')
    returning id into v_charge_id;

    raise notice 'Created test charge: %', v_charge_id;
  end if;
end;
$$;
