-- =============================================================================
-- ShelfHelp — 0005_inventory.sql
-- Inventory & Write-off (008-inventory)
--
-- Covers:
--   FR-INV-01 add book (ISBN/manual/copies)
--   FR-INV-02 CSV import (validated rows, duplicate ISBN rules)
--   FR-INV-03 edit metadata & collection
--   FR-INV-04 copy records, barcodes, label data, history
--   FR-INV-05 immutable inventory transactions
--   FR-INV-06 inventory history log / filters / export source
--   FR-INV-07 single copy-status surface
--   FR-INV-09 denormalized counters (total_copies / available_copies)
--   FR-COND-02 / FR-COND-03 write-off slips
--
-- Source of truth: specs/SHELFHELP_FULLSPEC.md §4.13, §5.4, §12.1, §12.4;
-- specs/008-inventory/spec.md; docs/management/PA3/use-case-specifications/
-- UC19.md, UC22.md, UC26.md.
--
-- Trigger context convention:
--   app.inventory_actor    uuid   operator (or unset -> auth.uid() -> system)
--   app.inventory_type     text   override transaction type (manual_addition / write_off / ...)
--   app.inventory_reason   text   human reason stored on the transaction
--   app.inventory_ref_type text   reference kind (batch / writeoff_slip / loan_item / ...)
--   app.inventory_ref_id   uuid   reference id
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Receipts: allow reversal rows and the charge-type vocabulary already used
--    by 0003/0004 (reader payment RPC inserts overdue_fine/damage_fee/...).
-- -----------------------------------------------------------------------------
alter table public.receipts
  add column if not exists reverses_receipt_id uuid references public.receipts (id) on delete set null,
  add column if not exists manual boolean not null default false;

alter table public.receipts drop constraint if exists receipts_type_check;
alter table public.receipts
  add constraint receipts_type_check
  check (type in (
    'fine', 'damage', 'loss', 'borrow_fee', 'membership',
    'overdue_fine', 'damage_fee', 'loss_fee', 'premium_fee',
    'reversal', 'manual'
  ));

-- -----------------------------------------------------------------------------
-- 1. inventory_transactions (SRS §12.1, FR-INV-05)
-- -----------------------------------------------------------------------------
create table if not exists public.inventory_transactions (
  id          uuid primary key default gen_random_uuid(),
  at          timestamptz not null default app_now(),
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_label text not null default 'system',
  book_id     uuid not null references public.books (id) on delete restrict,
  copy_id     uuid references public.copies (id) on delete restrict,
  delta       integer not null default 0,
  type        text not null
                check (type in (
                  'batch_receipt', 'manual_addition', 'found',
                  'write_off', 'lost', 'status_change'
                )),
  reason      text,
  ref_type    text,
  ref_id      uuid
);

create index if not exists inventory_transactions_type_at_idx
  on public.inventory_transactions (type, at desc);
create index if not exists inventory_transactions_book_at_idx
  on public.inventory_transactions (book_id, at desc);
create index if not exists inventory_transactions_copy_at_idx
  on public.inventory_transactions (copy_id, at desc);

drop trigger if exists trg_inventory_transactions_reject_mutation
  on public.inventory_transactions;
create trigger trg_inventory_transactions_reject_mutation
  before update or delete on public.inventory_transactions
  for each row execute function reject_mutation();

-- -----------------------------------------------------------------------------
-- 2. write-off slips (SRS §12.1, FR-COND-02/03)
-- -----------------------------------------------------------------------------
create sequence if not exists public.writeoff_slip_seq start 1;

create table if not exists public.writeoff_slips (
  id                  uuid primary key default gen_random_uuid(),
  number              text not null unique,
  status              text not null default 'draft'
                        check (status in ('draft', 'completed', 'cancelled')),
  reason_code         text not null
                        check (reason_code in (
                          'damaged_beyond_repair', 'obsolete_edition', 'confirmed_missing'
                        )),
  notes               text,
  photos              text[] not null default '{}',
  created_by          uuid references public.profiles (id) on delete set null,
  completed_at        timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text,
  created_at          timestamptz not null default app_now(),
  updated_at          timestamptz not null default app_now()
);

create index if not exists writeoff_slips_status_created_idx
  on public.writeoff_slips (status, created_at desc);
create index if not exists writeoff_slips_created_by_idx
  on public.writeoff_slips (created_by);

drop trigger if exists trg_writeoff_slips_updated_at on public.writeoff_slips;
create trigger trg_writeoff_slips_updated_at
  before update on public.writeoff_slips
  for each row execute function set_updated_at();

create table if not exists public.writeoff_slip_copies (
  id              uuid primary key default gen_random_uuid(),
  slip_id         uuid not null references public.writeoff_slips (id) on delete restrict,
  copy_id         uuid not null references public.copies (id) on delete restrict,
  target_status   text not null check (target_status in ('retired', 'lost')),
  assessment_note text,
  photo_paths     text[] not null default '{}',
  added_at        timestamptz not null default app_now(),
  unique (slip_id, copy_id)
);

create index if not exists writeoff_slip_copies_slip_idx
  on public.writeoff_slip_copies (slip_id);
create index if not exists writeoff_slip_copies_copy_idx
  on public.writeoff_slip_copies (copy_id);

-- Completed / cancelled slips are immutable (FR-COND-03).
create or replace function public.guard_writeoff_slip_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status in ('completed', 'cancelled') then
    raise exception 'Write-off slip % is % and immutable', old.number, old.status
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Write-off slips are never hard-deleted (POL-13)'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_writeoff_slips_guard on public.writeoff_slips;
create trigger trg_writeoff_slips_guard
  before update or delete on public.writeoff_slips
  for each row execute function guard_writeoff_slip_mutation();

create or replace function public.guard_writeoff_line_mutation()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_number text;
  v_slip_id uuid;
