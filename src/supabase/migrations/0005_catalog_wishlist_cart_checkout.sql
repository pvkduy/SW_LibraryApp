-- =============================================================================
-- ShelfHelp — 0005_catalog_wishlist_cart_checkout.sql
-- Features:
--   002-catalog-search  (FR-HOME-01, FR-SRCH-01..08, POL-17, R-05..R-09)
--   004-cart-checkout   (FR-CART-01..08, POL-04, POL-05, R-10, R-11, R-13)
--   Admin Books Screen  (Catalog CRUD, Physical Copies, Write-off Slips)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Books & Loan Items schema refinements
-- -----------------------------------------------------------------------------
alter table public.books
  add column if not exists pages integer check (pages is null or pages > 0);

-- Re-grant column SELECT since 0001_init.sql uses an explicit column grant list
grant select (pages) on public.books to authenticated;

-- Allow admins to insert/update books directly via RPCs (and select all columns)
drop policy if exists books_admin_all on public.books;
create policy books_admin_all on public.books
  for all to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists copies_admin_insert on public.copies;
create policy copies_admin_insert on public.copies
  for insert to authenticated
  with check (is_admin());

-- Expand loan_items status check to include cancelled and expired (FR-CART-07)
alter table public.loan_items drop constraint if exists loan_items_status_check;
alter table public.loan_items
  add constraint loan_items_status_check
  check (status in (
    'awaiting_payment', 'payment_failed', 'ready_for_pickup',
    'borrowed', 'returned', 'overdue', 'lost', 'cancelled', 'expired'
  ));

-- Unique idempotency key per user on loan_requests (FR-CART-03)
create unique index if not exists loan_requests_uid_idempotency_key
  on public.loan_requests (uid, idempotency_key)
  where idempotency_key is not null;

-- Enhance normalize_vi_exact with Vietnamese old/new tone placement clusters (POL-17)
create or replace function normalize_vi_exact(text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select btrim(
    regexp_replace(
      replace(replace(replace(replace(replace(
      replace(replace(replace(replace(replace(
      replace(replace(replace(replace(replace(
        lower(normalize($1, NFC)),
        'oà', 'òa'), 'oá', 'óa'), 'oả', 'ỏa'), 'oã', 'õa'), 'oạ', 'ọa'),
        'oè', 'òe'), 'oé', 'óe'), 'oẻ', 'ỏe'), 'oẽ', 'õe'), 'oẹ', 'ọe'),
        'uỳ', 'ùy'), 'uý', 'úy'), 'uỷ', 'ủy'), 'uỹ', 'ũy'), 'uỵ', 'ụy'),
      '\s+', ' ', 'g'
    )
  )
$$;

-- -----------------------------------------------------------------------------
-- 2. Automatic denormalized counters on books (copies & reviews)
-- -----------------------------------------------------------------------------
create or replace function public.sync_book_copy_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
begin
  v_book_id := coalesce(new.book_id, old.book_id);
  if v_book_id is not null then
    update public.books
    set total_copies = (
          select count(*) from public.copies
          where book_id = v_book_id and status <> 'retired'
        ),
        available_copies = (
          select count(*) from public.copies
          where book_id = v_book_id and status = 'available'
        ),
        updated_at = app_now()
    where id = v_book_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_copies_sync_book_counts on public.copies;
create trigger trg_copies_sync_book_counts
  after insert or update or delete on public.copies
  for each row execute function public.sync_book_copy_counts();

create or replace function public.sync_book_rating_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
begin
  v_book_id := coalesce(new.book_id, old.book_id);
  if v_book_id is not null then
    update public.books
    set rating_count = (select count(*) from public.book_reviews where book_id = v_book_id),
        rating_avg = (select round(avg(rating)::numeric, 2) from public.book_reviews where book_id = v_book_id),
        updated_at = app_now()
    where id = v_book_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reviews_sync_book_rating on public.book_reviews;
create trigger trg_reviews_sync_book_rating
  after insert or update or delete on public.book_reviews
  for each row execute function public.sync_book_rating_stats();

-- -----------------------------------------------------------------------------
-- 3. wishlists (FR-SRCH-06)
-- -----------------------------------------------------------------------------
create table if not exists public.wishlists (
  id         uuid primary key default gen_random_uuid(),
  uid        uuid not null references public.profiles(id) on delete cascade,
  book_id    uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default app_now(),
  constraint uq_wishlists_uid_book unique (uid, book_id)
);

create index if not exists wishlists_uid_idx on public.wishlists (uid, created_at desc);
create index if not exists wishlists_book_idx on public.wishlists (book_id);

alter table public.wishlists enable row level security;

drop policy if exists wishlists_own_all on public.wishlists;
create policy wishlists_own_all on public.wishlists
  for all to authenticated
  using (uid = auth.uid() or is_admin())
  with check (uid = auth.uid());

-- -----------------------------------------------------------------------------
-- 4. cart_items (FR-CART-01, FR-CART-02)
-- -----------------------------------------------------------------------------
create table if not exists public.cart_items (
  id                uuid primary key default gen_random_uuid(),
  uid               uuid not null references public.profiles(id) on delete cascade,
  book_id           uuid not null references public.books(id) on delete cascade,
  preferred_copy_id uuid references public.copies(id) on delete set null,
  duration_days     integer not null default 7 check (duration_days in (7, 14)),
  created_at        timestamptz not null default app_now(),
  updated_at        timestamptz not null default app_now(),
  constraint uq_cart_items_uid_book unique (uid, book_id)
);

create index if not exists cart_items_uid_idx on public.cart_items (uid, created_at asc);

drop trigger if exists trg_cart_items_updated_at on public.cart_items;
create trigger trg_cart_items_updated_at
  before update on public.cart_items
  for each row execute function set_updated_at();

alter table public.cart_items enable row level security;

drop policy if exists cart_items_own_all on public.cart_items;
create policy cart_items_own_all on public.cart_items
  for all to authenticated
  using (uid = auth.uid() or is_admin())
  with check (uid = auth.uid());

-- -----------------------------------------------------------------------------
-- 5. payments (FR-CART-05, FR-CART-06)
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  uid             uuid not null references public.profiles(id) on delete cascade,
  request_id      uuid references public.loan_requests(id) on delete set null,
  purpose         text not null default 'borrow_fee'
                    check (purpose in ('borrow_fee', 'fine', 'membership')),
  amount          integer not null check (amount >= 0),
  method          text not null default 'mobile_banking'
                    check (method in ('mobile_banking', 'card', 'counter', 'online')),
  status          text not null default 'pending'
                    check (status in ('pending', 'succeeded', 'failed', 'refunded', 'expired', 'cancelled')),
  provider        text not null default 'simulated',
  reference_code  text,
  deadline        timestamptz,
  idempotency_key text,
  created_at      timestamptz not null default app_now(),
  updated_at      timestamptz not null default app_now()
);

