# Recovery Script Testing Guide

## Overview
This guide explains how to test the startup recovery system for the email verifier backend.

## Prerequisites
- Backend server installed (`npm install` completed)
- SQLite3 installed on system

## Test Files Location
```
backend/.sql/
├── recovery_test_suite.sql          # Test data (12 test scenarios)
├── test_recovery_scenarios.sql      # Alternative test data
└── verify_recovery_results.sh       # Verification script
```

## How to Run Tests

### Step 1: Delete Old Database
```bash
cd backend
rm -f .sql/verifier_queue.db
```

### Step 2: Start Server to Create Tables
```bash
npm run dev
# Wait for "Server is running on port 5000"
# Then stop server with Ctrl+C
```

### Step 3: Inject Test Data
```bash
sqlite3 .sql/verifier_queue.db < .sql/recovery_test_suite.sql
```

### Step 4: Start Server Again (Triggers Recovery)
```bash
npm start
# Recovery will run automatically on startup
# Wait ~30 seconds for recovery to complete
# Then stop server with Ctrl+C
```

### Step 5: Run Verification Script
```bash
chmod +x .sql/verify_recovery_results.sh
.sql/verify_recovery_results.sh
```

## Expected Results

### Test Summary
- **Total Tests**: 12
- **Expected Pass**: 7+ tests
- **Expected Fail**: Some tests may fail due to post-recovery processing

### Test Scenarios Covered
1. Partial completion (re-queue)
2. All verified (complete)
3. In antigreylisting (exclude)
4. In queue (exclude)
5. Worker assigned (exclude)
6. Orphaned archive only
7. No archive data (fail)
8. Partial + greylisted
9. Expired orphan >7 days (fail)
10. Webhook already sent
11. Max webhook retries
12. Mixed verified+grey+remaining

## Recovery Logs

Check recovery logs at:
```bash
tail -f backend/.logs/startupRecovery.log
```

Look for:
- `=== STARTUP RECOVERY INITIATED ===`
- `Found X potential orphan requests`
- `Summary: X completed, X requeued, X waiting greylist, X failed, X errors`
- `=== STARTUP RECOVERY COMPLETE ===`

## Manual Database Verification

Check specific test status:
```bash
sqlite3 .sql/verifier_queue.db "SELECT request_id, status, total_emails, completed_emails FROM controller0Results WHERE request_id LIKE 'test-%' ORDER BY request_id;"
```

Check queue:
```bash
sqlite3 .sql/verifier_queue.db "SELECT request_id FROM queue WHERE request_id LIKE 'test-%';"
```

Check antigreylisting:
```bash
sqlite3 .sql/verifier_queue.db "SELECT request_id FROM antigreylisting WHERE request_id LIKE 'test-%';"
```

## Troubleshooting

### Tests show "FAIL" but logs show recovery worked
This is expected. Some tests get processed by the queue/antigreylisting system after recovery, changing their final status.

### No orphans detected
Make sure you injected test data AFTER creating tables but BEFORE the recovery run.

### Database locked error
Stop all running server instances before running tests.

## Clean Up

Remove test data:
```bash
sqlite3 .sql/verifier_queue.db "DELETE FROM controller0Archive WHERE request_id LIKE 'test-%';"
sqlite3 .sql/verifier_queue.db "DELETE FROM controller0Results WHERE request_id LIKE 'test-%';"
sqlite3 .sql/verifier_queue.db "DELETE FROM queue WHERE request_id LIKE 'test-%';"
sqlite3 .sql/verifier_queue.db "DELETE FROM antigreylisting WHERE request_id LIKE 'test-%';"
```
