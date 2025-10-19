-- ========================================
-- COMPREHENSIVE RECOVERY TEST SUITE
-- ========================================
-- This script creates all test scenarios for recovery system validation
-- Run this after server creates tables, then restart to trigger recovery

-- Clean up any existing test data
DELETE FROM controller0Archive WHERE request_id LIKE 'test-%';
DELETE FROM controller0Results WHERE request_id LIKE 'test-%';
DELETE FROM queue WHERE request_id LIKE 'test-%';
DELETE FROM antigreylisting WHERE request_id LIKE 'test-%';

-- ========================================
-- TEST 1: Partial Completion - Re-queue Remaining Emails
-- ========================================
-- Expected: Recovery detects 3 remaining emails and re-queues them
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-requeue-001',
    '["test1-alice@example.com","test1-bob@example.com","test1-charlie@example.com","test1-david@example.com","test1-emma@example.com"]',
    'http://localhost:9999/test1',
    '[["test1-alice@example.com",{"email":"test1-alice@example.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.example.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["test1-bob@example.com",{"email":"test1-bob@example.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.example.com","Pref":10}],"smtp":{"deliverable":false,"catch_all":false,"full_inbox":false,"disabled":true},"error":false,"error_msg":""}]]',
    (strftime('%s', 'now') - 3600) * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-requeue-001',
    'processing',
    5,
    2,
    0,
    (strftime('%s', 'now') - 3600) * 1000,
    (strftime('%s', 'now') - 3600) * 1000
);

-- ========================================
-- TEST 2: All Verified - Mark as Completed
-- ========================================
-- Expected: Recovery marks as completed (no re-queue needed)
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-complete-002',
    '["test2-alice@test.com","test2-bob@test.com"]',
    'http://localhost:9999/test2',
    '[["test2-alice@test.com",{"email":"test2-alice@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["test2-bob@test.com",{"email":"test2-bob@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":false,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}]]',
    (strftime('%s', 'now') - 3600) * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-complete-002',
    'processing',
    2,
    2,
    0,
    (strftime('%s', 'now') - 3600) * 1000,
    (strftime('%s', 'now') - 3600) * 1000
);

-- ========================================
-- TEST 3: In AntiGreylisting - Should NOT Detect as Orphan
-- ========================================
-- Expected: Recovery excludes this (existsInAntiGreylistDB filter)
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-greylist-003',
    '["test3-grey1@example.com","test3-grey2@example.com"]',
    'http://localhost:9999/test3',
    '[]',
    (strftime('%s', 'now') - 3600) * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-greylist-003',
    'processing',
    2,
    0,
    0,
    (strftime('%s', 'now') - 3600) * 1000,
    (strftime('%s', 'now') - 3600) * 1000
);

-- Add to antigreylisting table
INSERT INTO antigreylisting (request_id, emails, response_url, retrial_index, last_tried_at, max_retries_reached, returned) VALUES (
    'test-greylist-003',
    '["test3-grey1@example.com","test3-grey2@example.com"]',
    'http://localhost:9999/test3',
    1,
    (strftime('%s', 'now') - 3600) * 1000,
    0,
    0
);

-- ========================================
-- TEST 4: In Queue - Should NOT Detect as Orphan
-- ========================================
-- Expected: Recovery excludes this (isInQueue filter)
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-in-queue-004',
    '["test4-queued1@example.com","test4-queued2@example.com"]',
    'http://localhost:9999/test4',
    '[]',
    (strftime('%s', 'now') - 3600) * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-in-queue-004',
    'queued',
    2,
    0,
    0,
    (strftime('%s', 'now') - 3600) * 1000,
    (strftime('%s', 'now') - 3600) * 1000
);

-- Add to queue table
INSERT INTO queue (request_id, emails, response_url) VALUES (
    'test-in-queue-004',
    'test4-queued1@example.com;test4-queued2@example.com',
    'http://localhost:9999/test4'
);

-- ========================================
-- TEST 5: Worker Assigned - Should NOT Detect as Orphan
-- ========================================
-- Expected: Recovery excludes this (hasWorkerAssignment via verifying=1)
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-worker-005',
    '["test5-work1@example.com","test5-work2@example.com"]',
    'http://localhost:9999/test5',
    '[["test5-work1@example.com",{"email":"test5-work1@example.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.example.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}]]',
    (strftime('%s', 'now') - 3600) * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-worker-005',
    'processing',
    2,
    1,
    1,
    (strftime('%s', 'now') - 3600) * 1000,
    (strftime('%s', 'now') - 3600) * 1000
);

