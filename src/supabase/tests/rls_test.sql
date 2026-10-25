-- =============================================================================
-- ShelfHelp — pgTAP RLS test (SRS §19 M0 exit criteria, TS-04, §12.3)
--
-- Proves row authorization for the three M0 tables:
--   * profiles : a student reads only their own row; admins read all
--   * profiles : a student may update only the POL-02 column grant
--   * books    : signed-in users read active books; drafts are staff-only
--   * copies   : readable when the parent book is visible
--   * books/copies are read-only for client roles (0 rows affected, no error)
--   * books.embedding is not readable by client roles
--
-- NOTE ON SEMANTICS (important, and the reason several assertions below use
-- is_empty/lives_ok instead of throws_ok):
--   Postgres RLS *filters* rows rather than raising. A client UPDATE/DELETE on a
--   table with no matching policy simply affects 0 rows and raises nothing. The
--   one exception is a missing table-level privilege, which DOES raise 42501 —
--   that is what the column-grant tests below assert.
--
-- Run: supabase test db --workdir src
-- =============================================================================

begin;
create extension if not exists pgtap;

select plan(23);

-- -----------------------------------------------------------------------------
-- Fixtures. Seeded as the superuser so RLS is bypassed here; every assertion
-- below then runs with a simulated JWT (request.jwt.claims).
-- -----------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'student1@example.edu', 'x', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'student2@example.edu', 'x', now(), now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@example.edu', 'x', now(), now(), now());

insert into public.profiles (id, role, status, full_name, email, student_id)
values
  ('11111111-1111-1111-1111-111111111111', 'student', 'active', 'Student One', 'student1@example.edu', 'S001'),
  ('22222222-2222-2222-2222-222222222222', 'student', 'active', 'Student Two', 'student2@example.edu', 'S002'),
  ('33333333-3333-3333-3333-333333333333', 'admin',   'active', 'Admin User',  'admin@example.edu',    null);

insert into public.books (id, title, status, total_copies, available_copies, embedding)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Public Book', 'active', 1, 1, array_fill(0.1, array[1536])::vector),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Draft Book',  'draft',  1, 1, null);

insert into public.copies (book_id, barcode, status)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ACTIVE-01', 'available'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'DRAFT-01',  'available');

-- The assertions are scoped to the fixtures above (title/barcode/email prefixes)
-- so that seed.sql rows loaded by `db reset` do not perturb exact-count checks.

-- -----------------------------------------------------------------------------
-- Helper: act as a given user / role for the rest of the transaction.
-- set_config(..., true) is transaction-local, so it survives the function call.
-- -----------------------------------------------------------------------------
create or replace function test_as(p_uid uuid, p_role text)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated',
                      'app_metadata', json_build_object('role', p_role))::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- =============================================================================
-- 1. Deny-by-default: no claims -> no rows visible (test 1)
-- =============================================================================
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '', true);

select is_empty(
  $$ select id from public.profiles $$,
  'No JWT claims: no profile rows are visible (deny-by-default)'
);

-- =============================================================================
-- 2. profiles: a student sees only their own row            (tests 2, 3, 4)
-- =============================================================================
select test_as('11111111-1111-1111-1111-111111111111', 'student');

select results_eq(
  $$ select email from public.profiles where email like '%@example.edu' order by email $$,
  $$ values ('student1@example.edu'::text) $$,
  'Student One sees only their own profile row'
);

select is_empty(
  $$ select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222' $$,
  'Student One cannot read Student Two''s profile row'
);

select is_empty(
  $$ select 1 from public.profiles where id = '33333333-3333-3333-3333-333333333333' $$,
  'Student One cannot read the admin profile row'
);

-- =============================================================================
-- 3. profiles: an admin sees every row                            (test 5)
-- =============================================================================
select test_as('33333333-3333-3333-3333-333333333333', 'admin');

select results_eq(
  $$ select count(*)::int from public.profiles
       where email in ('student1@example.edu','student2@example.edu','admin@example.edu') $$,
  $$ values (3) $$,
  'Admin sees all 3 fixture profile rows'
);

-- =============================================================================
-- 4. profiles: student UPDATE limited to the POL-02 column grant (tests 6-8)
-- =============================================================================
select test_as('11111111-1111-1111-1111-111111111111', 'student');

select lives_ok(
  $$ update public.profiles set full_name = 'Student One Renamed'
      where id = '11111111-1111-1111-1111-111111111111' $$,
  'Student can update their own full_name (granted column)'
);

select throws_ok(
  $$ update public.profiles set role = 'admin'
      where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  null,
  'Student cannot escalate their own role (role column not granted -> 42501)'
);

select results_eq(
  $$ with u as (
       update public.profiles set full_name = 'Hacked'
       where id = '22222222-2222-2222-2222-222222222222' returning 1
     ) select count(*)::int from u $$,
  $$ values (0) $$,
  'Student cannot update another student''s row (0 rows affected)'
);