begin
  v_slip_id := case when tg_op = 'DELETE' then old.slip_id else new.slip_id end;

  select status, number into v_status, v_number
  from public.writeoff_slips
  where id = v_slip_id;

  if v_status is distinct from 'draft' then
    raise exception 'Write-off slip % is %. Only draft slips can be edited', v_number, v_status
      using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_writeoff_slip_copies_guard on public.writeoff_slip_copies;
create trigger trg_writeoff_slip_copies_guard
  before insert or update or delete on public.writeoff_slip_copies
  for each row execute function guard_writeoff_line_mutation();

-- Next human-readable slip number: WO-YYYY-NNN
create or replace function public.next_writeoff_number()
returns text
language sql
volatile
as $$
  select 'WO-' || to_char(app_now(), 'YYYY') || '-' ||
         lpad(nextval('public.writeoff_slip_seq')::text, 3, '0')
$$;

-- -----------------------------------------------------------------------------
-- 3. Copies: never hard-deleted (POL-13); book_id immutable
-- -----------------------------------------------------------------------------
create or replace function public.guard_copy_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Copies are never hard-deleted. Retire them through a write-off slip (POL-13).'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_copies_reject_delete on public.copies;
create trigger trg_copies_reject_delete
  before delete on public.copies
  for each row execute function guard_copy_delete();

create or replace function public.guard_copy_update()
returns trigger
language plpgsql
as $$
begin
  if new.book_id <> old.book_id then
    raise exception 'A copy cannot be moved to another book; add a new copy instead'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_copies_guard_update on public.copies;
create trigger trg_copies_guard_update
  before update on public.copies
  for each row execute function guard_copy_update();

create or replace function public.guard_book_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Books are never hard-deleted (POL-13)'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_books_reject_delete on public.books;
create trigger trg_books_reject_delete
  before delete on public.books
  for each row execute function guard_book_delete();

-- -----------------------------------------------------------------------------
-- 4. Denormalized counters (FR-INV-09)
--    total_copies   = copies not retired/lost (circulating stock)
--    available_copies = copies whose status is available
-- -----------------------------------------------------------------------------
create or replace function public.on_copy_counter_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_delta integer := 0;
  v_available_delta integer := 0;
begin
  if tg_op = 'INSERT' then
    if new.status not in ('retired', 'lost') then
      v_total_delta := 1;
    end if;
    if new.status = 'available' then
      v_available_delta := 1;
    end if;

    update public.books
    set total_copies = greatest(0, total_copies + v_total_delta),
        available_copies = greatest(0, available_copies + v_available_delta)
    where id = new.book_id;

    return null;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if old.status not in ('retired', 'lost') and new.status in ('retired', 'lost') then
      v_total_delta := -1;
    elsif old.status in ('retired', 'lost') and new.status not in ('retired', 'lost') then
      v_total_delta := 1;
    end if;

    if old.status = 'available' and new.status <> 'available' then
      v_available_delta := -1;
    elsif new.status = 'available' and old.status <> 'available' then
      v_available_delta := 1;
    end if;

    update public.books
    set total_copies = greatest(0, total_copies + v_total_delta),
        available_copies = greatest(0, available_copies + v_available_delta)
    where id = new.book_id;

    return null;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_copies_counters on public.copies;
create trigger trg_copies_counters
  after insert or update of status on public.copies
  for each row execute function public.on_copy_counter_change();

-- -----------------------------------------------------------------------------
-- 5. Immutable inventory transactions written automatically
-- -----------------------------------------------------------------------------
create or replace function public.inventory_actor()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('app.inventory_actor', true), '')::uuid,
    auth.uid()
  )
$$;

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
      (actor_id, actor_label, book_id, copy_id, delta, type, reason, ref_type, ref_id)
    values
      (v_actor, v_actor_label, new.book_id, new.id, v_delta, v_type, v_reason, v_ref_type, v_ref_id);

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
      (actor_id, actor_label, book_id, copy_id, delta, type, reason, ref_type, ref_id)
    values
      (v_actor, v_actor_label, new.book_id, new.id, v_delta, v_type, v_reason, v_ref_type, v_ref_id);
  end if;

  return null;
end;
$$;

drop trigger if exists trg_copies_inventory on public.copies;
create trigger trg_copies_inventory
  after insert or update of status on public.copies
  for each row execute function public.on_copy_inventory_change();

-- Reconcile existing rows once (seed may pre-date these triggers).
update public.books b
set total_copies = coalesce(agg.total, 0),
    available_copies = coalesce(agg.available, 0)
from (
  select book_id,
         count(*) filter (where status not in ('retired', 'lost')) as total,
         count(*) filter (where status = 'available') as available
  from public.copies
  group by book_id
) agg
where agg.book_id = b.id;

-- Books with no copies must be zero, not stale.
update public.books b
set total_copies = 0, available_copies = 0
where not exists (select 1 from public.copies c where c.book_id = b.id);

-- -----------------------------------------------------------------------------
-- 6. Barcode + ISBN helpers
-- -----------------------------------------------------------------------------
create or replace function public.next_copy_barcode(p_book_id uuid)
returns text
language plpgsql
volatile
as $$
declare
  v_base text;
  v_candidate text;
  v_i integer := 1;
begin
  select coalesce(nullif(isbn13, ''), 'CP-' || substring(id::text, 1, 8))
  into v_base
  from public.books
  where id = p_book_id;

  if v_base is null then
    raise exception 'Book % not found', p_book_id using errcode = '23503';
  end if;

  loop
    v_candidate := v_base || '-' || lpad(v_i::text, 2, '0');
    exit when not exists (select 1 from public.copies where barcode = v_candidate);
    v_i := v_i + 1;
  end loop;

  return v_candidate;
end;
$$;