-- ========================================
-- TEST 6: Orphaned Archive Without Results Entry (Check 2)
-- ========================================
-- Expected: Recovery detects via Check 2, creates Results entry or marks failed
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-archive-only-006',
    '["test6-orphan1@example.com","test6-orphan2@example.com"]',
    'http://localhost:9999/test6',
    '[["test6-orphan1@example.com",{"email":"test6-orphan1@example.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.example.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}]]',
    (strftime('%s', 'now') - 3600) * 1000
);

-- NO Results entry (this is the orphaned archive scenario)

-- ========================================
-- TEST 7: No Archive Data - Mark as Failed
-- ========================================
-- Expected: Recovery detects no archive and marks as failed
INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-no-archive-007',
    'processing',
    3,
    0,
    0,
    (strftime('%s', 'now') - 3600) * 1000,
    (strftime('%s', 'now') - 3600) * 1000
);

-- NO Archive entry (cannot recover without archive data)

-- ========================================
-- PRIORITY 1 CRITICAL EDGE CASES
-- ========================================

-- ========================================
-- TEST 8: Partial + Greylisted (CRITICAL - Active greylisting)
-- ========================================
-- Expected: Recovery action='waiting_greylist' (9 verified + 1 greylisted = 10 accounted, status stays 'processing')
-- Archive preserved in memory, antiGreylisting will complete naturally
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-partial-greylist-008',
    '["t8-email1@test.com","t8-email2@test.com","t8-email3@test.com","t8-email4@test.com","t8-email5@test.com","t8-email6@test.com","t8-email7@test.com","t8-email8@test.com","t8-email9@test.com","t8-email10@test.com"]',
    'http://localhost:9999/test8',
    '[["t8-email1@test.com",{"email":"t8-email1@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["t8-email2@test.com",{"email":"t8-email2@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["t8-email3@test.com",{"email":"t8-email3@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["t8-email4@test.com",{"email":"t8-email4@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["t8-email5@test.com",{"email":"t8-email5@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["t8-email6@test.com",{"email":"t8-email6@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["t8-email7@test.com",{"email":"t8-email7@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["t8-email8@test.com",{"email":"t8-email8@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["t8-email9@test.com",{"email":"t8-email9@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}]]',
    (strftime('%s', 'now') - 3600) * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-partial-greylist-008',
    'processing',
    10,
    9,
    0,
    (strftime('%s', 'now') - 3600) * 1000,
    (strftime('%s', 'now') - 3600) * 1000
);

-- t8-email10 is greylisted
INSERT INTO antigreylisting (request_id, emails, response_url, retrial_index, last_tried_at, max_retries_reached, returned) VALUES (
    'test-partial-greylist-008',
    '["t8-email10@test.com"]',
    'http://localhost:9999/test8',
    1,
    (strftime('%s', 'now') - 3600) * 1000,
    0,
    0
);

-- ========================================
-- TEST 9: Expired Orphan (>7 days old)
-- ========================================
-- Expected: Mark as failed with reason "Request expired (>7 days old)"
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-expired-009',
    '["old1@test.com","old2@test.com"]',
    'http://localhost:9999/test9',
    '[]',
    (strftime('%s', 'now', '-8 day')) * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-expired-009',
    'processing',
    2,
    0,
    0,
    (strftime('%s', 'now', '-8 day')) * 1000,
    (strftime('%s', 'now', '-8 day')) * 1000
);

-- ========================================
-- TEST 10: Webhook Already Sent (Deduplication)
-- ========================================
-- Expected: Mark as completed, but DO NOT send webhook again
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-webhook-sent-010',
    '["sent1@test.com","sent2@test.com"]',
    'http://localhost:9999/test10',
    '[["sent1@test.com",{"email":"sent1@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["sent2@test.com",{"email":"sent2@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":false,"catch_all":false,"full_inbox":false,"disabled":true},"error":false,"error_msg":""}]]',
    (strftime('%s', 'now') - 3600) * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, webhook_sent, webhook_attempts, created_at, updated_at) VALUES (
    'test-webhook-sent-010',
    'processing',
    2,
    2,
    0,
    1,
    2,
    (strftime('%s', 'now') - 3600) * 1000,
    (strftime('%s', 'now') - 3600) * 1000
);

