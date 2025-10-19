-- COMPREHENSIVE RECOVERY TEST SCENARIOS
-- Run this script to create test data for recovery system validation
-- All timestamps use current time minus 1 hour to simulate recent orphans

-- Current timestamp minus 1 hour (in milliseconds)
-- JavaScript: Date.now() - (1000 * 60 * 60)

-- ========================================
-- SCENARIO 1: Orphan with Partial Completion (REQUEUE TEST)
-- ========================================
-- Request: test-partial-001
-- Expected: Recovery should detect 3 remaining emails and re-queue them
-- Archive: 5 emails total, 2 verified (alice@example.com, bob@example.com)
-- Results: status='processing', completed=2, total=5

INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-partial-001',
    '["alice@example.com","bob@example.com","charlie@example.com","david@example.com","emma@example.com"]',
    'http://localhost:9999/webhook/partial',
    '[["alice@example.com",{"email":"alice@example.com","valid":true,"reason":"smtp_verified"}],["bob@example.com",{"email":"bob@example.com","valid":true,"reason":"smtp_verified"}]]',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-partial-001',
    'processing',
    5,
    2,
    0,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- ========================================
-- SCENARIO 2: Orphan with All Greylisted Emails (WAIT TEST)
-- ========================================
-- Request: test-greylisted-002
-- Expected: Recovery action='waiting_greylist' (0 verified + 3 greylisted = 3 accounted, status stays 'processing')
-- Archive: 3 emails, all in antigreylisting table
-- Results: status='processing', completed=0, total=3

INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-greylisted-002',
    '["grey1@example.com","grey2@example.com","grey3@example.com"]',
    'http://localhost:9999/webhook/greylisted',
    '[]',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-greylisted-002',
    'processing',
    3,
    0,
    0,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- Add all emails to antigreylisting (simulating they're all greylisted)
INSERT INTO antigreylisting (request_id, emails, response_url, retrial_index, last_tried_at, max_retries_reached, returned) VALUES
    ('test-greylisted-002', '["grey1@example.com","grey2@example.com","grey3@example.com"]', 'http://localhost:9999/webhook/greylisted', 1, strftime('%s', 'now', '-1 hour') * 1000, 0, 0);

-- ========================================
-- SCENARIO 3: Orphaned Archive Without Results Entry (CHECK 2 TEST)
-- ========================================
-- Request: test-archive-only-003
-- Expected: Recovery should detect orphaned archive and create new Results entry or mark as failed
-- Archive: 4 emails, 1 verified
-- Results: NO ENTRY (simulating Results table entry was never created or got deleted)

INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-archive-only-003',
    '["orphan1@example.com","orphan2@example.com","orphan3@example.com","orphan4@example.com"]',
    'http://localhost:9999/webhook/archive-only',
    '[["orphan1@example.com",{"email":"orphan1@example.com","valid":true,"reason":"smtp_verified"}]]',
    strftime('%s', 'now', '-1 hour') * 1000
);

-- NO Results entry for this request_id (simulating Check 2: Orphaned archives)

-- ========================================
-- SCENARIO 4: Orphan with NO Archive Data (FAILURE TEST)
-- ========================================
-- Request: test-no-archive-004
-- Expected: Recovery should mark as failed (cannot recover without archive data)
-- Archive: NO ENTRY
-- Results: status='processing', completed=0, total=5

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-no-archive-004',
    'processing',
    5,
    0,
    0,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- NO Archive entry for this request_id (cannot determine which emails to verify)

-- ========================================
-- SCENARIO 5: Multiple Orphans Simultaneously (BATCH TEST)
-- ========================================
-- Requests: test-batch-005a, test-batch-005b, test-batch-005c
-- Expected: Recovery should process all three orphans correctly

-- 5A: Partial completion (2/4 verified)
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-batch-005a',
    '["batch-a1@example.com","batch-a2@example.com","batch-a3@example.com","batch-a4@example.com"]',
    'http://localhost:9999/webhook/batch-a',
    '[["batch-a1@example.com",{"email":"batch-a1@example.com","valid":true}],["batch-a2@example.com",{"email":"batch-a2@example.com","valid":false}]]',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-batch-005a',
    'processing',
    4,
    2,
    0,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- 5B: All complete (should mark as completed)
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-batch-005b',
    '["batch-b1@example.com","batch-b2@example.com"]',
    'http://localhost:9999/webhook/batch-b',
    '[["batch-b1@example.com",{"email":"batch-b1@example.com","valid":true}],["batch-b2@example.com",{"email":"batch-b2@example.com","valid":true}]]',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-batch-005b',
    'processing',
    2,
    2,
    0,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- 5C: No progress (0/3 verified)
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-batch-005c',
    '["batch-c1@example.com","batch-c2@example.com","batch-c3@example.com"]',
    'http://localhost:9999/webhook/batch-c',
    '[]',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-batch-005c',
    'processing',
    3,
    0,
    0,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- ========================================