create or replace function public.isbn13_valid(p_isbn text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_digits text;
  v_sum integer := 0;
  v_i integer;
begin
  v_digits := regexp_replace(coalesce(p_isbn, ''), '[^0-9Xx]', '', 'g');
  if length(v_digits) <> 13 then
    return false;
  end if;
  for v_i in 1..12 loop
    v_sum := v_sum + (substr(v_digits, v_i, 1)::integer * case when v_i % 2 = 1 then 1 else 3 end);
  end loop;
  return (10 - (v_sum % 10)) % 10 = substr(v_digits, 13, 1)::integer;
exception when others then
  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Actor guard + context helper
-- -----------------------------------------------------------------------------
create or replace function public.inventory_require_admin(p_actor_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_actor_id);
begin
  if v_actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_actor and role = 'admin' and status = 'active'
  ) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

create or replace function public.inventory_set_context(
  p_actor uuid,
  p_type text default null,
  p_reason text default null,
  p_ref_type text default null,
  p_ref_id uuid default null
)
returns void
language sql
as $$
  select set_config('app.inventory_actor', p_actor::text, true),
         set_config('app.inventory_type', coalesce(p_type, ''), true),
         set_config('app.inventory_reason', coalesce(p_reason, ''), true),
         set_config('app.inventory_ref_type', coalesce(p_ref_type, ''), true),
         set_config('app.inventory_ref_id', coalesce(p_ref_id::text, ''), true)
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC: save a book (new or edit) and optionally create copies
-- -----------------------------------------------------------------------------
create or replace function public.rpc_save_book(
  p_actor_id uuid,
  p_book jsonb,
  p_copies jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_book public.books%rowtype;
  v_id uuid;
  v_existing uuid;
  v_status text;
  v_collection text;
  v_copy jsonb;
  v_barcode text;
  v_condition text;
  v_shelf text;
  v_source text;
  v_copies jsonb;
  v_title text;
  v_authors text[];
  v_keywords text[];
begin
  v_actor := public.inventory_require_admin(p_actor_id);

  v_title := btrim(coalesce(p_book->>'title', ''));
  if v_title = '' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Title is required');
  end if;

  v_authors := array(
    select jsonb_array_elements_text(coalesce(p_book->'authors', '[]'::jsonb))
  );
  v_keywords := array(
    select jsonb_array_elements_text(coalesce(p_book->'keywords', '[]'::jsonb))
  );

  v_status := coalesce(nullif(p_book->>'status', ''), 'active');
  if v_status not in ('active', 'draft') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Book status must be active or draft');
  end if;

  v_collection := coalesce(nullif(p_book->>'collection', ''), 'standard');
  if v_collection not in ('standard', 'premium') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Collection must be standard or premium');
  end if;

  v_id := nullif(p_book->>'id', '')::uuid;

  if nullif(p_book->>'isbn13', '') is not null then
    select id into v_existing
    from public.books
    where isbn13 = nullif(p_book->>'isbn13', '')
      and (v_id is null or id <> v_id)
    limit 1;

    if v_existing is not null then
      return jsonb_build_object(
        'success', false,
        'reason', 'DUPLICATE',
        'message', 'This ISBN is already registered in the catalog.',
        'existing_book_id', v_existing
      );
    end if;
  end if;

  if v_id is null then
    insert into public.books (
      title, authors, isbn10, isbn13, publisher, year, language, category, field,
      description, toc, keywords, collection, replacement_price, shelf_location,
      cover_path, status
    ) values (
      v_title,
      v_authors,
      nullif(p_book->>'isbn10', ''),
      nullif(p_book->>'isbn13', ''),
      nullif(p_book->>'publisher', ''),
      nullif(p_book->>'year', '')::integer,
      nullif(p_book->>'language', ''),
      nullif(p_book->>'category', ''),
      nullif(p_book->>'field', ''),
      nullif(p_book->>'description', ''),
      nullif(p_book->>'toc', ''),
      v_keywords,
      v_collection,
      nullif(p_book->>'replacement_price', '')::integer,
      nullif(p_book->>'shelf_location', ''),
      nullif(p_book->>'cover_path', ''),
      v_status
    )
    returning * into v_book;
  else
    select * into v_book from public.books where id = v_id for update;
    if not found then
      return jsonb_build_object('success', false, 'reason', 'NOT_FOUND',
                                'message', 'Book not found');
    end if;

    update public.books
    set title = v_title,
        authors = case when p_book ? 'authors' then v_authors else authors end,
        isbn10 = nullif(p_book->>'isbn10', ''),
        isbn13 = nullif(p_book->>'isbn13', ''),
        publisher = nullif(p_book->>'publisher', ''),
        year = nullif(p_book->>'year', '')::integer,
        language = nullif(p_book->>'language', ''),
        category = nullif(p_book->>'category', ''),
        field = nullif(p_book->>'field', ''),
        description = nullif(p_book->>'description', ''),
        toc = nullif(p_book->>'toc', ''),
        keywords = case when p_book ? 'keywords' then v_keywords else keywords end,
        collection = v_collection,
        replacement_price = nullif(p_book->>'replacement_price', '')::integer,
        shelf_location = nullif(p_book->>'shelf_location', ''),
        cover_path = coalesce(nullif(p_book->>'cover_path', ''), cover_path),
        status = v_status,
        embedding_hash = case
          when v_book.title is distinct from v_title
            or v_book.authors is distinct from case when p_book ? 'authors' then v_authors else v_book.authors end
            or v_book.description is distinct from nullif(p_book->>'description', '')
            or v_book.keywords is distinct from case when p_book ? 'keywords' then v_keywords else v_book.keywords end
            or v_book.category is distinct from nullif(p_book->>'category', '')
          then null
          else embedding_hash
        end
    where id = v_id
    returning * into v_book;
  end if;

  perform public.inventory_set_context(
    v_actor,
    'manual_addition',
    case when v_id is null then 'Initial catalog registration' else 'Copy added to existing title' end,
    'book', v_book.id
  );

  for v_copy in select * from jsonb_array_elements(coalesce(p_copies, '[]'::jsonb)) loop
    v_condition := coalesce(nullif(v_copy->>'condition', ''), 'good');
    if v_condition not in ('good', 'fair', 'poor', 'damaged') then
      v_condition := 'good';
    end if;
    v_shelf := coalesce(nullif(v_copy->>'shelf_location', ''), v_book.shelf_location);
    v_source := coalesce(nullif(v_copy->>'source_type', ''), 'manual_addition');
    v_barcode := nullif(v_copy->>'barcode', '');
    if v_barcode is null or exists (select 1 from public.copies where barcode = v_barcode) then
      v_barcode := public.next_copy_barcode(v_book.id);
    end if;

    insert into public.copies (book_id, barcode, status, shelf_location, condition, source_type)
    values (v_book.id, v_barcode, 'available', v_shelf, v_condition, v_source);
  end loop;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb)
  into v_copies
  from public.copies c
  where c.book_id = v_book.id;

  select * into v_book from public.books where id = v_book.id;

  return jsonb_build_object(
    'success', true,
    'book', to_jsonb(v_book),
    'copies', v_copies
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. RPC: add copies to an existing title (FR-INV-01)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_add_copies(
  p_actor_id uuid,
  p_book_id uuid,
  p_copies jsonb,
  p_reason text default 'Copies added to existing title'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_book public.books%rowtype;
  v_copy jsonb;
  v_barcode text;
  v_condition text;
  v_shelf text;
  v_source text;
  v_created jsonb := '[]'::jsonb;
  v_row public.copies%rowtype;
begin
  v_actor := public.inventory_require_admin(p_actor_id);

  select * into v_book from public.books where id = p_book_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND', 'message', 'Book not found');
  end if;

  if jsonb_typeof(coalesce(p_copies, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_copies, '[]'::jsonb)) = 0 then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'At least one copy is required');
  end if;

  perform public.inventory_set_context(v_actor, 'manual_addition', p_reason, 'book', v_book.id);

  for v_copy in select * from jsonb_array_elements(p_copies) loop
    v_condition := coalesce(nullif(v_copy->>'condition', ''), 'good');
    if v_condition not in ('good', 'fair', 'poor', 'damaged') then
      v_condition := 'good';
    end if;
    v_shelf := coalesce(nullif(v_copy->>'shelf_location', ''), v_book.shelf_location);
    v_source := coalesce(nullif(v_copy->>'source_type', ''), 'manual_addition');
    v_barcode := nullif(v_copy->>'barcode', '');
    if v_barcode is null or exists (select 1 from public.copies where barcode = v_barcode) then
      v_barcode := public.next_copy_barcode(v_book.id);
    end if;

    insert into public.copies (book_id, barcode, status, shelf_location, condition, source_type)
    values (v_book.id, v_barcode, 'available', v_shelf, v_condition, v_source)
    returning * into v_row;

    v_created := v_created || to_jsonb(v_row);
  end loop;

  return jsonb_build_object('success', true, 'copies', v_created);
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. RPC: change a copy status in the Books → Copies surface (FR-INV-07)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_change_copy_status(
  p_actor_id uuid,
  p_copy_id uuid,
  p_target_status text,
  p_reason text,
  p_shelf_location text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_copy public.copies%rowtype;
  v_target text;
  v_type text := 'status_change';
  v_reservation public.reservations%rowtype;
  v_item public.loan_items%rowtype;
  v_receipt public.receipts%rowtype;
  v_actual text;
  v_reversal_number text;
begin
  v_actor := public.inventory_require_admin(p_actor_id);

  if coalesce(btrim(p_reason), '') = '' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'A mandatory reason is required for a status change');
  end if;

  select * into v_copy from public.copies where id = p_copy_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND', 'message', 'Copy not found');
  end if;

  v_target := lower(coalesce(p_target_status, ''));
  if v_target = 'found' then
    if v_copy.status <> 'lost' then
      return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                                'message', 'Only a lost copy can be resolved with Found');
    end if;
    v_target := 'available';
    v_type := 'found';
  end if;

  if v_target in ('borrowed', 'held') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'borrowed and held are set automatically by circulation, not manually');
  end if;

  if v_target not in ('available', 'damaged', 'under_repair', 'lost') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Target status must be available, damaged, under_repair, found, or lost');
  end if;

  if v_copy.status = 'retired' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'A retired copy is terminal; add a new copy instead');
  end if;

  if v_copy.status in ('borrowed', 'overdue') and v_target = 'lost' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'An on-loan copy is marked lost through the loan Lost workflow (FR-CIRC-05)');
  end if;

  if v_copy.status = 'held' and v_target = 'lost' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Release the hold first; a held copy cannot be set lost directly');
  end if;

  if v_copy.status = v_target then
    -- Shelf edits are still allowed without a status transaction.
    if nullif(btrim(p_shelf_location), '') is not null and p_shelf_location <> v_copy.shelf_location then
      update public.copies set shelf_location = p_shelf_location where id = v_copy.id;
    end if;
    return jsonb_build_object('success', true, 'copy_id', v_copy.id, 'status', v_copy.status,
                              'message', 'Status unchanged');
  end if;

  perform public.inventory_set_context(v_actor, v_type, btrim(p_reason), 'copy', v_copy.id);

  v_actual := v_target;

  -- A change to available triggers POL-07 promotion / wishlist logic.
  if v_target = 'available' then
    select * into v_reservation
    from public.reservations
    where book_id = v_copy.book_id
      and status = 'waiting'
    order by queue_position asc nulls last, created_at asc
    limit 1
    for update;

    if found then
      update public.reservations
      set status = 'ready_for_pickup',
          copy_id = v_copy.id,
          hold_until = app_now() + interval '48 hours',
          updated_at = app_now()
      where id = v_reservation.id;

      v_actual := 'held';
      update public.copies
      set status = 'held',
          shelf_location = coalesce(nullif(btrim(p_shelf_location), ''), shelf_location),
          held_for_type = 'reservation',
          held_for_id = v_reservation.id,
          held_until = app_now() + interval '48 hours',
          updated_at = app_now()
      where id = v_copy.id;
    else
      update public.copies
      set status = 'available',
          shelf_location = coalesce(nullif(btrim(p_shelf_location), ''), shelf_location),
          held_for_type = null,
          held_for_id = null,
          held_until = null,
          updated_at = app_now()
      where id = v_copy.id;
    end if;
  else
    update public.copies
    set status = v_target,
        shelf_location = coalesce(nullif(btrim(p_shelf_location), ''), shelf_location),
        held_for_type = case when v_copy.status = 'held' then null else held_for_type end,
        held_for_id = case when v_copy.status = 'held' then null else held_for_id end,
        held_until = case when v_copy.status = 'held' then null else held_until end,
        updated_at = app_now()
    where id = v_copy.id;
  end if;

  -- Path A lost resolution: restore the loan and waive/refund the replacement fee.
  if v_copy.status = 'lost' and v_actual in ('available', 'damaged', 'held') then
    select * into v_item
    from public.loan_items
    where copy_id = v_copy.id and status = 'lost'
    order by lost_at desc nulls last
    limit 1
    for update;

    if found then
      update public.loan_items
      set status = 'returned',
          returned_at = app_now(),
          lost_resolved_at = app_now(),
          updated_at = app_now()
      where id = v_item.id;

      -- Unpaid replacement charge is waived and the debt hold reduced.
      update public.charges
      set status = 'waived', updated_at = app_now()
      where loan_item_id = v_item.id and type = 'loss_fee' and status = 'unpaid';

      update public.profiles p
      set debt_outstanding = greatest(0, p.debt_outstanding - coalesce((
        select sum(amount) from public.charges
        where loan_item_id = v_item.id and type = 'loss_fee' and status = 'waived'
      ), 0)),
      updated_at = app_now()
      where p.id = v_item.uid;

      -- Paid replacement fee within the 90-day window gets a reversal receipt.
      select * into v_receipt
      from public.receipts
      where uid = v_item.uid
        and type in ('loss', 'loss_fee')
        and amount > 0
        and created_at >= app_now() - interval '90 days'
        and (ref_id = v_item.id or ref_id in (
          select id from public.charges where loan_item_id = v_item.id and type = 'loss_fee'
        ))
      order by created_at desc
      limit 1;

      if found and not exists (
        select 1 from public.receipts where reverses_receipt_id = v_receipt.id
      ) then
        v_reversal_number := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-RV' ||
                             upper(substring(gen_random_uuid()::text, 1, 4));
        insert into public.receipts
          (number, uid, amount, method, type, ref_type, ref_id, reverses_receipt_id,
           reason_code, notes, created_by_type, created_by_id)
        values
          (v_reversal_number, v_item.uid, -v_receipt.amount, v_receipt.method, 'reversal',
           'receipt', v_receipt.id, v_receipt.id, 'lost_returned',
           'Reversal: lost copy returned within 90 days', 'admin', v_actor);
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'copy_id', v_copy.id,
    'status', v_actual,
    'previous_status', v_copy.status,
    'transaction_type', v_type
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. RPC: bulk set collection (FR-INV-03)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_set_books_collection(
  p_actor_id uuid,
  p_book_ids uuid[],
  p_collection text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_count integer;
begin
  v_actor := public.inventory_require_admin(p_actor_id);

  if p_collection not in ('standard', 'premium') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Collection must be standard or premium');
  end if;

  if p_book_ids is null or array_length(p_book_ids, 1) = 0 then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Select at least one book');
  end if;

  update public.books
  set collection = p_collection
  where id = any(p_book_ids);

  get diagnostics v_count = row_count;
  return jsonb_build_object('success', true, 'updated', v_count, 'collection', p_collection);
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. RPC: CSV import (FR-INV-02)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_import_books(
  p_actor_id uuid,
  p_rows jsonb,
  p_duplicate_rule text default 'skip'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_row jsonb;
  v_book_id uuid;
  v_existing public.books%rowtype;
  v_count integer := 0;
  v_skipped integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_copies jsonb;
  v_ok integer := 0;
  v_copies_wanted integer;
  v_row_no integer;
  v_copy_no integer;
  v_isbn text;
  v_title text;
begin
  v_actor := public.inventory_require_admin(p_actor_id);

  if p_duplicate_rule not in ('skip', 'add_copies', 'update_metadata') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Duplicate rule must be skip, add_copies, or update_metadata');
  end if;

  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Rows must be an array');
  end if;

  perform public.inventory_set_context(v_actor, 'manual_addition', 'CSV catalog import', 'import', null);

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_row_no := coalesce((v_row->>'row')::integer, v_count + 1);
    v_count := v_count + 1;

    v_isbn := nullif(regexp_replace(coalesce(v_row->>'isbn13', ''), '[^0-9Xx]', '', 'g'), '');
    v_title := btrim(coalesce(v_row->>'title', ''));

    if v_title = '' then
      v_errors := v_errors || jsonb_build_object('row', v_row_no, 'reason', 'Title is required');
      continue;
    end if;

    if v_isbn is not null and not public.isbn13_valid(v_isbn) then
      v_errors := v_errors || jsonb_build_object('row', v_row_no, 'reason', 'Invalid ISBN-13 checksum');
      continue;
    end if;

    v_copies_wanted := greatest(0, coalesce((v_row->>'copies')::integer, 1));
    v_copies := '[]'::jsonb;
    for v_copy_no in 1..v_copies_wanted loop
      v_copies := v_copies || jsonb_build_object(
        'condition', coalesce(nullif(v_row->>'condition', ''), 'good'),
        'shelf_location', nullif(v_row->>'shelf_location', ''),
        'source_type', 'import'
      );
    end loop;

    v_existing := null;
    if v_isbn is not null then
      select * into v_existing from public.books where isbn13 = v_isbn limit 1;
    end if;

    if v_existing.id is not null then
      if p_duplicate_rule = 'skip' then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      if p_duplicate_rule = 'update_metadata' then
        update public.books
        set title = v_title,
            authors = coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'authors', '[]'::jsonb))), authors),
            publisher = coalesce(nullif(v_row->>'publisher', ''), publisher),
            year = coalesce(nullif(v_row->>'year', '')::integer, year),
            language = coalesce(nullif(v_row->>'language', ''), language),
            category = coalesce(nullif(v_row->>'category', ''), category),
            field = coalesce(nullif(v_row->>'field', ''), field),
            description = coalesce(nullif(v_row->>'description', ''), description),
            keywords = coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'keywords', '[]'::jsonb))), keywords),
            collection = coalesce(nullif(v_row->>'collection', ''), collection),
            replacement_price = coalesce(nullif(v_row->>'replacement_price', '')::integer, replacement_price),
            shelf_location = coalesce(nullif(v_row->>'shelf_location', ''), shelf_location),
            embedding_hash = null
        where id = v_existing.id;
      end if;

      if jsonb_array_length(v_copies) > 0 then
        perform public.rpc_add_copies(v_actor, v_existing.id, v_copies, 'CSV import top-up');
      end if;

      v_ok := v_ok + 1;
      continue;
    end if;

    -- New title
    perform public.rpc_save_book(
      v_actor,
      jsonb_build_object(
        'title', v_title,
        'authors', coalesce(v_row->'authors', '[]'::jsonb),
        'isbn10', nullif(v_row->>'isbn10', ''),
        'isbn13', v_isbn,
        'publisher', nullif(v_row->>'publisher', ''),
        'year', nullif(v_row->>'year', ''),
        'language', nullif(v_row->>'language', ''),
        'category', nullif(v_row->>'category', ''),
        'field', nullif(v_row->>'field', ''),
        'description', nullif(v_row->>'description', ''),
        'keywords', coalesce(v_row->'keywords', '[]'::jsonb),
        'collection', coalesce(nullif(v_row->>'collection', ''), 'standard'),
        'replacement_price', nullif(v_row->>'replacement_price', ''),
        'shelf_location', nullif(v_row->>'shelf_location', ''),
        'status', 'active'
      ),
      v_copies
    );

    v_ok := v_ok + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'imported', v_ok,
    'skipped', v_skipped,
    'errors', v_errors,
    'total', v_count
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 13. Write-off RPCs (FR-COND-02/03, UC-22)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_save_writeoff_slip(
  p_actor_id uuid,
  p_slip_id uuid default null,
  p_reason_code text default 'damaged_beyond_repair',
  p_notes text default null,
  p_copies jsonb default '[]'::jsonb,
  p_photos text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_slip public.writeoff_slips%rowtype;
  v_line jsonb;
  v_copy public.copies%rowtype;
  v_target text;
  v_copy_id uuid;
  v_rows jsonb;
begin
  v_actor := public.inventory_require_admin(p_actor_id);

  if p_reason_code not in ('damaged_beyond_repair', 'obsolete_edition', 'confirmed_missing') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Unknown write-off reason code');
  end if;

  if p_slip_id is null then
    insert into public.writeoff_slips
      (number, status, reason_code, notes, photos, created_by)
    values
      (public.next_writeoff_number(), 'draft', p_reason_code, p_notes, coalesce(p_photos, '{}'), v_actor)
    returning * into v_slip;
  else
    select * into v_slip from public.writeoff_slips where id = p_slip_id for update;
    if not found then
      return jsonb_build_object('success', false, 'reason', 'NOT_FOUND',
                                'message', 'Write-off slip not found');
    end if;
    if v_slip.status <> 'draft' then
      return jsonb_build_object('success', false, 'reason', 'PRECONDITION_FAILED',
                                'message', 'Only draft slips can be edited');
    end if;

    update public.writeoff_slips
    set reason_code = p_reason_code,
        notes = p_notes,
        photos = coalesce(p_photos, photos),
        updated_at = app_now()
    where id = v_slip.id
    returning * into v_slip;
  end if;

  delete from public.writeoff_slip_copies where slip_id = v_slip.id;

  for v_line in select * from jsonb_array_elements(coalesce(p_copies, '[]'::jsonb)) loop
    v_copy_id := nullif(v_line->>'copy_id', '')::uuid;
    v_target := coalesce(nullif(v_line->>'target_status', ''), 'retired');
    if v_target not in ('retired', 'lost') then
      return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                                'message', 'Target status must be retired or lost');
    end if;

    select * into v_copy from public.copies where id = v_copy_id;
    if not found then
      return jsonb_build_object('success', false, 'reason', 'NOT_FOUND',
                                'message', 'Copy not found');
    end if;

    if v_copy.status in ('borrowed', 'held') then
      if v_copy.status = 'borrowed' then
        return jsonb_build_object(
          'success', false,
          'reason', 'PRECONDITION_FAILED',
          'message', 'Copy ' || v_copy.barcode ||
                     ' is currently borrowed. On-loan copies cannot be written off via slip; process via loan Lost workflow.'
        );
      end if;
      return jsonb_build_object(
        'success', false,
        'reason', 'PRECONDITION_FAILED',
        'message', 'Copy ' || v_copy.barcode ||
                   ' is currently held for a reservation. Release or expire the hold before writing off.'
      );
    end if;

    insert into public.writeoff_slip_copies
      (slip_id, copy_id, target_status, assessment_note, photo_paths)
    values
      (v_slip.id, v_copy_id, v_target,
       nullif(v_line->>'assessment_note', ''),
       coalesce(array(select jsonb_array_elements_text(coalesce(v_line->'photo_paths', '[]'::jsonb))), '{}'))
    on conflict (slip_id, copy_id) do update
    set target_status = excluded.target_status,
        assessment_note = excluded.assessment_note,
        photo_paths = excluded.photo_paths;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', wc.id,
    'copy_id', wc.copy_id,
    'target_status', wc.target_status,
    'assessment_note', wc.assessment_note,
    'photo_paths', wc.photo_paths,
    'barcode', c.barcode,
    'status', c.status,
    'condition', c.condition,
    'shelf_location', c.shelf_location,
    'book_id', c.book_id,
    'book_title', b.title,
    'book_authors', b.authors
  ) order by wc.added_at), '[]'::jsonb)
  into v_rows
  from public.writeoff_slip_copies wc
  join public.copies c on c.id = wc.copy_id
  join public.books b on b.id = c.book_id
  where wc.slip_id = v_slip.id;

  return jsonb_build_object('success', true, 'slip', to_jsonb(v_slip), 'copies', v_rows);