create index if not exists payments_uid_idx on public.payments (uid, created_at desc);
create unique index if not exists payments_idempotency_key_idx
  on public.payments (idempotency_key)
  where idempotency_key is not null;

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function set_updated_at();

alter table public.payments enable row level security;

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select to authenticated
  using (uid = auth.uid() or is_admin());

-- -----------------------------------------------------------------------------
-- 6. write_off_slips (Admin Books Screen — Write-off)
-- -----------------------------------------------------------------------------
create table if not exists public.write_off_slips (
  id                    uuid primary key default gen_random_uuid(),
  slip_number           text not null unique,
  copy_id               uuid not null references public.copies(id) on delete restrict,
  book_id               uuid not null references public.books(id) on delete restrict,
  reason                text not null check (reason in ('damaged', 'lost', 'obsolete', 'water_damage', 'missing_pages')),
  condition_at_writeoff text not null default 'damaged',
  notes                 text,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default app_now()
);

create index if not exists write_off_slips_created_idx on public.write_off_slips (created_at desc);

alter table public.write_off_slips enable row level security;

drop policy if exists write_off_slips_admin_all on public.write_off_slips;
create policy write_off_slips_admin_all on public.write_off_slips
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- -----------------------------------------------------------------------------
-- 7. RPC: rpc_search_books (FR-SRCH-01..04, POL-17)
-- Accent-exact Vietnamese ranking, ISBN exact match, typo tolerance, filters, sort
-- -----------------------------------------------------------------------------
create or replace function public.rpc_search_books(
  p_query          text default null,
  p_category       text default null,
  p_field          text default null,
  p_collection     text default null,
  p_language       text default null,
  p_year_min       integer default null,
  p_year_max       integer default null,
  p_available_only boolean default false,
  p_sort           text default 'relevance',
  p_limit          integer default 20,
  p_offset         integer default 0
)
returns table (
  id                uuid,
  title             text,
  authors           text[],
  isbn10            text,
  isbn13            text,
  publisher         text,
  year              integer,
  pages             integer,
  language          text,
  category          text,
  field             text,
  description       text,
  collection        text,
  replacement_price integer,
  shelf_location    text,
  cover_path        text,
  status            text,
  total_copies      integer,
  available_copies  integer,
  queue_length      integer,
  wishlist_count    integer,
  borrow_count      integer,
  rating_avg        numeric,
  rating_count      integer,
  popularity_score  numeric,
  added_at          timestamptz,
  match_rank        numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_q_raw    text := btrim(coalesce(p_query, ''));
  v_q_exact  text := normalize_vi_exact(coalesce(p_query, ''));
  v_q_unacc  text := immutable_unaccent(normalize_vi_exact(coalesce(p_query, '')));
  v_q_isbn   text := regexp_replace(upper(coalesce(p_query, '')), '[-\s]', '', 'g');
  v_tsq      tsquery;
begin
  if v_q_unacc <> '' then
    v_tsq := plainto_tsquery('simple'::regconfig, v_q_unacc);
  end if;

  return query
  with scored as (
    select
      b.id, b.title, b.authors, b.isbn10, b.isbn13, b.publisher, b.year, b.pages,
      b.language, b.category, b.field, b.description, b.collection,
      b.replacement_price, b.shelf_location, b.cover_path, b.status,
      b.total_copies, b.available_copies, b.queue_length, b.wishlist_count,
      b.borrow_count, b.rating_avg, b.rating_count, b.popularity_score, b.added_at,
      (
        case
          when v_q_raw = '' then 1.0::numeric
          -- Exact ISBN match always ranks #1 (FR-SRCH-01)
          when v_q_isbn <> '' and (
            regexp_replace(upper(coalesce(b.isbn13, '')), '[-\s]', '', 'g') = v_q_isbn
            or regexp_replace(upper(coalesce(b.isbn10, '')), '[-\s]', '', 'g') = v_q_isbn
          ) then 1000.0::numeric
          else
            -- Accent-exact match ranks highest (POL-17: hóa > hoa > họa)
            (case when normalize_vi_exact(b.title) like '%' || v_q_exact || '%' then 500.0 else 0.0 end)
            + (case when normalize_vi_exact(immutable_join(b.authors, ' ')) like '%' || v_q_exact || '%' then 350.0 else 0.0 end)
            -- Accent-insensitive FTS / substring recall
            + (case when v_tsq is not null and b.search_vector @@ v_tsq then 150.0 + (ts_rank(b.search_vector, v_tsq) * 50.0) else 0.0 end)
            + (case when immutable_unaccent(normalize_vi_exact(b.title)) like '%' || v_q_unacc || '%' then 100.0 else 0.0 end)
            + (case when immutable_unaccent(normalize_vi_exact(immutable_join(b.authors, ' '))) like '%' || v_q_unacc || '%' then 80.0 else 0.0 end)
            -- Typo tolerance via pg_trgm similarity
            + (greatest(
                similarity(immutable_unaccent(normalize_vi_exact(b.title)), v_q_unacc),
                similarity(immutable_unaccent(normalize_vi_exact(immutable_join(b.authors, ' '))), v_q_unacc)
              ) * 60.0)
        end
      )::numeric as score
    from public.books b
    where b.status = 'active'
      and (p_category is null or p_category = '' or p_category = 'All' or lower(coalesce(b.category, '')) = lower(p_category))
      and (p_field is null or p_field = '' or lower(coalesce(b.field, '')) = lower(p_field))
      and (p_collection is null or p_collection = '' or b.collection = p_collection)
      and (p_language is null or p_language = '' or lower(coalesce(b.language, '')) = lower(p_language))
      and (p_year_min is null or b.year >= p_year_min)
      and (p_year_max is null or b.year <= p_year_max)
      and (not p_available_only or b.available_copies > 0)
      and (
        v_q_raw = ''
        or (v_q_isbn <> '' and (
          regexp_replace(upper(coalesce(b.isbn13, '')), '[-\s]', '', 'g') = v_q_isbn
          or regexp_replace(upper(coalesce(b.isbn10, '')), '[-\s]', '', 'g') = v_q_isbn
        ))
        or (v_tsq is not null and b.search_vector @@ v_tsq)
        or immutable_unaccent(normalize_vi_exact(b.title)) like '%' || v_q_unacc || '%'
        or immutable_unaccent(normalize_vi_exact(immutable_join(b.authors, ' '))) like '%' || v_q_unacc || '%'
        or similarity(immutable_unaccent(normalize_vi_exact(b.title)), v_q_unacc) >= 0.25
        or similarity(immutable_unaccent(normalize_vi_exact(immutable_join(b.authors, ' '))), v_q_unacc) >= 0.25
      )
  )
  select
    s.id, s.title, s.authors, s.isbn10, s.isbn13, s.publisher, s.year, s.pages,
    s.language, s.category, s.field, s.description, s.collection,
    s.replacement_price, s.shelf_location, s.cover_path, s.status,
    s.total_copies, s.available_copies, s.queue_length, s.wishlist_count,
    s.borrow_count, s.rating_avg, s.rating_count, s.popularity_score, s.added_at,
    s.score as match_rank
  from scored s
  order by
    case when p_sort = 'relevance' and v_q_raw <> '' then s.score else 0 end desc,
    case when p_sort = 'rating' then coalesce(s.rating_avg, 0) else 0 end desc,
    case when p_sort = 'rating' then s.rating_count else 0 end desc,
    case when p_sort = 'popularity' then s.popularity_score else 0 end desc,
    case when p_sort = 'popularity' then s.borrow_count else 0 end desc,
    case when p_sort = 'recency' then extract(epoch from s.added_at) else 0 end desc,
    s.popularity_score desc,
    s.added_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC: rpc_toggle_wishlist (FR-SRCH-06, max 50)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_toggle_wishlist(p_book_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exists boolean;
  v_count integer;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'reason', 'UNAUTHENTICATED', 'message', 'Please sign in first.');
  end if;

  select exists (
    select 1 from public.wishlists where uid = v_uid and book_id = p_book_id
  ) into v_exists;

  if v_exists then
    delete from public.wishlists where uid = v_uid and book_id = p_book_id;
    update public.books set wishlist_count = greatest(0, wishlist_count - 1) where id = p_book_id;
    return jsonb_build_object('success', true, 'wishlisted', false, 'message', 'Removed from Wishlist.');
  end if;

  select count(*) into v_count from public.wishlists where uid = v_uid;
  if v_count >= 50 then
    return jsonb_build_object(
      'success', false,
      'reason', 'WISHLIST_FULL',
      'message', 'Wishlist limit reached (maximum 50 books). Please remove an item first.'
    );
  end if;

  insert into public.wishlists (uid, book_id) values (v_uid, p_book_id) on conflict do nothing;
  update public.books set wishlist_count = wishlist_count + 1 where id = p_book_id;

  return jsonb_build_object('success', true, 'wishlisted', true, 'message', 'Saved to Wishlist!');
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. RPC: rpc_reserve_book (Reserve when 0 available copies, FR-SRCH-05)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_reserve_book(p_book_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile record;
  v_book record;
  v_queue_count integer;
  v_res_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'reason', 'UNAUTHENTICATED', 'message', 'Please sign in first.');
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.status <> 'active' then
    return jsonb_build_object('success', false, 'reason', 'ACCOUNT_RESTRICTED', 'message', 'Your account is not active.');
  end if;
  if v_profile.debt_outstanding > 0 then
    return jsonb_build_object('success', false, 'reason', 'DEBT_HOLD', 'message', 'Please settle your outstanding fees first.');
  end if;

  select * into v_book from public.books where id = p_book_id and status = 'active';
  if not found then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND', 'message', 'Book not found.');
  end if;

  if exists (
    select 1 from public.reservations
    where uid = v_uid and book_id = p_book_id and status in ('waiting', 'ready_for_pickup')
  ) then
    return jsonb_build_object('success', false, 'reason', 'DUPLICATE', 'message', 'You already have an active reservation for this book.');
  end if;

  select count(*) into v_queue_count
  from public.reservations
  where book_id = p_book_id and status = 'waiting';

  if v_queue_count >= 5 then
    return jsonb_build_object('success', false, 'reason', 'QUEUE_FULL', 'message', 'Reservation queue is full (max 5 readers).');
  end if;

  insert into public.reservations (uid, book_id, status, queue_position)
  values (v_uid, p_book_id, 'waiting', v_queue_count + 1)
  returning id into v_res_id;

  update public.books set queue_length = queue_length + 1 where id = p_book_id;

  return jsonb_build_object(
    'success', true,
    'reservation_id', v_res_id,
    'queue_position', v_queue_count + 1,
    'message', 'Added to reservation queue (Position #' || (v_queue_count + 1) || ').'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. RPC: rpc_checkout_cart (FR-CART-03..08, SC-001..003)
-- Atomic checkout with FOR UPDATE SKIP LOCKED, idempotency, receipts & pickup QR
-- -----------------------------------------------------------------------------
create or replace function public.rpc_checkout_cart(
  p_items            jsonb,
  p_payment_method   text default 'mobile_banking',
  p_idempotency_key  text default null,
  p_simulate_failure boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid             uuid := auth.uid();
  v_profile         record;
  v_existing_req    record;
  v_item_in         jsonb;
  v_book_id         uuid;
  v_pref_copy_id    uuid;
  v_duration        integer;
  v_book            record;
  v_copy            record;
  v_active_count    integer;
  v_max_items       integer := 3;
  v_req_count       integer;
  v_line_fee        integer;
  v_total_fee       integer := 0;
  v_request_id      uuid;
  v_pickup_code     text;
  v_ref_id          text;
  v_payment_id      uuid;
  v_loan_item_id    uuid;
  v_item_status     text;
  v_receipt_method  text;
  v_receipt_no      text;
  v_pickup_location text := 'Main Library Circulation Desk';
  v_line_errors     jsonb := '[]'::jsonb;
  v_created_items   jsonb := '[]'::jsonb;
  v_locked_copies   jsonb := '[]'::jsonb;
  v_entry           jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'reason', 'UNAUTHENTICATED', 'message', 'Please sign in to checkout.');
  end if;

  -- Idempotency check (FR-CART-03)
  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select * into v_existing_req
    from public.loan_requests
    where uid = v_uid and idempotency_key = p_idempotency_key;

    if found then
      return jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'request_id', v_existing_req.id,
        'pickup_code', v_existing_req.pickup_code,
        'reference_id', 'RSH-' || right(v_existing_req.pickup_code, 6),
        'timestamp', v_existing_req.created_at
      );
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED', 'message', 'Your cart is empty.');
  end if;

  -- 1. Validate reader standing & gating (FR-CART-03)
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found or v_profile.status <> 'active' then
    return jsonb_build_object(
      'success', false,
      'reason', case when v_profile.status = 'restricted' then 'ACCOUNT_RESTRICTED' else 'ACCOUNT_NOT_ACTIVE' end,
      'message', 'Your account is currently ' || coalesce(v_profile.status, 'inactive') || '. Borrowing is disabled.'
    );
  end if;

  if v_profile.debt_outstanding > 0 then
    return jsonb_build_object(
      'success', false,
      'reason', 'DEBT_HOLD',
      'message', 'Please settle your outstanding debt (' || v_profile.debt_outstanding || ' VND) before borrowing.'
    );
  end if;

  -- Count currently active items (borrowed, overdue, ready_for_pickup, awaiting_payment)
  select count(*) into v_active_count
  from public.loan_items
  where uid = v_uid
    and status in ('awaiting_payment', 'payment_failed', 'ready_for_pickup', 'borrowed', 'overdue');

  v_req_count := jsonb_array_length(p_items);
  if v_active_count + v_req_count > v_max_items then
    return jsonb_build_object(
      'success', false,
      'reason', 'LIMIT_REACHED',
      'message', 'You have reached your limit of ' || v_max_items || ' active items (currently ' || v_active_count || ').'
    );
  end if;

  -- 2. Validate & atomically lock one available copy per line (FOR UPDATE SKIP LOCKED)
  for v_item_in in select * from jsonb_array_elements(p_items)
  loop
    v_book_id := (v_item_in ->> 'book_id')::uuid;
    v_pref_copy_id := nullif(v_item_in ->> 'preferred_copy_id', '')::uuid;
    v_duration := greatest(7, least(14, coalesce((v_item_in ->> 'duration_days')::integer, 7)));

    select * into v_book from public.books where id = v_book_id and status = 'active';
    if not found then
      v_line_errors := v_line_errors || jsonb_build_object(
        'book_id', v_book_id, 'reason', 'NOT_FOUND', 'message', 'Book is no longer in the catalog.'
      );
      continue;
    end if;

    -- Prevent duplicate active loan/request for the same book (FR-CART-01)
    if exists (
      select 1 from public.loan_items
      where uid = v_uid and book_id = v_book_id
        and status in ('awaiting_payment', 'payment_failed', 'ready_for_pickup', 'borrowed', 'overdue')
    ) then
      v_line_errors := v_line_errors || jsonb_build_object(
        'book_id', v_book_id, 'reason', 'DUPLICATE_ACTIVE_LOAN', 'message', v_book.title || ' is already in your active loans.'
      );
      continue;
    end if;

    -- Lock preferred copy first if available, else pick lowest barcode available copy
    v_copy := null;
    if v_pref_copy_id is not null then
      select * into v_copy
      from public.copies
      where id = v_pref_copy_id and book_id = v_book_id and status = 'available'
      for update skip locked;
    end if;

    if v_copy.id is null then
      select * into v_copy
      from public.copies
      where book_id = v_book_id and status = 'available'
      order by barcode asc
      limit 1
      for update skip locked;
    end if;

    if v_copy.id is null then
      v_line_errors := v_line_errors || jsonb_build_object(
        'book_id', v_book_id, 'reason', 'NOT_AVAILABLE', 'message', v_book.title || ' is no longer available.'
      );
      continue;
    end if;

    -- Calculate fee (POL-05: 5,000 VND per 7 days for non-member Premium)
    v_line_fee := case
      when v_book.collection = 'premium' then ceil(v_duration::numeric / 7.0)::integer * 5000
      else 0
    end;
    v_total_fee := v_total_fee + v_line_fee;

    if v_copy.shelf_location is not null and v_copy.shelf_location <> '' then
      v_pickup_location := v_copy.shelf_location;
    end if;

    v_locked_copies := v_locked_copies || jsonb_build_object(
      'book_id', v_book.id,
      'title', v_book.title,
      'collection', v_book.collection,
      'copy_id', v_copy.id,
      'barcode', v_copy.barcode,
      'shelf_location', coalesce(v_copy.shelf_location, v_book.shelf_location, 'Circulation Desk'),
      'duration_days', v_duration,
      'fee', v_line_fee
    );
  end loop;

  -- Atomic rejection: if any line failed, keep cart intact and return per-line errors (SC-002)
  if jsonb_array_length(v_line_errors) > 0 then
    return jsonb_build_object(
      'success', false,
      'reason', 'NOT_AVAILABLE',
      'message', 'Some items in your cart could not be checked out.',
      'line_errors', v_line_errors
    );
  end if;

  -- 3. Create Loan Request with 6-digit pickup code (FR-CART-08)
  v_pickup_code := lpad((floor(random() * 900000) + 100000)::integer::text, 6, '0');
  v_ref_id := 'RSH-' || v_pickup_code;

  insert into public.loan_requests (uid, pickup_code, status, idempotency_key)
  values (v_uid, v_pickup_code, 'pending', nullif(btrim(coalesce(p_idempotency_key, '')), ''))
  returning id into v_request_id;

  -- 4. Handle Payment record if total fee > 0 (FR-CART-05, FR-CART-06)
  v_receipt_method := case p_payment_method
    when 'card' then 'card'
    when 'counter' then 'counter'
    else 'transfer'
  end;

  if v_total_fee > 0 then
    insert into public.payments (
      uid, request_id, purpose, amount, method, status, provider, reference_code, deadline, idempotency_key
    )
    values (
      v_uid,
      v_request_id,
      'borrow_fee',
      v_total_fee,
      case when p_payment_method in ('mobile_banking', 'card', 'counter', 'online') then p_payment_method else 'mobile_banking' end,
      case
        when p_payment_method = 'counter' then 'pending'
        when p_simulate_failure then 'failed'
        else 'succeeded'
      end,
      'simulated',
      v_ref_id,
      case
        when p_payment_method = 'counter' then app_now() + interval '48 hours'
        else app_now() + interval '30 minutes'
      end,
      nullif(btrim(coalesce(p_idempotency_key, '')), '')
    )
    returning id into v_payment_id;

    update public.loan_requests set payment_id = v_payment_id where id = v_request_id;
  end if;

  -- 5. Hold copies, create Loan Items, and emit receipts (one per paid line, SC-003)
  for v_entry in select * from jsonb_array_elements(v_locked_copies)
  loop
    v_line_fee := (v_entry ->> 'fee')::integer;
    v_item_status := case
      when v_line_fee = 0 then 'ready_for_pickup'
      when p_payment_method = 'counter' then 'awaiting_payment'
      when p_simulate_failure then 'payment_failed'
      else 'ready_for_pickup'
    end;

    insert into public.loan_items (
      request_id, uid, book_id, copy_id, source, status, is_premium, fee, duration_days,
      payment_deadline, pickup_deadline, created_at, updated_at
    )
    values (
      v_request_id,
      v_uid,
      (v_entry ->> 'book_id')::uuid,
      (v_entry ->> 'copy_id')::uuid,
      'cart',
      v_item_status,
      (v_entry ->> 'collection') = 'premium',
      v_line_fee,
      (v_entry ->> 'duration_days')::integer,
      case when v_item_status in ('awaiting_payment', 'payment_failed') then app_now() + interval '30 minutes' else null end,
      app_now() + interval '48 hours',
      app_now(),
      app_now()
    )
    returning id into v_loan_item_id;

    -- Hold physical copy atomically
    update public.copies
    set status = 'held',
        held_for_type = 'loan_item',
        held_for_id = v_loan_item_id,
        held_until = app_now() + interval '48 hours',
        updated_at = app_now()
    where id = (v_entry ->> 'copy_id')::uuid;

    -- Emit immutable receipt for each online-paid line (SC-003)
    if v_line_fee > 0 and p_payment_method <> 'counter' and not p_simulate_failure then
      v_receipt_no := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
      insert into public.receipts (
        number, uid, amount, method, type, ref_type, ref_id, notes, created_by_type
      )
      values (
        v_receipt_no, v_uid, v_line_fee, v_receipt_method, 'borrow_fee',
        'loan_item', v_loan_item_id,
        'Borrow fee for ' || (v_entry ->> 'title') || ' (' || (v_entry ->> 'barcode') || ')',
        'system'
      );
    end if;

    -- Increment borrow count
    update public.books
    set borrow_count = borrow_count + 1,
        popularity_score = popularity_score + 1
    where id = (v_entry ->> 'book_id')::uuid;

    v_created_items := v_created_items || jsonb_build_object(
      'loan_item_id', v_loan_item_id,
      'book_id', v_entry ->> 'book_id',
      'title', v_entry ->> 'title',
      'barcode', v_entry ->> 'barcode',
      'status', v_item_status,
      'fee', v_line_fee,
      'duration_days', (v_entry ->> 'duration_days')::integer
    );
  end loop;

  -- Clear user's persistent cart
  delete from public.cart_items where uid = v_uid;

  return jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'payment_id', v_payment_id,
    'payment_status', case
      when v_total_fee = 0 then 'free'
      when p_payment_method = 'counter' then 'counter_pending'
      when p_simulate_failure then 'failed'
      else 'succeeded'
    end,
    'pickup_code', v_pickup_code,
    'reference_id', v_ref_id,
    'timestamp', app_now(),
    'patron_name', v_profile.full_name,
    'student_id', v_profile.student_id,
    'pickup_location', v_pickup_location,
    'payment_method', p_payment_method,
    'total_amount', v_total_fee,
    'items', v_created_items
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. RPC: rpc_complete_simulated_payment (FR-CART-06)
-- Retry / switch-to-counter / cancel for failed or pending simulated payments
-- -----------------------------------------------------------------------------
create or replace function public.rpc_complete_simulated_payment(
  p_payment_id uuid,
  p_outcome    text -- 'succeed' | 'fail' | 'switch_counter' | 'cancel'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_payment    record;
  v_item       record;
  v_receipt_no text;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'reason', 'UNAUTHENTICATED', 'message', 'Please sign in first.');
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.uid <> v_uid then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND', 'message', 'Payment not found.');
  end if;

  if v_payment.status = 'succeeded' then
    return jsonb_build_object('success', true, 'idempotent_replay', true, 'status', 'succeeded');
  end if;

  if v_payment.deadline is not null and v_payment.deadline < app_now() and p_outcome = 'succeed' then
    update public.payments set status = 'expired' where id = p_payment_id;
    return jsonb_build_object('success', false, 'reason', 'PAYMENT_EXPIRED', 'message', 'Payment window has expired.');
  end if;

  if p_outcome = 'succeed' then
    update public.payments set status = 'succeeded', updated_at = app_now() where id = p_payment_id;
    for v_item in
      select li.*, b.title, c.barcode
      from public.loan_items li
      join public.books b on b.id = li.book_id
      left join public.copies c on c.id = li.copy_id
      where li.request_id = v_payment.request_id and li.fee > 0
    loop
      update public.loan_items
      set status = 'ready_for_pickup', pickup_deadline = app_now() + interval '48 hours', updated_at = app_now()
      where id = v_item.id;

      v_receipt_no := 'RCP-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
      insert into public.receipts (number, uid, amount, method, type, ref_type, ref_id, notes, created_by_type)
      values (
        v_receipt_no, v_uid, v_item.fee,
        case when v_payment.method = 'card' then 'card' else 'transfer' end,
        'borrow_fee', 'loan_item', v_item.id,
        'Simulated payment retry for ' || v_item.title, 'system'
      );
    end loop;
    return jsonb_build_object('success', true, 'status', 'succeeded', 'message', 'Payment completed! Items are ready for pickup.');
  elsif p_outcome = 'switch_counter' then
    update public.payments set method = 'counter', status = 'pending', deadline = app_now() + interval '48 hours' where id = p_payment_id;
    update public.loan_items
    set status = 'awaiting_payment', payment_deadline = app_now() + interval '48 hours'
    where request_id = v_payment.request_id and status = 'payment_failed';
    return jsonb_build_object('success', true, 'status', 'counter_pending', 'message', 'Switched to Cash At Counter (48h window).');
  elsif p_outcome = 'fail' then
    update public.payments set status = 'failed' where id = p_payment_id;
    update public.loan_items set status = 'payment_failed' where request_id = v_payment.request_id and fee > 0;
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED', 'message', 'Simulated payment declined.');
  else
    -- Cancel payment & release held copies
    update public.payments set status = 'cancelled' where id = p_payment_id;
    for v_item in select * from public.loan_items where request_id = v_payment.request_id and status in ('awaiting_payment', 'payment_failed')
    loop
      update public.loan_items set status = 'cancelled' where id = v_item.id;
      if v_item.copy_id is not null then
        update public.copies set status = 'available', held_for_type = null, held_for_id = null, held_until = null where id = v_item.copy_id;
      end if;
    end loop;
    return jsonb_build_object('success', true, 'status', 'cancelled', 'message', 'Payment cancelled and copies released.');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. RPC: rpc_cancel_loan_item (FR-CART-07: Cancel with refund & release copy)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_cancel_loan_item(p_loan_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_item       record;
  v_next_res   record;
  v_receipt_no text;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'reason', 'UNAUTHENTICATED', 'message', 'Please sign in first.');
  end if;

  select * into v_item from public.loan_items where id = p_loan_item_id for update;
  if not found or v_item.uid <> v_uid then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND', 'message', 'Loan item not found.');
  end if;

  if v_item.status not in ('awaiting_payment', 'payment_failed', 'ready_for_pickup') then
    return jsonb_build_object('success', false, 'reason', 'STATUS_CHANGED', 'message', 'Only pending or ready-for-pickup items can be cancelled online.');
  end if;

  update public.loan_items set status = 'cancelled', updated_at = app_now() where id = p_loan_item_id;

  -- If paid online, emit reversal receipt & mark payment refunded
  if v_item.fee > 0 and v_item.status = 'ready_for_pickup' then
    v_receipt_no := 'REV-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
    insert into public.receipts (number, uid, amount, method, type, ref_type, ref_id, reason_code, notes, created_by_type)
    values (
      v_receipt_no, v_uid, -v_item.fee, 'transfer', 'borrow_fee',
      'loan_item', v_item.id, 'REFUND_CANCEL', 'Automatic online refund for cancelled pickup', 'system'
    );
    update public.payments set status = 'refunded', updated_at = app_now() where request_id = v_item.request_id and status = 'succeeded';
  end if;

  -- Release copy or promote next waiting reservation
  if v_item.copy_id is not null then
    select * into v_next_res
    from public.reservations
    where book_id = v_item.book_id and status = 'waiting'
    order by queue_position asc nulls last, created_at asc
    limit 1;

    if found then
      update public.reservations
      set status = 'ready_for_pickup', copy_id = v_item.copy_id, hold_until = app_now() + interval '48 hours'
      where id = v_next_res.id;
      update public.copies
      set status = 'held', held_for_type = 'reservation', held_for_id = v_next_res.id, held_until = app_now() + interval '48 hours'
      where id = v_item.copy_id;
    else
      update public.copies
      set status = 'available', held_for_type = null, held_for_id = null, held_until = null
      where id = v_item.copy_id;
    end if;
  end if;

  return jsonb_build_object('success', true, 'loan_item_id', p_loan_item_id, 'refund_receipt', v_receipt_no);
end;
$$;

-- -----------------------------------------------------------------------------
-- 13. Admin Books RPCs (Catalog, Copies, Write-off — Jira Admin Books Screen)
-- -----------------------------------------------------------------------------
create or replace function public.rpc_admin_upsert_book(
  p_id                uuid default null,
  p_title             text default null,
  p_authors           text[] default '{}',
  p_isbn13            text default null,
  p_publisher         text default null,
  p_year              integer default null,
  p_pages             integer default null,
  p_language          text default 'English',
  p_category          text default 'Non-Fiction',
  p_field             text default null,
  p_description       text default null,
  p_collection        text default 'standard',
  p_replacement_price integer default 100000,
  p_shelf_location    text default null,
  p_status            text default 'active'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'FORBIDDEN_ROLE', 'message', 'Admin privileges required.');
  end if;

  if p_title is null or btrim(p_title) = '' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED', 'message', 'Title is required.');
  end if;

  if p_id is not null then
    update public.books
    set title = btrim(p_title),
        authors = coalesce(p_authors, authors),
        isbn13 = nullif(btrim(coalesce(p_isbn13, '')), ''),
        publisher = nullif(btrim(coalesce(p_publisher, '')), ''),
        year = p_year,
        pages = p_pages,
        language = coalesce(nullif(btrim(coalesce(p_language, '')), ''), 'English'),
        category = coalesce(nullif(btrim(coalesce(p_category, '')), ''), 'Non-Fiction'),
        field = nullif(btrim(coalesce(p_field, '')), ''),
        description = nullif(btrim(coalesce(p_description, '')), ''),
        collection = case when p_collection in ('standard', 'premium') then p_collection else 'standard' end,
        replacement_price = greatest(0, coalesce(p_replacement_price, 100000)),
        shelf_location = nullif(btrim(coalesce(p_shelf_location, '')), ''),
        status = case when p_status in ('active', 'draft') then p_status else 'active' end,
        updated_at = app_now()
    where id = p_id
    returning id into v_book_id;
  else
    insert into public.books (
      title, authors, isbn13, publisher, year, pages, language, category, field,
      description, collection, replacement_price, shelf_location, status
    )
    values (
      btrim(p_title),
      coalesce(p_authors, '{}'),
      nullif(btrim(coalesce(p_isbn13, '')), ''),
      nullif(btrim(coalesce(p_publisher, '')), ''),
      p_year,
      p_pages,
      coalesce(nullif(btrim(coalesce(p_language, '')), ''), 'English'),
      coalesce(nullif(btrim(coalesce(p_category, '')), ''), 'Non-Fiction'),
      nullif(btrim(coalesce(p_field, '')), ''),
      nullif(btrim(coalesce(p_description, '')), ''),
      case when p_collection in ('standard', 'premium') then p_collection else 'standard' end,
      greatest(0, coalesce(p_replacement_price, 100000)),
      nullif(btrim(coalesce(p_shelf_location, '')), ''),
      case when p_status in ('active', 'draft') then p_status else 'active' end
    )
    returning id into v_book_id;
  end if;

  return jsonb_build_object('success', true, 'book_id', v_book_id);
end;
$$;

create or replace function public.rpc_admin_add_copy(
  p_book_id        uuid,
  p_barcode        text,
  p_shelf_location text default null,
  p_condition      text default 'good'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_copy_id uuid;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'FORBIDDEN_ROLE', 'message', 'Admin privileges required.');
  end if;

  if p_barcode is null or btrim(p_barcode) = '' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED', 'message', 'Copy barcode is required.');
  end if;

  insert into public.copies (book_id, barcode, status, shelf_location, condition)
  values (
    p_book_id,
    btrim(p_barcode),
    'available',
    nullif(btrim(coalesce(p_shelf_location, '')), ''),
    case when p_condition in ('good', 'fair', 'poor', 'damaged') then p_condition else 'good' end
  )
  returning id into v_copy_id;

  return jsonb_build_object('success', true, 'copy_id', v_copy_id);
end;
$$;

create or replace function public.rpc_admin_writeoff_copy(
  p_copy_id uuid,
  p_reason  text default 'damaged',
  p_notes   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_copy    record;
  v_slip_no text;
  v_slip_id uuid;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'FORBIDDEN_ROLE', 'message', 'Admin privileges required.');
  end if;

  select * into v_copy from public.copies where id = p_copy_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND', 'message', 'Physical copy not found.');
  end if;

  if v_copy.status in ('borrowed', 'held') then
    return jsonb_build_object('success', false, 'reason', 'PRECONDITION_FAILED', 'message', 'Cannot write off a copy that is currently borrowed or held.');
  end if;

  if v_copy.status = 'retired' then
    return jsonb_build_object('success', false, 'reason', 'STATUS_CHANGED', 'message', 'Copy is already retired.');
  end if;

  update public.copies
  set status = 'retired', updated_at = app_now()
  where id = p_copy_id;

  v_slip_no := 'WO-' || to_char(app_now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 5));
  insert into public.write_off_slips (slip_number, copy_id, book_id, reason, condition_at_writeoff, notes, created_by)
  values (
    v_slip_no, v_copy.id, v_copy.book_id,
    case when p_reason in ('damaged', 'lost', 'obsolete', 'water_damage', 'missing_pages') then p_reason else 'damaged' end,
    v_copy.condition,
    p_notes,
    auth.uid()
  )
  returning id into v_slip_id;

  return jsonb_build_object('success', true, 'slip_id', v_slip_id, 'slip_number', v_slip_no);
