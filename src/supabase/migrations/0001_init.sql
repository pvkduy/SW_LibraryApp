-- =============================================================================
-- ShelfHelp — 0001_init.sql
-- M0 Foundations (SRS §19 M0). Foundation only: extensions, helpers, and the
-- three tables the frontend needs. Later milestones add their own tables.
--
-- Source of truth: specs/SHELFHELP_FULLSPEC.md §4.17, §5, §10.4, §10.7, §12.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions (SRS §10.4)
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "unaccent";      -- diacritic stripping
create extension if not exists "pg_trgm";       -- typo tolerance
create extension if not exists "vector";        -- pgvector (embeddings)
create extension if not exists "pg_cron";       -- scheduled jobs
create extension if not exists "pg_net";        -- cron -> Edge Functions

-- -----------------------------------------------------------------------------
-- Test seam (NFR-16, SRS §10.6): app_now() returns now() unless
-- the session setting app.test_now is present.
-- -----------------------------------------------------------------------------
create or replace function app_now()
returns timestamptz
language plpgsql
stable
as $$
declare
  v_test text := current_setting('app.test_now', true);
begin
  if v_test is not null and v_test <> '' then
    return v_test::timestamptz;
  end if;
  return now();
end;
$$;

comment on function app_now() is
  'Injectabled "now" for tests. Set app.test_now to freeze time (NFR-16).';

-- -----------------------------------------------------------------------------
-- Search helpers (POL-17, SRS §10.4)
-- IMMUTABLE wrappers so they can be used in generated columns and indexes.
--
-- NOTE: unaccent(text) is only STABLE, so it cannot appear in a generated column.
-- The canonical workaround is a SQL wrapper that resolves the dictionary, then
-- declares itself IMMUTABLE. This is safe because the unaccent dictionary is
-- treated as constant configuration.
-- -----------------------------------------------------------------------------
create or replace function immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select regexp_replace(
    public.unaccent('public.unaccent'::regdictionary, $1),
    '\s+', ' ', 'g'
  )
$$;

-- array_to_string() is only STABLE, so it cannot appear in a generated column.
-- This wrapper declares itself IMMUTABLE (the conversion is deterministic).
create or replace function immutable_join(arr text[], sep text)
returns text
language sql
immutable
parallel safe
as $$ select array_to_string(arr, sep) $$;

-- NFC + lowercase + whitespace collapse. Tone-placement normalization is added
-- with the catalog milestone (it needs the shared cluster list from src/shared).
create or replace function normalize_vi_exact(text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select btrim(regexp_replace(lower(normalize($1, NFC)), '\s+', ' ', 'g'))
$$;

-- -----------------------------------------------------------------------------
-- Shared trigger: updated_at maintenance
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := app_now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Immutability guard (SRS §10.7). Applied to insert-only tables as they appear.
-- -----------------------------------------------------------------------------
create or replace function reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Table % is append-only: % is not permitted',
    tg_table_name, tg_op
    using errcode = '42501';
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles (SRS §12.1, §2.1, POL-02)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  role                  text not null default 'student'
                          check (role in ('student', 'admin')),
  status                text not null default 'pending_verification'
                          check (status in ('pending_verification', 'active', 'restricted', 'inactive')),
  full_name             text not null,
  email                 text not null,
  student_id            text,
  faculty               text,
  phone                 text,
  avatar_path           text,
  reservation_ban_until timestamptz,
  debt_outstanding      integer not null default 0 check (debt_outstanding >= 0),
  active_items          integer not null default 0 check (active_items >= 0),
  created_at            timestamptz not null default app_now(),
  updated_at            timestamptz not null default app_now()
);

-- unique case-insensitive email, unique student_id (POL-02)
create unique index if not exists profiles_email_lower_key
  on public.profiles (lower(email));
create unique index if not exists profiles_student_id_key
  on public.profiles (student_id) where student_id is not null;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- books (SRS §12.1, DEC-51)
