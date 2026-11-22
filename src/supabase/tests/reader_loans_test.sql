-- ============================================================================
-- Reader Loans & Reviews pgTAP test (TS-24, TS-25)
-- ============================================================================

begin;
create extension if not exists pgtap;

select plan(3);

-- 1. Test tables exist
select has_table('public', 'book_reviews', 'book_reviews table should exist');

-- 2. Test functions exist
select has_function('public', 'rpc_renew_loan', array['uuid'], 'rpc_renew_loan function should exist');
select has_function('public', 'rpc_pay_reader_charges', array['uuid[]', 'text'], 'rpc_pay_reader_charges function should exist');

select * from finish();
rollback;