end;
$$;

-- -----------------------------------------------------------------------------
-- 14. Admin A-07 Copy Status Transitions & Audit Log + A-15 Draft Write-off Support
-- -----------------------------------------------------------------------------
alter table public.write_off_slips
  add column if not exists status text not null default 'completed'
    check (status in ('draft', 'completed')),
  add column if not exists target_state text not null default 'retired'
    check (target_state in ('retired', 'lost')),
  add column if not exists evidence_filename text;

create table if not exists public.copy_status_logs (
  id                uuid primary key default gen_random_uuid(),
  copy_id           uuid not null references public.copies(id) on delete cascade,
  book_id           uuid not null references public.books(id) on delete cascade,
  previous_status   text not null,
  new_status        text not null,
  destination_shelf text,
  reason            text not null,
  actor_id          uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default app_now()
);

create index if not exists copy_status_logs_copy_idx on public.copy_status_logs (copy_id, created_at desc);

alter table public.copy_status_logs enable row level security;

drop policy if exists copy_status_logs_admin_all on public.copy_status_logs;
create policy copy_status_logs_admin_all on public.copy_status_logs
  for all to authenticated
  using (is_admin())
  with check (is_admin());

create or replace function public.rpc_admin_update_copy_status(
  p_copy_id           uuid,
  p_new_status        text,
  p_destination_shelf text default null,
  p_reason            text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_copy       record;
  v_target     text;
  v_new_cond   text;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'FORBIDDEN_ROLE', 'message', 'Admin privileges required.');
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED', 'message', 'Mandatory reason for status change is required.');
  end if;

  select * into v_copy from public.copies where id = p_copy_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND', 'message', 'Copy not found.');
  end if;

  if v_copy.status in ('borrowed', 'held') and p_new_status <> 'found' then
    return jsonb_build_object('success', false, 'reason', 'PRECONDITION_FAILED', 'message', 'Cannot directly change status of a borrowed or held copy.');
  end if;

  -- Map "found" action to returning copy to available stock
  v_target := case when p_new_status = 'found' then 'available' else p_new_status end;
  if v_target not in ('available', 'damaged', 'under_repair', 'lost', 'retired') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED', 'message', 'Invalid target copy status.');
  end if;

  v_new_cond := case
    when v_target = 'damaged' then 'damaged'
    when v_target = 'available' and v_copy.condition = 'damaged' then 'fair'
    else v_copy.condition
  end;

  update public.copies
  set status = v_target,
      condition = v_new_cond,
      shelf_location = coalesce(nullif(btrim(coalesce(p_destination_shelf, '')), ''), shelf_location),
      updated_at = app_now()
  where id = p_copy_id;

  insert into public.copy_status_logs (copy_id, book_id, previous_status, new_status, destination_shelf, reason, actor_id)
  values (
    v_copy.id,
    v_copy.book_id,
    v_copy.status,
    v_target,
    coalesce(nullif(btrim(coalesce(p_destination_shelf, '')), ''), v_copy.shelf_location),
    btrim(p_reason),
    auth.uid()
  );

  return jsonb_build_object(
    'success', true,
    'copy_id', v_copy.id,
    'previous_status', v_copy.status,
    'new_status', v_target
  );
end;
$$;

create or replace function public.rpc_admin_update_book_tier(
  p_book_id           uuid,
  p_collection        text,
  p_replacement_price integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'reason', 'FORBIDDEN_ROLE', 'message', 'Admin privileges required.');
  end if;

  if p_collection not in ('standard', 'premium') then
    return jsonb_build_object('success', false, 'reason', 'VALIDATION_FAILED', 'message', 'Invalid collection tier.');
  end if;

  update public.books
  set collection = p_collection,
      replacement_price = coalesce(p_replacement_price, replacement_price),
      updated_at = app_now()
  where id = p_book_id;

  return jsonb_build_object('success', true, 'book_id', p_book_id, 'collection', p_collection);
end;
$$;
