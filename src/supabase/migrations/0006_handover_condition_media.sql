alter table public.loan_items
  add column if not exists condition_out_media text[] not null default '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists handover_evidence_admin_insert on storage.objects;
create policy handover_evidence_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidence' and public.is_admin());

drop policy if exists handover_evidence_admin_select on storage.objects;
create policy handover_evidence_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'evidence' and public.is_admin());

drop policy if exists handover_evidence_admin_delete on storage.objects;
create policy handover_evidence_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidence' and public.is_admin());

create or replace function public.rpc_confirm_handover(
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
declare
  v_result jsonb;
begin
  v_result := public.rpc_confirm_handover(p_loan_item_id, p_condition_out, p_notes);

  if coalesce((v_result ->> 'success')::boolean, false) then
    update public.loan_items
    set condition_out_media = coalesce(p_condition_out_media, '{}')
    where id = p_loan_item_id;
  end if;

  return v_result;
end;
$$;
