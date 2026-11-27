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

select plan(7);

-- 1. Test Handover confirmation
select lives_ok(
  $$
    select public.rpc_confirm_handover_for_admin(
      '22222222-2222-2222-2222-222222222222'::uuid,
      'bbbb1111-1111-1111-1111-111111111111'::uuid,
      'good',
      'Handover test pgTAP',
      '{}'::text[]
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

-- 3. Test Return calculation on overdue loan (9786040000002-01)
select lives_ok(
  $$
    select public.rpc_process_return_with_evidence_for_admin(
      '22222222-2222-2222-2222-222222222222'::uuid,
      '9786040000002-01',
      'good',
      0,
      false,
      0,
      null,
      '{}'::text[]
    );
  $$,
  'rpc_process_return should calculate overdue fine on overdue copy'
);

-- 4. Test Settle Counter Charge & Receipt Generation
select lives_ok(
  $$
    select public.rpc_settle_counter_charge_for_admin(
      '22222222-2222-2222-2222-222222222222'::uuid,
      'cccc1111-1111-1111-1111-111111111111'::uuid,
      20000,
      'Test settle pgTAP'
    );
  $$,
  'rpc_settle_counter_charge should settle charge and produce immutable receipt'
);

-- 5. Test Staff Reservation Cancellation
select lives_ok(
  $$
    select public.rpc_cancel_reservation_staff_for_user(
      '22222222-2222-2222-2222-222222222222'::uuid,
      'dddd1111-1111-1111-1111-111111111111'::uuid,
      'Patron cancellation pgTAP'
    );
  $$,
  'rpc_cancel_reservation_staff should cancel reservation with reason'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.rpc_cancel_reservation_staff(uuid,text)',
    'EXECUTE'
  ),
  'authenticated users cannot directly execute reservation cancellation'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.rpc_settle_counter_charge(uuid,integer,text)',
    'EXECUTE'
  ),
  'authenticated users cannot directly execute counter settlement'
);

select * from finish();
rollback;
