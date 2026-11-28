-- ============================================================================
-- Reader Loans & Reviews pgTAP test (TS-24, TS-25)
-- ============================================================================

begin;
create extension if not exists pgtap;

select plan(13);

-- 1. Test tables exist
select has_table('public', 'book_reviews', 'book_reviews table should exist');
select is(
  (select status from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  'active',
  'the confirmed Minh demo account is active after seeding'
);

-- 2. Test functions exist
select has_function('public', 'rpc_renew_loan', array['uuid'], 'rpc_renew_loan function should exist');
select has_function('public', 'rpc_pay_reader_charges', array['uuid[]', 'text'], 'rpc_pay_reader_charges function should exist');
select has_function('public', 'rpc_pay_reader_charges_for_user', array['uuid', 'uuid[]', 'text'], 'trusted payment RPC should exist');
select has_function('public', 'rpc_renew_loan_for_user', array['uuid', 'uuid'], 'trusted renew RPC should exist');
select has_function('public', 'rpc_submit_book_review_for_user', array['uuid', 'uuid', 'integer', 'text', 'text'], 'trusted review RPC should exist');

select ok(
  not has_function_privilege('anon', 'public.rpc_submit_book_review_for_user(uuid,uuid,integer,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.rpc_submit_book_review_for_user(uuid,uuid,integer,text,text)', 'execute')
  and has_function_privilege('service_role', 'public.rpc_submit_book_review_for_user(uuid,uuid,integer,text,text)', 'execute'),
  'review wrapper is callable only by the trusted service'
);

update public.loan_items set status = 'returned'
where id = 'bbbb2222-2222-2222-2222-222222222222';

select is(
  public.rpc_submit_book_review_for_user(
    '11111111-1111-1111-1111-111111111111',
    'bbbb2222-2222-2222-2222-222222222222',
    5, 'A useful book', 'Recommended'
  )->>'success',
  'true',
  'reader can submit a review for their returned loan'
);
select results_eq(
  $$ select rating::integer, headline, comment from public.book_reviews
     where uid = '11111111-1111-1111-1111-111111111111'
       and loan_item_id = 'bbbb2222-2222-2222-2222-222222222222' $$,
  $$ values (5, 'Recommended'::text, 'A useful book'::text) $$,
  'review stores its rating, headline and comment'
);
select is(
  public.rpc_submit_book_review_for_user(
    '33333333-3333-3333-3333-333333333333',
    'bbbb2222-2222-2222-2222-222222222222',
    5, 'Not my loan', null
  )->>'error',
  'FORBIDDEN',
  'reader cannot review another reader''s loan'
);

select ok(
  coalesce((
    select position('online' in pg_get_constraintdef(oid)) > 0
      and position('ewallet' in pg_get_constraintdef(oid)) > 0
      and position('mobile_banking' in pg_get_constraintdef(oid)) > 0
    from pg_constraint
    where conrelid = 'public.receipts'::regclass
      and conname = 'receipts_method_check'
  ), false),
  'receipt method constraint accepts reader and checkout payment methods'
);

select ok(
  coalesce((
    select position('overdue_fine' in pg_get_constraintdef(oid)) > 0
      and position('damage_fee' in pg_get_constraintdef(oid)) > 0
      and position('loss_fee' in pg_get_constraintdef(oid)) > 0
      and position('reversal' in pg_get_constraintdef(oid)) > 0
    from pg_constraint
    where conrelid = 'public.receipts'::regclass
      and conname = 'receipts_type_check'
  ), false),
  'receipt type constraint accepts all supported receipt types'
);

select * from finish();
rollback;
