-- Keep user identity available to SECURITY DEFINER RPCs invoked by trusted Edge Functions.
create or replace function public.rpc_toggle_wishlist_for_user(
  p_user_id uuid,
  p_book_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return public.rpc_toggle_wishlist(p_book_id);
end;
$$;

create or replace function public.rpc_reserve_book_for_user(
  p_user_id uuid,
  p_book_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return public.rpc_reserve_book(p_book_id);
end;
$$;

create or replace function public.rpc_renew_loan_for_user(
  p_user_id uuid,
  p_loan_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return public.rpc_renew_loan(p_loan_item_id);
end;
$$;

create or replace function public.rpc_pay_reader_charges_for_user(
  p_user_id uuid,
  p_charge_ids uuid[],
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return public.rpc_pay_reader_charges(p_charge_ids, p_method);
end;
$$;

create or replace function public.rpc_submit_book_review_for_user(
  p_user_id uuid,
  p_loan_item_id uuid,
  p_rating integer,
  p_comment text,
  p_headline text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return public.rpc_submit_book_review(p_loan_item_id, p_rating, p_comment, p_headline);
end;
$$;

create or replace function public.rpc_checkout_cart_for_user(
  p_user_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_idempotency_key text,
  p_simulate_failure boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return public.rpc_checkout_cart(p_items, p_payment_method, p_idempotency_key, p_simulate_failure);
end;
$$;

create or replace function public.rpc_complete_simulated_payment_for_user(
  p_user_id uuid,
  p_payment_id uuid,
  p_outcome text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return public.rpc_complete_simulated_payment(p_payment_id, p_outcome);
end;
$$;

create or replace function public.rpc_cancel_reservation_staff_for_user(
  p_user_id uuid,
  p_reservation_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return public.rpc_cancel_reservation_staff(p_reservation_id, p_reason);
end;
$$;

create or replace function public.rpc_settle_counter_charge_for_admin(
  p_admin_id uuid,
  p_charge_id uuid,
  p_amount_collected integer,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_admin_id::text, true);
  return public.rpc_settle_counter_charge(p_charge_id, p_amount_collected, p_notes);
end;
$$;

create or replace function public.rpc_confirm_handover_for_admin(
  p_admin_id uuid,
  p_loan_item_id uuid,
  p_condition_out text,
  p_notes text,
  p_condition_out_media text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_admin_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;

  return public.rpc_confirm_handover(p_loan_item_id, p_condition_out, p_notes, p_condition_out_media);
end;
$$;

create or replace function public.rpc_process_return_with_evidence_for_admin(
  p_admin_id uuid,
  p_copy_barcode text,
  p_condition_in text,
  p_damage_tier integer,
  p_settle_now boolean,
  p_amount_collected integer,
  p_condition_in_notes text,
  p_condition_in_media text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_admin_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;

  return public.rpc_process_return_with_evidence(
    p_copy_barcode,
    p_condition_in,
    p_damage_tier,
    p_settle_now,
    p_amount_collected,
    p_condition_in_notes,
    p_condition_in_media
  );
end;
$$;

-- Mutation RPCs are callable only from trusted Edge Functions using service_role.
do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and left(p.proname, 4) = 'rpc_'
      and p.proname <> 'rpc_search_books'
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      v_function
    );
    execute format('grant execute on function %s to service_role', v_function);
  end loop;
end;
$$;

-- Catalog search remains available through the read-only RPC.
grant execute on function public.rpc_search_books(
  text, text, text, text, text, integer, integer, boolean, text, integer, integer
) to anon, authenticated;

-- The privileged RPC also validates its caller, even when invoked by a trusted server.
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
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  ) then
    return jsonb_build_object('success', false, 'error', 'FORBIDDEN_ROLE');
  end if;

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

  update public.charges
  set status = 'paid',
      paid_at = app_now(),
      notes = coalesce(p_notes, notes),
      updated_at = app_now()
  where id = p_charge_id;

  update public.profiles
  set debt_outstanding = greatest(0, debt_outstanding - v_charge.amount),
      updated_at = app_now()
  where id = v_charge.uid;

  v_receipt_number := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
  insert into public.receipts (number, uid, amount, method, type, ref_type, ref_id, charge_id, notes)
  values (v_receipt_number, v_charge.uid, v_charge.amount, 'cash', 'fine', 'charge', p_charge_id, p_charge_id, p_notes);

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

-- Re-apply the restricted grants to the two guarded RPCs replaced above.
revoke execute on function public.rpc_settle_counter_charge(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.rpc_settle_counter_charge(uuid, integer, text) to service_role;
revoke execute on function public.rpc_cancel_reservation_staff(uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_cancel_reservation_staff(uuid, text) to service_role;

-- These implementation RPCs are callable only through their actor-checking wrappers.
revoke execute on function public.rpc_confirm_handover(uuid, text, text) from public, anon, authenticated, service_role;
revoke execute on function public.rpc_confirm_handover(uuid, text, text, text[]) from public, anon, authenticated, service_role;
revoke execute on function public.rpc_process_return(text, text, integer, boolean, integer) from public, anon, authenticated, service_role;
revoke execute on function public.rpc_process_return_with_evidence(
  text, text, integer, boolean, integer, text, text[]
) from public, anon, authenticated, service_role;