end;
$$;

create or replace function public.rpc_complete_writeoff_slip(
  p_actor_id uuid,
  p_slip_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_slip public.writeoff_slips%rowtype;
  v_line record;
  v_copy public.copies%rowtype;
  v_book_id uuid;
  v_non_circulating boolean;
  v_cancelled integer := 0;
begin
  v_actor := public.inventory_require_admin(p_actor_id);

  select * into v_slip from public.writeoff_slips where id = p_slip_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND',
                              'message', 'Write-off slip not found');
  end if;
  if v_slip.status <> 'draft' then
    return jsonb_build_object('success', false, 'reason', 'PRECONDITION_FAILED',
                              'message', 'Only a draft slip can be completed');
  end if;
  if not exists (select 1 from public.writeoff_slip_copies where slip_id = v_slip.id) then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED',
                              'message', 'Stage at least one copy before completing the slip');
  end if;

  for v_line in
    select wc.*, c.barcode, c.status as copy_status, c.held_for_type
    from public.writeoff_slip_copies wc
    join public.copies c on c.id = wc.copy_id
    where wc.slip_id = v_slip.id
    order by c.id
    for update of c
  loop
    if v_line.copy_status in ('borrowed', 'held') then
      return jsonb_build_object(
        'success', false,
        'reason', 'PRECONDITION_FAILED',
        'message', 'Copy ' || v_line.barcode || ' is currently ' || v_line.copy_status ||
                   '. Remove it from the slip or release it first.'
      );
    end if;

    if v_line.copy_status not in ('available', 'damaged', 'under_repair', 'lost') then
      return jsonb_build_object(
        'success', false,
        'reason', 'PRECONDITION_FAILED',
        'message', 'Copy ' || v_line.barcode || ' cannot be written off from status ' || v_line.copy_status
      );
    end if;

    if v_slip.reason_code = 'damaged_beyond_repair'
       and coalesce(array_length(v_line.photo_paths, 1), 0) = 0
       and coalesce(array_length(v_slip.photos, 1), 0) = 0 then
      return jsonb_build_object(
        'success', false,
        'reason', 'VALIDATION_FAILED',
        'message', 'At least one photographic evidence file is mandatory for copy ' ||
                   v_line.barcode || ' under reason damaged_beyond_repair.'
      );
    end if;
  end loop;

  perform public.inventory_set_context(
    v_actor, 'write_off', v_slip.reason_code, 'writeoff_slip', v_slip.id
  );

  for v_line in
    select wc.*, c.book_id
    from public.writeoff_slip_copies wc
    join public.copies c on c.id = wc.copy_id
    where wc.slip_id = v_slip.id
  loop
    update public.copies
    set status = v_line.target_status,
        held_for_type = null,
        held_for_id = null,
        held_until = null,
        updated_at = app_now()
    where id = v_line.copy_id;
  end loop;

  update public.writeoff_slips
  set status = 'completed',
      completed_at = app_now(),
      updated_at = app_now()
  where id = v_slip.id
  returning * into v_slip;

  -- POL-07: cancel waiting reservations when the title is no longer circulating.
  for v_book_id in
    select distinct c.book_id
    from public.writeoff_slip_copies wc
    join public.copies c on c.id = wc.copy_id
    where wc.slip_id = v_slip.id
  loop
    select not exists (
      select 1 from public.copies
      where book_id = v_book_id and status not in ('retired', 'lost')
    ) into v_non_circulating;

    if v_non_circulating then
      update public.reservations
      set status = 'cancelled',
          cancellation_reason = 'book_not_circulating',
          outcome = 'cancelled_book_not_circulating',
          updated_at = app_now()
      where book_id = v_book_id and status = 'waiting';
      get diagnostics v_cancelled = row_count;

      update public.books
      set queue_length = (
        select count(*) from public.reservations
        where book_id = v_book_id and status in ('waiting', 'ready_for_pickup')
      )
      where id = v_book_id;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'slip', to_jsonb(v_slip),
    'cancelled_reservations', v_cancelled
  );
