/**
 * Verification Database Operations Unit Tests
 * Testing verification_requests database functions
 */

const {
    createVerificationRequest,
    updateVerificationStatus,
    updateVerificationResults,
    getVerificationRequest,
    getUserVerificationHistory,
} = require('../functions/route_fns/verify/verificationDB');


describe('Verification Database Operations Unit Tests', () => {
    let testDb;
    let testUserId;

    beforeAll(async () => {
        try {
            // Clean up any existing global instance
            if (global.databaseInstance) {
                try {
                    global.databaseInstance.close();
                } catch (e) {
                    // Ignore if already closed
                }
                global.databaseInstance = null;
            }

            // Set test environment variable
            process.env.DB_PATH = '.sql/verification-db-test.db';

            // Initialize test database
            const { initializeDatabase } = require('../database/connection');
            testDb = initializeDatabase();

            // Create test user
            const result = testDb.prepare(`
                INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                VALUES (?, ?, ?, ?, 1)
            `).run('VerificationDB', 'Test', 'verificationdb-test@example.com', 'hashed_password');

            testUserId = Number(result.lastInsertRowid);

        } catch (error) {
            console.error('Verification DB test setup failed:', error);
            throw error;
        }
    });

    afterEach(() => {
        try {
            // Clean up test data after each test
            if (testDb && testDb.open) {
                testDb.prepare('DELETE FROM verification_requests').run();
            }
        } catch (error) {
            console.error('Verification DB afterEach cleanup failed:', error);
        }
    });

    afterAll(async () => {
        try {
            if (testDb && testDb.open) {
                testDb.close();
            }

            if (global.databaseInstance) {
                try {
                    global.databaseInstance.close();
                } catch (e) {
                    // Ignore if already closed
                }
                global.databaseInstance = null;
            }

            // Clean up test database file
            const fs = require('fs');
            const path = require('path');
            const testDbPath = path.join(__dirname, '..', '.sql', 'verification-db-test.db');
            if (fs.existsSync(testDbPath)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                try {
                    fs.unlinkSync(testDbPath);
                } catch (unlinkError) {
                    console.warn('Could not clean up test database file:', unlinkError.message);
                }
            }

        } catch (error) {
            console.error('Verification DB test cleanup failed:', error);
        }
    });


    describe('createVerificationRequest', () => {
        test('should create verification request successfully', async () => {
            try {
                const params = {
                    verification_request_id: 'test-request-001',
                    user_id: testUserId,
                    request_type: 'single',
                    emails: ['test@example.com']
                };

                const result = await createVerificationRequest(params);

                expect(result).toHaveProperty('success', true);
                expect(result).toHaveProperty('message', 'Verification request created successfully');

                // Verify it was inserted in the database
                const row = testDb.prepare('SELECT * FROM verification_requests WHERE verification_request_id = ?')
                    .get('test-request-001');

                expect(row).toBeDefined();
                expect(row.user_id).toBe(testUserId);
                expect(row.request_type).toBe('single');
                expect(row.status).toBe('pending');
                expect(JSON.parse(row.emails)).toEqual(['test@example.com']);

            } catch (error) {
                console.error('Create verification request test failed:', error);
                throw error;
            }
        });

        test('should create CSV type verification request', async () => {
            try {
                const params = {
                    verification_request_id: 'test-csv-request-001',
                    user_id: testUserId,
                    request_type: 'csv',
                    emails: ['email1@example.com', 'email2@example.com', 'email3@example.com']
                };

                const result = await createVerificationRequest(params);

                expect(result).toHaveProperty('success', true);

                const row = testDb.prepare('SELECT * FROM verification_requests WHERE verification_request_id = ?')
                    .get('test-csv-request-001');

                expect(row).toBeDefined();
                expect(row.request_type).toBe('csv');
                expect(JSON.parse(row.emails)).toHaveLength(3);

            } catch (error) {
                console.error('Create CSV verification request test failed:', error);
                throw error;
            }
        });

        test('should handle duplicate verification request ID', async () => {
            try {
                const params = {
                    verification_request_id: 'duplicate-request',
                    user_id: testUserId,
                    request_type: 'single',
                    emails: ['test@example.com']
                };

                // Create first request
                await createVerificationRequest(params);

                // Try to create duplicate
                const result = await createVerificationRequest(params);

                expect(result).toHaveProperty('success', false);
                expect(result).toHaveProperty('message', 'Failed to create verification request');

            } catch (error) {
                console.error('Duplicate verification request test failed:', error);
                throw error;
            }
        });
    });


    describe('updateVerificationStatus', () => {
        beforeEach(async () => {
            // Create a test verification request
            await createVerificationRequest({
                verification_request_id: 'status-test-request',
                user_id: testUserId,
                request_type: 'single',
                emails: ['test@example.com']
            });
        });

        test('should update status to processing', async () => {
            try {
                const result = await updateVerificationStatus('status-test-request', 'processing');

                expect(result).toHaveProperty('success', true);
                expect(result).toHaveProperty('message', 'Verification status updated successfully');

                const row = testDb.prepare('SELECT * FROM verification_requests WHERE verification_request_id = ?')
                    .get('status-test-request');

                expect(row.status).toBe('processing');

            } catch (error) {
                console.error('Update status to processing test failed:', error);
                throw error;
            }
        });

        test('should update status to completed', async () => {
            try {
                const result = await updateVerificationStatus('status-test-request', 'completed');

                expect(result).toHaveProperty('success', true);

                const row = testDb.prepare('SELECT * FROM verification_requests WHERE verification_request_id = ?')
                    .get('status-test-request');

                expect(row.status).toBe('completed');

            } catch (error) {
                console.error('Update status to completed test failed:', error);
                throw error;
            }
        });

        test('should update status to failed', async () => {
            try {
                const result = await updateVerificationStatus('status-test-request', 'failed');

                expect(result).toHaveProperty('success', true);

                const row = testDb.prepare('SELECT * FROM verification_requests WHERE verification_request_id = ?')
                    .get('status-test-request');

                expect(row.status).toBe('failed');

            } catch (error) {
                console.error('Update status to failed test failed:', error);
                throw error;
            }
        });

        test('should handle non-existent request gracefully', async () => {
            try {
                const result = await updateVerificationStatus('nonexistent-request', 'completed');

                expect(result).toHaveProperty('success', true);

            } catch (error) {
                console.error('Non-existent request update test failed:', error);
                throw error;
            }
        });
    });


    describe('updateVerificationResults', () => {
        beforeEach(async () => {
            // Create a test verification request
            await createVerificationRequest({
                verification_request_id: 'results-test-request',
                user_id: testUserId,
                request_type: 'single',
                emails: ['test@example.com']
            });
        });

        test('should update results with valid emails', async () => {
            try {
                const results = [
                    { email: 'test@example.com', status: 'valid', message: 'Email verified successfully' }
                ];

                const result = await updateVerificationResults('results-test-request', results);

                expect(result).toHaveProperty('success', true);
                expect(result).toHaveProperty('message', 'Verification results updated successfully');

                const row = testDb.prepare('SELECT * FROM verification_requests WHERE verification_request_id = ?')
                    .get('results-test-request');

                expect(row.status).toBe('completed');
                expect(row.completed_at).toBeDefined();
                expect(JSON.parse(row.results)).toEqual(results);

                const statistics = JSON.parse(row.statistics);
                expect(statistics).toEqual({
                    valid: 1,
                    invalid: 0,
                    catch_all: 0,
                    unknown: 0
                });

            } catch (error) {
                console.error('Update results with valid emails test failed:', error);
                throw error;
            }
        });

        test('should calculate statistics correctly for mixed results', async () => {
            try {
                const results = [
                    { email: 'valid@example.com', status: 'valid', message: 'Valid' },
                    { email: 'invalid@example.com', status: 'invalid', message: 'Invalid' },
                    { email: 'catchall@example.com', status: 'catch-all', message: 'Catch-all' },
                    { email: 'unknown@example.com', status: 'unknown', message: 'Unknown' },
                    { email: 'valid2@example.com', status: 'valid', message: 'Valid' }
                ];

                const result = await updateVerificationResults('results-test-request', results);

                expect(result).toHaveProperty('success', true);

                const row = testDb.prepare('SELECT * FROM verification_requests WHERE verification_request_id = ?')
                    .get('results-test-request');

                const statistics = JSON.parse(row.statistics);
                expect(statistics).toEqual({
                    valid: 2,
                    invalid: 1,
                    catch_all: 1,
                    unknown: 1
                });

            } catch (error) {
                console.error('Calculate statistics test failed:', error);
                throw error;
            }
        });

        test('should handle catchall alternative spelling', async () => {
            try {
                const results = [
                    { email: 'catchall1@example.com', status: 'catch_all', message: 'Catch-all' },
                    { email: 'catchall2@example.com', status: 'catchall', message: 'Catchall' }
                ];

                const result = await updateVerificationResults('results-test-request', results);

                expect(result).toHaveProperty('success', true);

                const row = testDb.prepare('SELECT * FROM verification_requests WHERE verification_request_id = ?')
                    .get('results-test-request');

                const statistics = JSON.parse(row.statistics);
                expect(statistics.catch_all).toBe(2);

            } catch (error) {
                console.error('Catchall spelling test failed:', error);
                throw error;
            }
        });

        test('should handle empty results array', async () => {
            try {
                const results = [];

                const result = await updateVerificationResults('results-test-request', results);

                expect(result).toHaveProperty('success', true);

                const row = testDb.prepare('SELECT * FROM verification_requests WHERE verification_request_id = ?')
                    .get('results-test-request');

                const statistics = JSON.parse(row.statistics);
                expect(statistics).toEqual({
                    valid: 0,
                    invalid: 0,
                    catch_all: 0,
                    unknown: 0
                });

            } catch (error) {
                console.error('Empty results array test failed:', error);
                throw error;
            }
        });
    });


    describe('getVerificationRequest', () => {
        test('should get verification request successfully', async () => {
            try {
                // Create a test request
                await createVerificationRequest({
                    verification_request_id: 'get-test-request',
                    user_id: testUserId,
                    request_type: 'single',
                    emails: ['test@example.com']
                });

                const request = await getVerificationRequest('get-test-request');

                expect(request).toBeDefined();
                expect(request).toHaveProperty('verification_request_id', 'get-test-request');
                expect(request).toHaveProperty('user_id', testUserId);
                expect(request).toHaveProperty('request_type', 'single');
                expect(request).toHaveProperty('status', 'pending');
                expect(request.emails).toEqual(['test@example.com']);
                expect(request.results).toBeNull();
                expect(request.statistics).toBeNull();

            } catch (error) {
                console.error('Get verification request test failed:', error);
                throw error;
            }
        });

        test('should get verification request with results', async () => {
            try {
                // Create and complete a test request
                await createVerificationRequest({
                    verification_request_id: 'get-completed-request',
                    user_id: testUserId,
                    request_type: 'single',
                    emails: ['test@example.com']
                });

                const results = [
                    { email: 'test@example.com', status: 'valid', message: 'Valid' }
                ];

                await updateVerificationResults('get-completed-request', results);

                const request = await getVerificationRequest('get-completed-request');

                expect(request).toBeDefined();
                expect(request.status).toBe('completed');
                expect(request.results).toEqual(results);
                expect(request.statistics).toBeDefined();
                expect(request.completed_at).toBeDefined();

            } catch (error) {
                console.error('Get completed verification request test failed:', error);
                throw error;
            }
        });

        test('should return null for non-existent request', async () => {
            try {
                const request = await getVerificationRequest('nonexistent-request');

                expect(request).toBeNull();

            } catch (error) {
                console.error('Non-existent verification request test failed:', error);
                throw error;
            }
        });
    });


    describe('getUserVerificationHistory', () => {
        beforeEach(async () => {
            // Create multiple test requests
            const now = Date.now();

            await createVerificationRequest({
                verification_request_id: 'history-request-1',
                user_id: testUserId,
                request_type: 'single',
                emails: ['test1@example.com']
            });

            await createVerificationRequest({
                verification_request_id: 'history-request-2',
                user_id: testUserId,
                request_type: 'csv',
                emails: ['test2@example.com', 'test3@example.com']
            });

            await createVerificationRequest({
                verification_request_id: 'history-request-3',
                user_id: testUserId,
                request_type: 'single',
                emails: ['test4@example.com']
            });

            // Update one to completed
            await updateVerificationResults('history-request-1', [
                { email: 'test1@example.com', status: 'valid', message: 'Valid' }
            ]);
        });

        test('should get user verification history', async () => {
            try {
                const history = await getUserVerificationHistory(testUserId);

                expect(history).toHaveProperty('requests');
                expect(history).toHaveProperty('total', 3);
                expect(history).toHaveProperty('page', 1);
                expect(history).toHaveProperty('per_page', 50);
                expect(history.requests).toHaveLength(3);

            } catch (error) {
                console.error('Get user verification history test failed:', error);
                throw error;
            }
        });

        test('should paginate history correctly', async () => {
            try {
                const history = await getUserVerificationHistory(testUserId, {
                    page: 1,
                    per_page: 2
                });

                expect(history).toHaveProperty('total', 3);
                expect(history).toHaveProperty('page', 1);
                expect(history).toHaveProperty('per_page', 2);
                expect(history.requests).toHaveLength(2);

            } catch (error) {
                console.error('History pagination test failed:', error);
                throw error;
            }
        });

        test('should filter by request type', async () => {
            try {
                const history = await getUserVerificationHistory(testUserId, {
                    request_type: 'single'
                });

                expect(history).toHaveProperty('total', 2);
                expect(history.requests).toHaveLength(2);
                history.requests.forEach(request => {
                    expect(request.request_type).toBe('single');
                });

            } catch (error) {
                console.error('Filter by request type test failed:', error);
                throw error;
            }
        });

        test('should filter by status', async () => {
            try {
                const history = await getUserVerificationHistory(testUserId, {
                    status: 'completed'
                });

                expect(history).toHaveProperty('total', 1);
                expect(history.requests).toHaveLength(1);
                expect(history.requests[0].status).toBe('completed');

            } catch (error) {
                console.error('Filter by status test failed:', error);
                throw error;
            }
        });

        test('should combine multiple filters', async () => {
            try {
                const history = await getUserVerificationHistory(testUserId, {
                    request_type: 'single',
                    status: 'completed'
                });

                expect(history).toHaveProperty('total', 1);
                expect(history.requests).toHaveLength(1);
                expect(history.requests[0].request_type).toBe('single');
                expect(history.requests[0].status).toBe('completed');

            } catch (error) {
                console.error('Combine filters test failed:', error);
                throw error;
            }
        });

        test('should handle empty history', async () => {
            try {
                // Create another user without requests
                const anotherUserResult = testDb.prepare(`
                    INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                    VALUES (?, ?, ?, ?, 1)
                `).run('Another', 'User', 'another-verification-user@example.com', 'hashed_password');

                const anotherUserId = Number(anotherUserResult.lastInsertRowid);

                const history = await getUserVerificationHistory(anotherUserId);

                expect(history).toHaveProperty('total', 0);
                expect(history.requests).toHaveLength(0);

                // Clean up
                testDb.prepare('DELETE FROM users WHERE id = ?').run(anotherUserId);

            } catch (error) {
                console.error('Empty history test failed:', error);
                throw error;
            }
        });

        test('should order by created_at DESC', async () => {
            try {
                const history = await getUserVerificationHistory(testUserId);

                expect(history.requests).toHaveLength(3);

                // Verify descending order (most recent first)
                for (let i = 0; i < history.requests.length - 1; i++) {
                    expect(history.requests[i].created_at).toBeGreaterThanOrEqual(
                        history.requests[i + 1].created_at
                    );
                }

            } catch (error) {
                console.error('History ordering test failed:', error);
                throw error;
            }
        });
    });


    describe('Error Handling', () => {
        test('should handle database errors in createVerificationRequest', async () => {
            try {
                // Try to create request with invalid user_id (foreign key constraint)
                const params = {
                    verification_request_id: 'invalid-user-request',
                    user_id: 99999,
                    request_type: 'single',
                    emails: ['test@example.com']
                };

                const result = await createVerificationRequest(params);

                expect(result).toHaveProperty('success', false);
                expect(result).toHaveProperty('message', 'Failed to create verification request');

            } catch (error) {
                console.error('Database error test failed:', error);
                throw error;
            }
        });
    });
});