-- SCENARIO 6: Request in Queue (EXCLUSION FILTER TEST - SHOULD NOT BE DETECTED AS ORPHAN)
-- ========================================
-- Request: test-in-queue-006
-- Expected: Recovery should NOT detect as orphan (exclusion filter: isInQueue)
-- Archive: 3 emails, 0 verified
-- Results: status='queued', completed=0, total=3
-- Queue: Entry exists in queue table

INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-in-queue-006',
    '["queued1@example.com","queued2@example.com","queued3@example.com"]',
    'http://localhost:9999/webhook/queued',
    '[]',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-in-queue-006',
    'queued',
    3,
    0,
    0,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- Add to queue table (this should prevent it from being detected as orphan)
INSERT INTO queue (request_id, emails, response_url) VALUES (
    'test-in-queue-006',
    '["queued1@example.com","queued2@example.com","queued3@example.com"]',
    'http://localhost:9999/webhook/queued'
);

-- ========================================
-- SCENARIO 7: Request with Worker Assignment (EXCLUSION FILTER TEST - SHOULD NOT BE DETECTED AS ORPHAN)
-- ========================================
-- Request: test-worker-assigned-007
-- Expected: Recovery should NOT detect as orphan (exclusion filter: hasWorkerAssignment)
-- Archive: 4 emails, 1 verified
-- Results: status='processing', completed=1, total=4, verifying=1 (worker assigned)

INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-worker-assigned-007',
    '["worker1@example.com","worker2@example.com","worker3@example.com","worker4@example.com"]',
    'http://localhost:9999/webhook/worker',
    '[["worker1@example.com",{"email":"worker1@example.com","valid":true}]]',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-worker-assigned-007',
    'processing',
    4,
    1,
    1,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- Worker assignment is indicated by verifying=1 in Results table
-- Recovery checks controller0.request_workers Map, but during fresh start this will be empty
-- However, verifying=1 indicates a worker was assigned before crash

-- ========================================
-- SCENARIO 8: Request Already Completed (SHOULD NOT BE DETECTED AS ORPHAN)
-- ========================================
-- Request: test-completed-008
-- Expected: Recovery should NOT detect as orphan (status='completed')
-- Archive: 2 emails, 2 verified
-- Results: status='completed', completed=2, total=2

INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-completed-008',
    '["complete1@example.com","complete2@example.com"]',
    'http://localhost:9999/webhook/completed',
    '[["complete1@example.com",{"email":"complete1@example.com","valid":true}],["complete2@example.com",{"email":"complete2@example.com","valid":false}]]',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-completed-008',
    'completed',
    2,
    2,
    0,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- ========================================
-- TEST SUMMARY
-- ========================================
-- ORPHANS (Should be detected and recovered):
--   1. test-partial-001: Partial completion → RE-QUEUE 3 emails
--   2. test-greylisted-002: All greylisted → WAIT (excluded by antiGreylisting check)
--   3. test-archive-only-003: No Results entry → DETECTED by Check 2, CREATE Results or FAIL
--   4. test-no-archive-004: No archive data → MARK AS FAILED
--   5. test-batch-005a: Partial (2/4) → RE-QUEUE 2 emails
--   6. test-batch-005b: All complete (2/2) → MARK COMPLETED
--   7. test-batch-005c: No progress (0/3) → RE-QUEUE 3 emails
--
-- NOT ORPHANS (Should be excluded by filters):
--   8. test-in-queue-006: In queue → EXCLUDED (isInQueue filter)
--   9. test-worker-assigned-007: Worker assigned (verifying=1) → EXCLUDED (hasWorkerAssignment filter)
--   10. test-greylisted-002: In antigreylisting → EXCLUDED (existsInAntiGreylistDB filter)
--   11. test-completed-008: Already completed → EXCLUDED (status check)
--
-- Expected orphans detected: 5 (scenarios 1, 3, 4, 5a, 5c)
-- Expected orphans marked completed: 1 (scenario 5b)
-- Expected orphans re-queued: 3 (scenarios 1, 5a, 5c)
-- Expected orphans failed: 1 (scenario 4)
-- Expected orphans from Check 2: 1 (scenario 3)

