-- =============================================================================
-- ShelfHelp — 0015_restrict_client_write_policies.sql
-- Reconciles REC-01: removes legacy direct client INSERT/UPDATE/DELETE RLS
-- policies on protected business tables so all business writes go through
-- Edge Functions + service_role RPCs.
--
-- Note: cart_items (own rows), profiles (POL-02 contact columns), and
-- notifications (read_at on own rows via notifications_update_own_read) remain
-- the only direct client-writable tables.
-- =============================================================================

-- 1. Circulation & money tables (replace FOR ALL with admin FOR SELECT)
drop policy if exists loan_requests_admin_all on public.loan_requests;
create policy loan_requests_admin_select on public.loan_requests
  for select to authenticated
  using ((select is_admin()));

drop policy if exists loan_items_admin_all on public.loan_items;
create policy loan_items_admin_select on public.loan_items
  for select to authenticated
  using ((select is_admin()));

drop policy if exists reservations_admin_all on public.reservations;
create policy reservations_admin_select on public.reservations
  for select to authenticated
  using ((select is_admin()));

drop policy if exists charges_admin_all on public.charges;
create policy charges_admin_select on public.charges
  for select to authenticated
  using ((select is_admin()));

drop policy if exists receipts_admin_insert on public.receipts;

-- 2. Catalog & copy tables (books_select_active and copies_select_visible already allow admin SELECT)
drop policy if exists books_admin_all on public.books;
drop policy if exists copies_admin_insert on public.copies;
drop policy if exists copies_admin_update on public.copies;

-- 3. Wishlists (replace FOR ALL with owner/admin FOR SELECT; writes go through toggle-wishlist)
drop policy if exists wishlists_own_all on public.wishlists;
create policy wishlists_own_or_admin_select on public.wishlists
  for select to authenticated
  using (uid = (select auth.uid()) or (select is_admin()));

-- 4. Book reviews ("Anyone can read book reviews" remains for SELECT; writes go through submit-book-review)
drop policy if exists "Users can create reviews for their loans" on public.book_reviews;
drop policy if exists "Users can update their own reviews" on public.book_reviews;