-- =============================================================================
-- 5. books: active visible to signed-in users, drafts staff-only (tests 9-10)
-- =============================================================================
select test_as('11111111-1111-1111-1111-111111111111', 'student');

select results_eq(
  $$ select title from public.books where title like '% Book' order by title $$,
  $$ values ('Public Book'::text) $$,
  'Student sees only active books, never drafts'
);

select test_as('33333333-3333-3333-3333-333333333333', 'admin');

select results_eq(
  $$ select count(*)::int from public.books where title like '% Book' $$,
  $$ values (2) $$,
  'Admin sees both active and draft fixture books'
);

-- =============================================================================
-- 6. books.embedding is not readable by client roles                (test 11)
-- =============================================================================
select test_as('11111111-1111-1111-1111-111111111111', 'student');

select throws_ok(
  $$ select embedding from public.books $$,
  '42501',
  null,
  'Student cannot select books.embedding (column privilege revoked -> 42501)'
);

-- =============================================================================
-- 7. copies: readable only when the parent book is visible      (tests 12-13)
-- =============================================================================
select results_eq(
  $$ select barcode from public.copies where barcode in ('ACTIVE-01','DRAFT-01') order by barcode $$,
  $$ values ('ACTIVE-01'::text) $$,
  'Student sees copies of active books only, not of drafts'
);

select test_as('33333333-3333-3333-3333-333333333333', 'admin');

select results_eq(
  $$ select count(*)::int from public.copies where barcode in ('ACTIVE-01','DRAFT-01') $$,
  $$ values (2) $$,
  'Admin sees copies of both active and draft fixture books'
);

-- =============================================================================
-- 8. No client write path on books / copies / profiles          (tests 14-22)
--    RLS filters rather than raising, so each asserts 0 rows affected.
-- =============================================================================
select test_as('11111111-1111-1111-1111-111111111111', 'student');

-- A client INSERT with no INSERT policy raises 42501 with check, because RLS
-- adds an implicit WITH CHECK that is evaluated on the new row. Assert the
-- exception (not "0 rows"), which is the opposite of the UPDATE/DELETE case.
select throws_ok(
  $$ insert into public.books (title, status) values ('Hacked', 'active') $$,
  '42501',
  null,
  'Student cannot INSERT into books (42501 from RLS WITH CHECK)'
);

select results_eq(
  $$ with u as (
       update public.books set title = 'Hacked' where status = 'active' returning 1
     ) select count(*)::int from u $$,
  $$ values (0) $$,
  'Student cannot UPDATE books (0 rows affected)'
);

select results_eq(
  $$ with d as (delete from public.books where status = 'active' returning 1)
     select count(*)::int from d $$,
  $$ values (0) $$,
  'Student cannot DELETE books (0 rows affected)'
);

select throws_ok(
  $$ insert into public.copies (book_id, barcode)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'HACK-01') $$,
  '42501',
  null,
  'Student cannot INSERT into copies (42501 from RLS WITH CHECK)'
);

select results_eq(
  $$ with u as (update public.copies set status = 'lost' returning 1)
     select count(*)::int from u $$,
  $$ values (0) $$,
  'Student cannot UPDATE copies (0 rows affected)'
);

select results_eq(
  $$ with d as (delete from public.copies returning 1)
     select count(*)::int from d $$,
  $$ values (0) $$,
  'Student cannot DELETE copies (0 rows affected)'
);

select throws_ok(
  $$ insert into public.profiles (id, full_name, email)
     values (gen_random_uuid(), 'Ghost', 'ghost@example.edu') $$,
  '42501',
  null,
  'Student cannot INSERT a profile row (42501 from RLS WITH CHECK)'
);

select results_eq(
  $$ with d as (delete from public.profiles returning 1) select count(*)::int from d $$,
  $$ values (0) $$,
  'Student cannot DELETE a profile row (0 rows affected)'
);

-- Reset to the superuser before DDL: the assertions above left the session as
-- `authenticated`, and the fixtures below create a scratch table.
select set_config('role', 'postgres', true);

-- The append-only guard (SRS §10.7) must raise, not silently filter. It is a
-- trigger function, so exercise it through a scratch table shaped like the
-- insert-only tables (receipts, audit_logs) that later milestones create.
create table public._t_append_only (id int primary key, note text);
create trigger trg_append_only before update or delete on public._t_append_only
  for each row execute function reject_mutation();
insert into public._t_append_only values (1, 'first');

select throws_ok(
  $$ update public._t_append_only set note = 'changed' where id = 1 $$,
  '42501',
  null,
  'reject_mutation() blocks UPDATE on an append-only table (42501)'
);

select throws_ok(
  $$ delete from public._t_append_only where id = 1 $$,
  '42501',
  null,
  'reject_mutation() blocks DELETE on an append-only table (42501)'
);

select * from finish();
rollback;
