alter table public.loan_items
  add column if not exists condition_in_notes text,
  add column if not exists condition_in_media text[] not null default '{}';

create or replace function public.rpc_process_return_with_evidence(
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
declare
  v_result jsonb;
begin
  v_result := public.rpc_process_return(
    p_copy_barcode,
    p_condition_in,
    p_damage_tier,
    p_settle_now,
    p_amount_collected
  );

  if coalesce((v_result ->> 'success')::boolean, false) then
    update public.loan_items
    set condition_in_notes = p_condition_in_notes,
        condition_in_media = coalesce(p_condition_in_media, '{}')
    where id = (v_result ->> 'loan_item_id')::uuid;
  end if;

  return v_result;
end;
$$;