end;
$$;

create or replace function public.rpc_cancel_writeoff_slip(
  p_actor_id uuid,
  p_slip_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_slip public.writeoff_slips%rowtype;
begin
  v_actor := public.inventory_require_admin(p_actor_id);

  select * into v_slip from public.writeoff_slips where id = p_slip_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND',
                              'message', 'Write-off slip not found');
  end if;
  if v_slip.status <> 'draft' then
    return jsonb_build_object('success', false, 'reason', 'PRECONDITION_FAILED',
                              'message', 'Only draft slips can be cancelled');
  end if;

  update public.writeoff_slips
  set status = 'cancelled',
      cancelled_at = app_now(),
      cancellation_reason = p_reason,
      updated_at = app_now()
  where id = v_slip.id
  returning * into v_slip;

  return jsonb_build_object('success', true, 'slip', to_jsonb(v_slip));
end;
$$;

-- -----------------------------------------------------------------------------
-- 14. RPC: inventory history log (FR-INV-06, UC-26)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_inventory_history(
  p_actor_id uuid,
  p_q text default null,
  p_type_group text default 'all',
  p_start timestamptz default null,
  p_end timestamptz default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_total bigint;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 20000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform public.inventory_require_admin(p_actor_id);

  with filtered as (
    select it.*
    from public.inventory_transactions it
    join public.books b on b.id = it.book_id
    left join public.copies c on c.id = it.copy_id
    where (
      p_type_group is null or p_type_group in ('', 'all')
      or (p_type_group = 'batch_receipts' and it.type = 'batch_receipt')
      or (p_type_group = 'manual_additions' and it.type in ('manual_addition', 'found'))
      or (p_type_group = 'stock_reductions' and it.type in ('write_off', 'lost'))
      or (p_type_group = 'status_changes' and it.type = 'status_change')
    )
    and (p_start is null or it.at >= p_start)
    and (p_end is null or it.at <= p_end)
    and (
      v_q is null
      or b.title ilike '%' || v_q || '%'
      or b.isbn13 ilike '%' || v_q || '%'
      or b.isbn10 ilike '%' || v_q || '%'
      or c.barcode ilike '%' || v_q || '%'
      or exists (
        select 1 from unnest(b.authors) a where a ilike '%' || v_q || '%'
      )
    )
  )
  select count(*) into v_total from filtered;

  with filtered as (
    select it.*
    from public.inventory_transactions it
    join public.books b on b.id = it.book_id
    left join public.copies c on c.id = it.copy_id
    where (
      p_type_group is null or p_type_group in ('', 'all')
      or (p_type_group = 'batch_receipts' and it.type = 'batch_receipt')
      or (p_type_group = 'manual_additions' and it.type in ('manual_addition', 'found'))
      or (p_type_group = 'stock_reductions' and it.type in ('write_off', 'lost'))
      or (p_type_group = 'status_changes' and it.type = 'status_change')
    )
    and (p_start is null or it.at >= p_start)
    and (p_end is null or it.at <= p_end)
    and (
      v_q is null
      or b.title ilike '%' || v_q || '%'
      or b.isbn13 ilike '%' || v_q || '%'
      or b.isbn10 ilike '%' || v_q || '%'
      or c.barcode ilike '%' || v_q || '%'
      or exists (
        select 1 from unnest(b.authors) a where a ilike '%' || v_q || '%'
      )
    )
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      it.id,
      it.at,
      it.actor_id,
      it.actor_label,
      it.book_id,
      b.title as book_title,
      b.authors as book_authors,
      b.isbn13,
      b.isbn10,
      it.copy_id,
      c.barcode as copy_barcode,
      it.delta,
      it.type,
      it.reason,
      it.ref_type,
      it.ref_id,
      ws.number as writeoff_number,
      li.id as loan_item_id
    from filtered it
    join public.books b on b.id = it.book_id
    left join public.copies c on c.id = it.copy_id
    left join public.writeoff_slips ws
      on it.ref_type = 'writeoff_slip' and ws.id = it.ref_id
    left join public.loan_items li
      on it.ref_type = 'loan_item' and li.id = it.ref_id
    order by it.at desc
    limit v_limit offset v_offset
  ) x;

  return jsonb_build_object('success', true, 'rows', v_rows, 'total', v_total);
end;
$$;

-- -----------------------------------------------------------------------------
-- 15. RLS + grants (admin read; writes only through SECURITY DEFINER RPCs)
-- -----------------------------------------------------------------------------
alter table public.inventory_transactions enable row level security;
alter table public.writeoff_slips        enable row level security;
alter table public.writeoff_slip_copies enable row level security;

drop policy if exists inventory_transactions_admin_select on public.inventory_transactions;
create policy inventory_transactions_admin_select on public.inventory_transactions
  for select to authenticated
  using (public.is_admin());

drop policy if exists writeoff_slips_admin_select on public.writeoff_slips;
create policy writeoff_slips_admin_select on public.writeoff_slips
  for select to authenticated
  using (public.is_admin());

drop policy if exists writeoff_slip_copies_admin_select on public.writeoff_slip_copies;
create policy writeoff_slip_copies_admin_select on public.writeoff_slip_copies
  for select to authenticated
  using (public.is_admin());

grant select on public.inventory_transactions to authenticated;
grant select on public.writeoff_slips to authenticated;
grant select on public.writeoff_slip_copies to authenticated;

-- -----------------------------------------------------------------------------
-- 16. Storage policies for inventory evidence / covers / imports
-- -----------------------------------------------------------------------------
drop policy if exists shelfhelp_evidence_admin_all on storage.objects;
create policy shelfhelp_evidence_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'evidence' and public.is_admin())
  with check (bucket_id = 'evidence' and public.is_admin());

drop policy if exists shelfhelp_covers_admin_write on storage.objects;
create policy shelfhelp_covers_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and public.is_admin());

drop policy if exists shelfhelp_covers_admin_update on storage.objects;
create policy shelfhelp_covers_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'covers' and public.is_admin())
  with check (bucket_id = 'covers' and public.is_admin());

drop policy if exists shelfhelp_imports_admin_all on storage.objects;
create policy shelfhelp_imports_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'imports' and public.is_admin())
  with check (bucket_id = 'imports' and public.is_admin());