-- ========================================
-- SCENARIO 9: CRITICAL - Partial Completion WITH Greylisted Emails
-- ========================================
-- Request: test-partial-greylist-009
-- Expected: Recovery action='waiting_greylist' (9 verified + 1 greylisted = 10 accounted, status stays 'processing')
-- Archive: 10 emails total, 9 verified
-- AntiGreylisting: 1 email (email10@example.com)
-- Results: status='processing', completed=9, total=10
-- CRITICAL: This is the exact bug scenario from recovery gap analysis - NOW FIXED

INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-partial-greylist-009',
    '["email1@example.com","email2@example.com","email3@example.com","email4@example.com","email5@example.com","email6@example.com","email7@example.com","email8@example.com","email9@example.com","email10@example.com"]',
    'http://localhost:9999/webhook/partial-greylist',
    '[["email1@example.com",{"email":"email1@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["email2@example.com",{"email":"email2@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["email3@example.com",{"email":"email3@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["email4@example.com",{"email":"email4@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["email5@example.com",{"email":"email5@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["email6@example.com",{"email":"email6@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["email7@example.com",{"email":"email7@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["email8@example.com",{"email":"email8@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["email9@example.com",{"email":"email9@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}]]',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-partial-greylist-009',
    'processing',
    10,
    9,
    0,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- email10 is greylisted (will retry later)
INSERT INTO antigreylisting (request_id, emails, response_url, retrial_index, last_tried_at, max_retries_reached, returned) VALUES (
    'test-partial-greylist-009',
    '["email10@example.com"]',
    'http://localhost:9999/webhook/partial-greylist',
    1,
    strftime('%s', 'now', '-1 hour') * 1000,
    0,
    0
);

-- ========================================
-- SCENARIO 10: Expired Orphan (>7 days old)
-- ========================================
-- Request: test-expired-010
-- Expected: Recovery should mark as FAILED with reason "Request expired (>7 days old)"
-- Archive: 2 emails, 0 verified
-- Results: status='processing', completed=0, total=2
-- Created: 8 days ago (exceeds 7-day limit)

INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-expired-010',
    '["expired1@example.com","expired2@example.com"]',
    'http://localhost:9999/webhook/expired',
    '[]',
    strftime('%s', 'now', '-8 day') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-expired-010',
    'processing',
    2,
    0,
    0,
    strftime('%s', 'now', '-8 day') * 1000,
    strftime('%s', 'now', '-8 day') * 1000
);

-- ========================================
-- SCENARIO 11: Webhook Already Sent (Deduplication Test)
-- ========================================
-- Request: test-webhook-sent-011
-- Expected: Recovery should mark as COMPLETED but NOT send webhook again
-- Archive: 2 emails, 2 verified
-- Results: status='processing', completed=2, total=2, webhook_sent=1, webhook_attempts=2
-- Webhook: Already sent successfully

INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-webhook-sent-011',
    '["sent1@example.com","sent2@example.com"]',
    'http://localhost:9999/webhook/already-sent',
    '[["sent1@example.com",{"email":"sent1@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["sent2@example.com",{"email":"sent2@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":false,"catch_all":false,"full_inbox":false,"disabled":true},"error":false}]]',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, webhook_sent, webhook_attempts, created_at, updated_at) VALUES (
    'test-webhook-sent-011',
    'processing',
    2,
    2,
    0,
    1,
    2,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- ========================================
-- SCENARIO 12: Max Webhook Retries Reached
-- ========================================
-- Request: test-webhook-max-retries-012
-- Expected: Recovery should mark as COMPLETED but NOT send webhook (max retries reached)
-- Archive: 3 emails, 3 verified
-- Results: status='processing', completed=3, total=3, webhook_sent=0, webhook_attempts=5
-- Webhook: Failed 5 times, should not retry

INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-webhook-max-retries-012',
    '["retry1@example.com","retry2@example.com","retry3@example.com"]',
    'http://localhost:9999/webhook/max-retries',
    '[["retry1@example.com",{"email":"retry1@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["retry2@example.com",{"email":"retry2@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["retry3@example.com",{"email":"retry3@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}]]',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, webhook_sent, webhook_attempts, created_at, updated_at) VALUES (
    'test-webhook-max-retries-012',
    'processing',
    3,
    3,
    0,
    0,
    5,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- ========================================
-- SCENARIO 13: Mixed Verified + Greylisted + Remaining
-- ========================================
-- Request: test-mixed-013
-- Expected: Recovery should restore 3 verified, detect 2 greylisted, re-queue 5 remaining
-- Archive: 10 emails total, 3 verified
-- AntiGreylisting: 2 emails
-- Results: status='processing', completed=3, total=10
-- Remaining: 10 - 3 - 2 = 5 emails to re-queue

INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-mixed-013',
    '["mix1@example.com","mix2@example.com","mix3@example.com","mix4@example.com","mix5@example.com","mix6@example.com","mix7@example.com","mix8@example.com","mix9@example.com","mix10@example.com"]',
    'http://localhost:9999/webhook/mixed',
    '[["mix1@example.com",{"email":"mix1@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["mix2@example.com",{"email":"mix2@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false}],["mix3@example.com",{"email":"mix3@example.com","syntax":true,"disposable":false,"has_mx_records":true,"smtp":{"deliverable":false,"catch_all":false,"full_inbox":true,"disabled":false},"error":false}]]',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-mixed-013',
    'processing',
    10,
    3,
    0,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- mix4 and mix5 are greylisted
INSERT INTO antigreylisting (request_id, emails, response_url, retrial_index, last_tried_at, max_retries_reached, returned) VALUES (
    'test-mixed-013',
    '["mix4@example.com","mix5@example.com"]',
    'http://localhost:9999/webhook/mixed',
    1,
    strftime('%s', 'now', '-1 hour') * 1000,
    0,
    0
);

-- ========================================
-- SCENARIO 14: Malformed Archive Data (Error Handling Test)
-- ========================================
-- Request: test-malformed-014
-- Expected: Recovery should handle gracefully and mark as FAILED
-- Archive: Invalid JSON in result column
-- Results: status='processing', completed=0, total=2

INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-malformed-014',
    '["malformed1@example.com","malformed2@example.com"]',
    'http://localhost:9999/webhook/malformed',
    'INVALID_JSON_DATA{not:valid}',
    strftime('%s', 'now', '-1 hour') * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-malformed-014',
    'processing',
    2,
    0,
    0,
    strftime('%s', 'now', '-1 hour') * 1000,
    strftime('%s', 'now', '-1 hour') * 1000
);

-- ========================================
-- UPDATED TEST SUMMARY (POST-FIX)
-- ========================================
-- ORPHANS (Should be detected and recovered):
--   1. test-partial-001: Partial completion → RE-QUEUE 3 emails, status='queued'
--   2. test-greylisted-002: All greylisted (0 verified + 3 greylisted = 3 accounted) → ACTION='waiting_greylist', status stays 'processing'
--   3. test-archive-only-003: No Results entry → DETECTED by Check 2, MARK AS FAILED
--   4. test-no-archive-004: No archive data → MARK AS FAILED
--   5. test-batch-005a: Partial (2/4) → RE-QUEUE 2 emails, status='queued'
--   6. test-batch-005b: All complete (2/2) → MARK COMPLETED, status='completed', verifying=false
--   7. test-batch-005c: No progress (0/3) → RE-QUEUE 3 emails, status='queued'
--   9. test-partial-greylist-009: Partial + greylisted (9+1=10) → ACTION='waiting_greylist', status stays 'processing' (CRITICAL TEST - NOW FIXED)
--   10. test-expired-010: Expired (>7 days) → MARK AS FAILED with "expired" reason
--   11. test-webhook-sent-011: Webhook already sent → MARK COMPLETED, skip webhook, status='completed', verifying=false
--   12. test-webhook-max-retries-012: Max retries → MARK COMPLETED, skip webhook, status='completed', verifying=false
--   13. test-mixed-013: Mixed verified+greylist+remaining (3 verified + 2 greylisted + 5 remaining) → RE-QUEUE 5 emails, status='queued'
--   14. test-malformed-014: Malformed archive data → MARK AS FAILED
--
-- NOT ORPHANS (Should be excluded by filters):
--   6. test-in-queue-006: In queue → EXCLUDED (isInQueue filter)
--   7. test-worker-assigned-007: Worker assigned (verifying=1) → EXCLUDED
--   8. test-completed-008: Already completed → EXCLUDED (status='completed')
--
-- Expected Results (Post-Fix):
--   Total orphans detected: 11
--   Re-queued: 4 (scenarios 1, 5a, 5c, 13)
--   Completed: 3 (scenarios 5b, 11, 12)
--   Waiting Greylist: 2 (scenarios 2, 9) - NEW ACTION TYPE
--   Failed: 4 (scenarios 3, 4, 10, 14)
--   Excluded: 3 (scenarios 6, 7, 8)
