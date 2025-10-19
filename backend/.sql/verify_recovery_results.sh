#!/bin/bash

# Recovery Test Suite Verification Script
# This script checks the database state after recovery to verify all tests passed

DB_PATH="/home/legion/projects/email-verifier/backend/.sql/verifier_queue.db"

echo "========================================"
echo "   RECOVERY TEST SUITE VERIFICATION"
echo "========================================"
echo ""

# Test counters
PASSED=0
FAILED=0

# Helper function to check test
check_test() {
    local test_num=$1
    local test_name=$2
    local request_id=$3
    local expected_status=$4
    local expected_action=$5

    echo "TEST $test_num: $test_name"
    echo "  Request ID: $request_id"

    # Get actual status from Results table
    actual_status=$(sqlite3 "$DB_PATH" "SELECT status FROM controller0Results WHERE request_id='$request_id';")

    if [ -z "$actual_status" ]; then
        actual_status="NO_ENTRY"
    fi

    echo "  Expected: $expected_status"
    echo "  Actual: $actual_status"

    # Check if status matches
    if [ "$actual_status" = "$expected_status" ]; then
        echo "  Result: ✅ PASS"
        PASSED=$((PASSED + 1))
    else
        echo "  Result: ❌ FAIL"
        FAILED=$((FAILED + 1))
    fi

    # Additional checks based on action
    case $expected_action in
        "requeued")
            # Check if in queue
            in_queue=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM queue WHERE request_id='$request_id';")
            echo "  In queue: $in_queue (expected: 1 if still processing, 0 if already processed)"

            # Check queue emails count
            if [ "$in_queue" = "1" ]; then
                queue_emails=$(sqlite3 "$DB_PATH" "SELECT emails FROM queue WHERE request_id='$request_id';")
                email_count=$(echo "$queue_emails" | tr ';' '\n' | wc -l)
                echo "  Queued emails: $email_count"
            fi
            ;;
        "completed")
            # Check completed_emails
            completed=$(sqlite3 "$DB_PATH" "SELECT completed_emails, total_emails FROM controller0Results WHERE request_id='$request_id';")
            echo "  Emails: $completed"

            # Check webhook status
            webhook_info=$(sqlite3 "$DB_PATH" "SELECT webhook_sent, webhook_attempts FROM controller0Results WHERE request_id='$request_id';" 2>/dev/null || echo "NULL|NULL")
            if [ "$webhook_info" != "NULL|NULL" ]; then
                echo "  Webhook: $webhook_info (sent|attempts)"
            fi

            # Check if results in verification_requests table
            vr_status=$(sqlite3 "$DB_PATH" "SELECT status FROM verification_requests WHERE verification_request_id='$request_id';" 2>/dev/null || echo "")
            if [ "$vr_status" = "completed" ]; then
                echo "  ✅ Synced to verification_requests table"
            elif [ -z "$vr_status" ]; then
                echo "  ℹ️  Not in verification_requests table (expected if not created via API)"
            else
                echo "  ⚠️  verification_requests status: $vr_status (expected: completed)"
            fi
            ;;
        "excluded")
            # Check that status wasn't changed by recovery
            echo "  Action: Should remain untouched by recovery"
            ;;
        "waiting_greylist")
            # Check that archive is preserved, status remains processing
            echo "  Action: Waiting for antiGreylisting to complete (archive preserved)"

            # Check if archive still exists
            archive_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM controller0Archive WHERE request_id='$request_id';" 2>/dev/null || echo "0")
            if [ "$archive_count" = "1" ]; then
                echo "  ✅ Archive preserved in database"
            else
                echo "  ⚠️  Archive not found (expected: 1, got: $archive_count)"
            fi

            # Check if in antigreylisting
            greylist_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM antigreylisting WHERE request_id='$request_id';" 2>/dev/null || echo "0")
            if [ "$greylist_count" = "1" ]; then
                echo "  ✅ Found in antigreylisting table"
            else
                echo "  ⚠️  Not in antigreylisting table (expected: 1, got: $greylist_count)"
            fi
            ;;
        "failed"|"expired")
            echo "  Action: Marked as failed due to missing data or expiration"
            ;;
    esac

    echo ""
}

# Run tests
echo "Checking recovery results..."
echo ""

check_test 1 "Partial Completion - Re-queue" "test-requeue-001" "queued" "requeued"
check_test 2 "All Verified - Complete" "test-complete-002" "completed" "completed"
check_test 3 "In AntiGreylisting - Exclude" "test-greylist-003" "processing" "waiting_greylist"
check_test 4 "In Queue - Exclude" "test-in-queue-004" "queued" "excluded"
check_test 5 "Worker Assigned - Exclude" "test-worker-005" "processing" "excluded"
check_test 6 "Orphaned Archive Only" "test-archive-only-006" "failed" "failed"
check_test 7 "No Archive Data" "test-no-archive-007" "failed" "failed"
check_test 8 "Partial + Greylisted (CRITICAL)" "test-partial-greylist-008" "processing" "waiting_greylist"
check_test 9 "Expired Orphan (>7 days)" "test-expired-009" "failed" "expired"
check_test 10 "Webhook Already Sent" "test-webhook-sent-010" "completed" "completed"
check_test 11 "Max Webhook Retries" "test-max-retries-011" "completed" "completed"
check_test 12 "Mixed Verified+Grey+Remaining" "test-mixed-012" "queued" "requeued"

# Summary
echo "========================================"
echo "   TEST SUITE SUMMARY"
echo "========================================"
echo "Total Tests: $((PASSED + FAILED))"
echo "Passed: $PASSED ✅"
echo "Failed: $FAILED ❌"
echo ""
echo "Expected Post-Fix Results:"
echo "  - Re-queued: 2 (test-requeue-001, test-mixed-012)"
echo "  - Completed: 3 (test-complete-002, test-webhook-sent-010, test-max-retries-011)"
echo "  - Waiting Greylist: 2 (test-greylist-003, test-partial-greylist-008)"
echo "  - Failed: 3 (test-archive-only-006, test-no-archive-007, test-expired-009)"
echo "  - Excluded: 2 (test-in-queue-004, test-worker-005)"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED!"
    exit 0
else
    echo "⚠️  SOME TESTS FAILED"
    exit 1
fi
