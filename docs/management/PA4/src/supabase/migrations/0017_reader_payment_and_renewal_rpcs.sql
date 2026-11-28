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

revoke execute on function public.rpc_pay_reader_charges_for_user(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.rpc_pay_reader_charges_for_user(uuid, uuid[], text) to service_role;
revoke execute on function public.rpc_renew_loan_for_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rpc_renew_loan_for_user(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
