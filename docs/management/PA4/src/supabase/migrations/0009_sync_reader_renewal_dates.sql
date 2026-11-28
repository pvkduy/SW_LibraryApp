-- Keep the reader-facing and circulation-facing loan dates in sync.
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
  v_new_renew_count integer;
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

  if greatest(coalesce(v_item.renew_count, 0), coalesce(v_item.renewals_used, 0)) >= 2 then
    return jsonb_build_object('success', false, 'error', 'RENEWAL_LIMIT_REACHED', 'message', 'Bạn đã đạt giới hạn tối đa số lần gia hạn (2/2 lần).');
  end if;

  select count(*) into v_waiting_count
  from public.reservations
  where book_id = v_item.book_id
    and status = 'waiting'
    and uid <> v_uid;

  if v_waiting_count > 0 then
    return jsonb_build_object('success', false, 'error', 'RESERVATION_HOLD', 'message', 'Không thể gia hạn vì đã có người đặt trước cuốn sách này.');
  end if;

  if v_item.due_date is null and v_item.due_at is null then
    return jsonb_build_object('success', false, 'error', 'MISSING_DUE_DATE', 'message', 'Không tìm thấy hạn trả hiện tại của lượt mượn.');
  end if;

  v_new_due_date := greatest(v_item.due_date, v_item.due_at) + interval '14 days';
  v_new_renew_count := greatest(coalesce(v_item.renew_count, 0), coalesce(v_item.renewals_used, 0)) + 1;

  update public.loan_items
  set due_date = v_new_due_date,
      due_at = v_new_due_date,
      renew_count = v_new_renew_count,
      renewals_used = v_new_renew_count,
      updated_at = app_now()
  where id = p_loan_item_id;

  return jsonb_build_object(
    'success', true,
    'loan_item_id', p_loan_item_id,
    'new_due_date', v_new_due_date,
    'renew_count', v_new_renew_count,
    'message', 'Gia hạn thành công thêm 14 ngày.'
  );
end;
$$;
