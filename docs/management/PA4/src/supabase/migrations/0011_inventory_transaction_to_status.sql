-- Inventory transactions record the copy state *after* a change.
--
-- status_change / found rows previously carried delta = 0 and only an
-- "old → new" reason string, so the copy history panel could not say what a
-- copy became. Add to_status and let the trigger fill it for every status
-- transition (including ones made by circulation and write-off flows).

alter table public.inventory_transactions
  add column if not exists to_status text;

-- Backfill from the existing reason string ("old → new") for past transitions.
update public.inventory_transactions t
set to_status = btrim(split_part(t.reason, '→', 2))
where t.to_status is null
  and t.copy_id is not null
  and t.type in ('status_change', 'found')
  and t.reason like '%→%'
  and btrim(split_part(t.reason, '→', 2)) <> '';

create or replace function public.on_copy_inventory_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_actor_label text;
  v_type text;
  v_reason text;
  v_ref_type text;
  v_ref_id uuid;
  v_delta integer := 0;
begin
  v_actor := public.inventory_actor();
  v_actor_label := case
    when v_actor is null then 'system'
    else coalesce((select full_name from public.profiles where id = v_actor), 'staff')
  end;

  v_ref_type := nullif(current_setting('app.inventory_ref_type', true), '');
  begin
    v_ref_id := nullif(current_setting('app.inventory_ref_id', true), '')::uuid;
  exception when invalid_text_representation then
    v_ref_id := null;
  end;

  if tg_op = 'INSERT' then
    v_type := coalesce(
      nullif(current_setting('app.inventory_type', true), ''),
      'manual_addition'
    );
    v_reason := coalesce(
      nullif(current_setting('app.inventory_reason', true), ''),
      'Copy added'
    );
    if new.status not in ('retired', 'lost') then
      v_delta := 1;
    end if;

    insert into public.inventory_transactions
      (actor_id, actor_label, book_id, copy_id, delta, type, reason, ref_type, ref_id, to_status)
    values
      (v_actor, v_actor_label, new.book_id, new.id, v_delta, v_type, v_reason, v_ref_type, v_ref_id, new.status);

    return null;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    v_type := nullif(current_setting('app.inventory_type', true), '');
    if v_type is null then
      if old.status = 'lost' and new.status in ('available', 'damaged') then
        v_type := 'found';
      else
        v_type := 'status_change';
      end if;
    end if;

    if old.status not in ('retired', 'lost') and new.status in ('retired', 'lost') then
      v_delta := -1;
    elsif old.status in ('retired', 'lost') and new.status not in ('retired', 'lost') then
      v_delta := 1;
    else
      v_delta := 0;
    end if;

    v_reason := coalesce(
      nullif(current_setting('app.inventory_reason', true), ''),
      old.status || ' → ' || new.status
    );

    insert into public.inventory_transactions
      (actor_id, actor_label, book_id, copy_id, delta, type, reason, ref_type, ref_id, to_status)
    values
      (v_actor, v_actor_label, new.book_id, new.id, v_delta, v_type, v_reason, v_ref_type, v_ref_id, new.status);
  end if;

  return null;
end;
$$;