-- -----------------------------------------------------------------------------
create table if not exists public.books (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  authors            text[] not null default '{}',
  isbn10             text,
  isbn13             text,
  publisher          text,
  year               integer,
  language           text,
  category           text,
  field              text,
  description        text,
  toc                text,
  keywords           text[] not null default '{}',
  collection         text not null default 'standard'
                       check (collection in ('standard', 'premium')),
  replacement_price  integer check (replacement_price is null or replacement_price >= 0),
  shelf_location     text,
  cover_path         text,
  status             text not null default 'draft'
                       check (status in ('active', 'draft')),
  -- denormalized counters (FR-INV-09), maintained by triggers in a later milestone
  total_copies       integer not null default 0 check (total_copies >= 0),
  available_copies   integer not null default 0 check (available_copies >= 0),
  queue_length       integer not null default 0 check (queue_length >= 0),
  wishlist_count     integer not null default 0 check (wishlist_count >= 0),
  borrow_count       integer not null default 0 check (borrow_count >= 0),
  rating_avg         numeric(3, 2),
  rating_count       integer not null default 0 check (rating_count >= 0),
  popularity_score   numeric(12, 4) not null default 0,
  -- search (POL-17): accent-insensitive recall vector
  -- Every function here must be IMMUTABLE for a generated column:
  --   * to_tsvector('simple', text) is STABLE -> use ('simple'::regconfig, text)
  --   * array_to_string() is STABLE           -> use immutable_join()
  --   * unaccent() is STABLE                  -> use immutable_unaccent()
  search_vector      tsvector generated always as (
                       to_tsvector('simple'::regconfig,
                         immutable_unaccent(
                           normalize_vi_exact(
                             coalesce(title, '') || ' ' ||
                             immutable_join(authors, ' ') || ' ' ||
                             immutable_join(keywords, ' ') || ' ' ||
                             coalesce(isbn13, '') || ' ' || coalesce(isbn10, '')
                           )
                         )
                       )
                     ) stored,
  embedding          vector(1536),
  embedding_hash     text,
  embedding_model    text,
  added_at           timestamptz not null default app_now(),
  updated_at         timestamptz not null default app_now()
);

create unique index if not exists books_isbn13_key on public.books (isbn13) where isbn13 is not null;
create index if not exists books_status_added_idx on public.books (status, added_at desc);
create index if not exists books_search_vector_idx on public.books using gin (search_vector);
create index if not exists books_title_trgm_idx on public.books using gin (title gin_trgm_ops);
create index if not exists books_authors_trgm_idx on public.books using gin (immutable_join(authors, ' ') gin_trgm_ops);

drop trigger if exists trg_books_updated_at on public.books;
create trigger trg_books_updated_at
  before update on public.books
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- copies (SRS §12.1, §5.4, DEC-35)
-- -----------------------------------------------------------------------------
create table if not exists public.copies (
  id           uuid primary key default gen_random_uuid(),
  book_id      uuid not null references public.books (id) on delete restrict,
  barcode      text not null,
  status       text not null default 'available'
                 check (status in ('available', 'held', 'borrowed', 'damaged', 'under_repair', 'lost', 'retired')),
  shelf_location text,
  condition    text not null default 'good'
                 check (condition in ('good', 'fair', 'poor', 'damaged')),
  source_type  text,
  source_ref   uuid,
  held_for_type text check (held_for_type is null or held_for_type in ('loan_item', 'reservation')),
  held_for_id  uuid,
  held_until   timestamptz,
  created_at   timestamptz not null default app_now(),
  updated_at   timestamptz not null default app_now()
);

create unique index if not exists copies_barcode_key on public.copies (barcode);
create index if not exists copies_book_status_idx on public.copies (book_id, status);

drop trigger if exists trg_copies_updated_at on public.copies;
create trigger trg_copies_updated_at
  before update on public.copies
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: enabled everywhere, deny by default (SRS §12.3, NFR-06)
-- A table with RLS enabled and no policy is unreadable.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.books    enable row level security;
alter table public.copies   enable row level security;

-- Helper: role from the JWT app_metadata claim (SRS §2.1, §12.3)
create or replace function auth_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'role',
    'student'
  )
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.auth_role() = 'admin' $$;

-- profiles: a student reads only their own row; admins read all.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or is_admin());

-- profiles: a student may update only the columns POL-02 allows.
-- Column-level restriction is enforced in addition to this row policy.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (full_name, phone, faculty, avatar_path) on public.profiles to authenticated;

-- books: signed-in users read active books; drafts are staff-only.
drop policy if exists books_select_active on public.books;
create policy books_select_active on public.books
  for select to authenticated
  using (status = 'active' or is_admin());

-- copies: readable when the parent book is visible.
drop policy if exists copies_select_visible on public.copies;
create policy copies_select_visible on public.copies
  for select to authenticated
  using (
    is_admin()
    or exists (
      select 1 from public.books b
      where b.id = copies.book_id and b.status = 'active'
    )
  );

-- NOTE: no INSERT/UPDATE/DELETE policies for client roles. All writes go through
-- Edge Functions using the service role (SRS §10.1, Constitution Principle VI).

-- -----------------------------------------------------------------------------
-- Grants: the embedding column is never exposed to client roles (§12.3)
-- -----------------------------------------------------------------------------
grant select on public.books to authenticated;
revoke select (embedding) on public.books from authenticated;
