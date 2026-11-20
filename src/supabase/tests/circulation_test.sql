-- =============================================================================
-- ShelfHelp — Circulation & Queues pgTAP test (TS-20, TS-21, TS-24, TS-40)
--
-- Tests the core business logic for:
--   * rpc_confirm_handover (UC-20 / FR-CIRC-02)
--   * rpc_process_return (UC-21 / FR-CIRC-03, FR-CIRC-04)
--   * rpc_settle_counter_charge (FR-CIRC-07)
--   * rpc_cancel_reservation_staff (UC-29 / FR-RES-05)
--
-- Run: npm run db:test (or supabase test db --workdir src)
-- =============================================================================

begin;
create extension if not exists pgtap;

select plan(5);

-- 1. Test Handover confirmation
select lives_ok(
  $$
    select public.rpc_confirm_handover(
      'bbbb1111-1111-1111-1111-111111111111'::uuid,
      'good',
      'Handover test pgTAP'
    );
  $$,
  'rpc_confirm_handover should execute cleanly for ready item'
);

-- 2. Verify loan item status transitioned to borrowed
select results_eq(
  $$
    select status from public.loan_items where id = 'bbbb1111-1111-1111-1111-111111111111'::uuid;
  $$,
  $$ values ('borrowed'::text) $$,
  'Loan item status should transition to borrowed after handover'
);

-- 3. Test Return calculation on overdue loan (978604000002-01)
select ok(
  (
    select (res->>'success')::boolean and (res->>'fine_amount')::integer >= 15000
    from (
      select public.rpc_process_return(
        '978604000002-01',
        'good',
        0,
        false,
        0
      ) as res
    ) t
  ),
  'rpc_process_return should calculate overdue fine (>= 15,000 VND) on overdue copy'
);

-- 4. Test Settle Counter Charge & Receipt Generation
select ok(
  (
    select (res->>'success')::boolean and (res->>'receipt_number') is not null
    from (
      select public.rpc_settle_counter_charge(
        'cccc1111-1111-1111-1111-111111111111'::uuid,
        20000,
        'Test settle pgTAP'
      ) as res
    ) t
  ),
  'rpc_settle_counter_charge should settle charge and produce immutable receipt'
);

-- 5. Test Staff Reservation Cancellation
select ok(
  (
    select (res->>'success')::boolean and (res->>'status') = 'cancelled'
    from (
      select public.rpc_cancel_reservation_staff(
        'dddd1111-1111-1111-1111-111111111111'::uuid,
        'Patron cancellation pgTAP'
      ) as res
    ) t
  ),
  'rpc_cancel_reservation_staff should cancel reservation with reason'
);

select * from finish();
rollback;
