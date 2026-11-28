-- =============================================================================
-- ShelfHelp — Circulation & Queues pgTAP test (TS-20, TS-21, TS-24, TS-31, TS-40, TS-43)
--
-- Tests the core business logic for:
--   * rpc_confirm_handover_for_admin (UC-20 / FR-CIRC-02)
--   * rpc_process_return_with_evidence_for_admin (UC-21 / FR-CIRC-03, FR-CIRC-04)
--   * rpc_settle_counter_charge_for_admin (FR-CIRC-07)
--   * rpc_mark_loan_lost_for_admin (FR-CIRC-05)
--   * rpc_cancel_reservation_staff_for_user (UC-29 / FR-RES-05)
--   * rpc_send_loan_reminders_for_admin (UC-30 / FR-NOTIF-04)
--
-- Run: npm run db:test (or supabase test db --workdir src)
-- =============================================================================

begin;
create extension if not exists pgtap;

select plan(14);

select has_function(
  'public',
  'rpc_process_return_with_evidence_for_admin',
  array['uuid', 'text', 'text', 'integer', 'boolean', 'integer', 'text', 'text[]', 'text', 'integer', 'boolean'],
  'admin return RPC should expose the current evidence and copy-status parameters'
);

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

-- 2. Verify loan item status transitioned to borrowed and due_date synced
select results_eq(
  $$
    select status, (due_at is not null and due_date is not null)
    from public.loan_items
    where id = 'bbbb1111-1111-1111-1111-111111111111'::uuid;
  $$,
  $$ values ('borrowed'::text, true) $$,
  'Loan item status should transition to borrowed with synced due_at and due_date'
);

-- 3. Test Return calculation on overdue loan (9786040000002-01) — must NOT double-charge existing 15,000 VND fine
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
  'rpc_process_return should calculate overdue fine on overdue copy without error'
);

select results_eq(
  $$
    select count(*)::int from public.charges
    where loan_item_id = 'bbbb3333-3333-3333-3333-333333333333'::uuid
      and type = 'overdue_fine'
      and amount = 15000;
  $$,
  $$ values (1) $$,
  'Returning an overdue loan with an existing matching overdue_fine charge must not duplicate the fine'
);

-- 4. Test Settle Counter Charge & Typed Receipt Generation
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

select results_eq(
  $$
    select type, created_by_id is not null
    from public.receipts
    where charge_id = 'cccc1111-1111-1111-1111-111111111111'::uuid;
  $$,
  $$ values ('overdue_fine'::text, true) $$,
  'Counter settlement receipt should record the exact charge type and librarian created_by_id'
);

-- 5. Test Send Reminders with 24h cooldown (UC-30 / FR-NOTIF-04)
select results_eq(
  $$
    select (res->>'sent_count')::int, (res->>'skipped_count')::int
    from (
      select public.rpc_send_loan_reminders_for_admin(
        '22222222-2222-2222-2222-222222222222'::uuid,
        array['bbbb2222-2222-2222-2222-222222222222'::uuid],
        'bulk',
        false
      ) as res
    ) t;
  $$,
  $$ values (1, 0) $$,
  'First bulk reminder sends to eligible student'
);

select results_eq(
  $$
    select (res->>'sent_count')::int, (res->>'skipped_count')::int
    from (
      select public.rpc_send_loan_reminders_for_admin(
        '22222222-2222-2222-2222-222222222222'::uuid,
        array['bbbb2222-2222-2222-2222-222222222222'::uuid],
        'bulk',
        false
      ) as res
    ) t;
  $$,
  $$ values (0, 1) $$,
  'Second bulk reminder within 24h skips student due to cooldown'
);

-- 6. Test Mark Loan as Lost (FR-CIRC-05)
select results_eq(
  $$
    select (res->>'status')::text, (res->>'student_status')::text
    from (
      select public.rpc_mark_loan_lost_for_admin(
        '22222222-2222-2222-2222-222222222222'::uuid,
        'bbbb2222-2222-2222-2222-222222222222'::uuid,
        'Lost during commute (pgTAP)'
      ) as res
    ) t;
  $$,
  $$ values ('lost'::text, 'restricted'::text) $$,
  'rpc_mark_loan_lost_for_admin marks loan lost and restricts student account'
);

-- 7. Test Staff Reservation Cancellation
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

select ok(
  not has_function_privilege(
    'authenticated',
    'public.rpc_mark_loan_lost_for_admin(uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated users cannot directly execute mark loan lost'
);

select * from finish();
rollback;