-- ========================================
-- TEST 11: Max Webhook Retries Reached
-- ========================================
-- Expected: Mark as COMPLETED, skip webhook (max retries)
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-max-retries-011',
    '["test11-retry1@test.com","test11-retry2@test.com"]',
    'http://localhost:9999/test11',
    '[["test11-retry1@test.com",{"email":"test11-retry1@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["test11-retry2@test.com",{"email":"test11-retry2@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}]]',
    (strftime('%s', 'now') - 3600) * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, webhook_sent, webhook_attempts, created_at, updated_at) VALUES (
    'test-max-retries-011',
    'processing',
    2,
    2,
    0,
    0,
    5,
    (strftime('%s', 'now') - 3600) * 1000,
    (strftime('%s', 'now') - 3600) * 1000
);

-- ========================================
-- TEST 12: Mixed Verified + Greylisted + Remaining (Active greylisting)
-- ========================================
-- Expected: Recovery will re-queue 5 remaining emails (3 verified + 2 greylisted + 5 remaining = 10 total)
-- Archive stays in memory, antiGreylisting handles its 2 emails separately
INSERT INTO controller0Archive (request_id, emails, response_url, result, created_at) VALUES (
    'test-mixed-012',
    '["test12-m1@test.com","test12-m2@test.com","test12-m3@test.com","test12-m4@test.com","test12-m5@test.com","test12-m6@test.com","test12-m7@test.com","test12-m8@test.com","test12-m9@test.com","test12-m10@test.com"]',
    'http://localhost:9999/test12',
    '[["test12-m1@test.com",{"email":"test12-m1@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["test12-m2@test.com",{"email":"test12-m2@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":true,"catch_all":false,"full_inbox":false,"disabled":false},"error":false,"error_msg":""}],["test12-m3@test.com",{"email":"test12-m3@test.com","syntax":true,"disposable":false,"role_account":false,"free":false,"has_mx_records":true,"mx":[{"Host":"mx.test.com","Pref":10}],"smtp":{"deliverable":false,"catch_all":false,"full_inbox":true,"disabled":false},"error":false,"error_msg":""}]]',
    (strftime('%s', 'now') - 3600) * 1000
);

INSERT INTO controller0Results (request_id, status, total_emails, completed_emails, verifying, created_at, updated_at) VALUES (
    'test-mixed-012',
    'processing',
    10,
    3,
    0,
    (strftime('%s', 'now') - 3600) * 1000,
    (strftime('%s', 'now') - 3600) * 1000
);

INSERT INTO antigreylisting (request_id, emails, response_url, retrial_index, last_tried_at, max_retries_reached, returned) VALUES (
    'test-mixed-012',
    '["test12-m4@test.com","test12-m5@test.com"]',
    'http://localhost:9999/test12',
    1,
    (strftime('%s', 'now') - 3600) * 1000,
    0,
    0
);

-- ========================================
-- UPDATED EXPECTED RESULTS SUMMARY (POST-FIX)
-- ========================================
-- Orphans that SHOULD be detected:
--   1. test-requeue-001: Re-queue (3 emails remaining) → status='queued'
--   2. test-complete-002: Complete (0 emails remaining) → status='completed', verifying=false
--   6. test-archive-only-006: Detected by Check 2 → status='failed'
--   7. test-no-archive-007: Mark as failed (no archive) → status='failed'
--   8. test-partial-greylist-008: Action='waiting_greylist' → status stays 'processing', archive preserved
--   9. test-expired-009: Failed (expired > 7 days) → status='failed'
--   10. test-webhook-sent-010: Complete (webhook already sent) → status='completed', verifying=false
--   11. test-max-retries-011: Complete (max webhook retries) → status='completed', verifying=false
--   12. test-mixed-012: Re-queue 5 remaining → status='queued' (greylisting separate)
--
-- Requests that should NOT be detected (exclusion filters):
--   3. test-greylist-003: In antigreylisting AND archive empty (returned=0)
--   4. test-in-queue-004: In queue
--   5. test-worker-005: Worker assigned (verifying=1)
--
-- Expected Summary:
--   - Orphans detected: 9
--   - Re-queued: 2 (test-requeue-001, test-mixed-012)
--   - Completed: 3 (test-complete-002, test-webhook-sent-010, test-max-retries-011)
--   - Waiting Greylist: 1 (test-partial-greylist-008)
--   - Failed: 3 (test-archive-only-006, test-no-archive-007, test-expired-009)
--   - Excluded: 3 (test-greylist-003, test-in-queue-004, test-worker-005)
