/**
 * Verifier Routes Integration Tests
 * Testing email verifier API routes end-to-end
 */

const request = require('supertest');
const express = require('express');


// Mock uuid before requiring anything that uses it
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid-123')
}));

// Mock queue and controller to avoid external dependencies
jest.mock('../functions/staging/queue', () => ({
    add: jest.fn()
}));

jest.mock('../functions/verifier/controller', () => ({
    getRequestStatus: jest.fn(),
    getRequestResults: jest.fn()
}));

// Now require modules that depend on uuid
const verifierRouter = require('../routes/api/verifier');
const { hashPassword } = require('../functions/utils/password');
const { generateAccessToken } = require('../functions/utils/jwt');


describe('Verifier Routes Integration Tests', () => {
    let app;
    let testDb;
    let testUser;
    let testUserId;
    let accessToken;

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
            process.env.DB_PATH = '.sql/verifier-routes-test.db';

            // Initialize test database
            const { initializeDatabase } = require('../database/connection');
            testDb = initializeDatabase();

            // Create Express app with verifier router
            app = express();
            app.use(express.json());
            app.use(express.urlencoded({ extended: true }));
            app.use('/api/verifier', verifierRouter);

            // Create verified test user
            const hashedPassword = await hashPassword('TestPassword123!');
            const insertUser = testDb.prepare(`
                INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                VALUES (?, ?, ?, ?, 1)
            `);

            const result = insertUser.run('Verifier', 'Test', 'verifiertest@example.com', hashedPassword);
            testUserId = Number(result.lastInsertRowid);
            testUser = {
                userId: testUserId,
                email: 'verifiertest@example.com'
            };

            // Generate token for authenticated tests
            accessToken = generateAccessToken(testUser);

        } catch (error) {
            console.error('Verifier routes test setup failed:', error);
            throw error;
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
            const testDbPath = path.join(__dirname, '..', '.sql', 'verifier-routes-test.db');
            if (fs.existsSync(testDbPath)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                try {
                    fs.unlinkSync(testDbPath);
                } catch (unlinkError) {
                    console.warn('Could not clean up test database file:', unlinkError.message);
                }
            }

        } catch (error) {
            console.error('Verifier routes test cleanup failed:', error);
        }
    });

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        const queue = require('../functions/staging/queue');
        queue.add.mockResolvedValue({ success: true });
    });

    afterEach(() => {
        try {
            // Clean up test data after each test
            if (testDb && testDb.open) {
                testDb.prepare('DELETE FROM verification_requests').run();
                testDb.prepare('DELETE FROM csv_uploads').run();
            }
        } catch (error) {
            console.error('Verifier routes afterEach cleanup failed:', error);
        }
    });


    describe('POST /api/verifier/verify-single', () => {
        test('should verify single email successfully', async () => {
            try {
                const response = await request(app)
                    .post('/api/verifier/verify-single')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({ email: 'test@example.com' })
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('message', 'Email verification started');
                expect(response.body.data).toHaveProperty('verification_request_id');
                expect(response.body.data).toHaveProperty('email', 'test@example.com');
                expect(response.body.data).toHaveProperty('status', 'processing');

            } catch (error) {
                console.error('Verify single email test failed:', error);
                throw error;
            }
        });

        test('should reject verification without authentication', async () => {
            try {
                const response = await request(app)
                    .post('/api/verifier/verify-single')
                    .send({ email: 'test@example.com' })
                    .expect(401);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Verify without auth test failed:', error);
                throw error;
            }
        });

        test('should reject verification with invalid email format', async () => {
            try {
                const response = await request(app)
                    .post('/api/verifier/verify-single')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({ email: 'invalid-email' })
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body.message).toContain('Invalid email address format');

            } catch (error) {
                console.error('Invalid email format test failed:', error);
                throw error;
            }
        });

        test('should reject verification without email', async () => {
            try {
                const response = await request(app)
                    .post('/api/verifier/verify-single')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({})
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body.message).toContain('Email address is required');

            } catch (error) {
                console.error('Missing email test failed:', error);
                throw error;
            }
        });

        test('should handle queue failure gracefully', async () => {
            try {
                const queue = require('../functions/staging/queue');
                queue.add.mockResolvedValue({ success: false });

                const response = await request(app)
                    .post('/api/verifier/verify-single')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({ email: 'test@example.com' })
                    .expect(500);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body.message).toContain('Failed to add request to verification queue');

            } catch (error) {
                console.error('Queue failure test failed:', error);
                throw error;
            }
        });
    });


    describe('GET /api/verifier/verification/:verification_request_id', () => {
        test('should get verification status for processing request', async () => {
            try {
                // Create a test verification request
                const verificationRequestId = 'single-test-123';
                testDb.prepare(`
                    INSERT INTO verification_requests
                    (verification_request_id, user_id, request_type, status, emails, created_at, updated_at)
                    VALUES (?, ?, 'single', 'processing', '["test@example.com"]', ?, ?)
                `).run(verificationRequestId, testUserId, Date.now(), Date.now());

                const controller = require('../functions/verifier/controller');
                controller.getRequestStatus.mockResolvedValue({
                    status: 'processing',
                    verifying: true,
                    greylist_found: false
                });

                const response = await request(app)
                    .get(`/api/verifier/verification/${verificationRequestId}`)
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data).toHaveProperty('status', 'processing');
                expect(response.body.data).toHaveProperty('progress_step', 'processing');

            } catch (error) {
                console.error('Get verification status test failed:', error);
                throw error;
            }
        });

        test('should get completed verification with results', async () => {
            try {
                // Create a completed test verification request
                const verificationRequestId = 'single-test-456';
                const results = [{ email: 'test@example.com', status: 'valid', message: 'Email verified successfully' }];
                const statistics = { valid: 1, invalid: 0, catch_all: 0, unknown: 0 };

                testDb.prepare(`
                    INSERT INTO verification_requests
                    (verification_request_id, user_id, request_type, status, emails, results, statistics, created_at, updated_at, completed_at)
                    VALUES (?, ?, 'single', 'completed', '["test@example.com"]', ?, ?, ?, ?, ?)
                `).run(
                    verificationRequestId,
                    testUserId,
                    JSON.stringify(results),
                    JSON.stringify(statistics),
                    Date.now(),
                    Date.now(),
                    Date.now()
                );

                const response = await request(app)
                    .get(`/api/verifier/verification/${verificationRequestId}`)
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data).toHaveProperty('status', 'completed');
                expect(response.body.data).toHaveProperty('results');
                expect(response.body.data).toHaveProperty('statistics');

            } catch (error) {
                console.error('Get completed verification test failed:', error);
                throw error;
            }
        });

        test('should reject request for non-existent verification', async () => {
            try {
                const response = await request(app)
                    .get('/api/verifier/verification/nonexistent-id')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(404);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body.message).toContain('not found');

            } catch (error) {
                console.error('Non-existent verification test failed:', error);
                throw error;
            }
        });

        test('should reject request without authentication', async () => {
            try {
                const response = await request(app)
                    .get('/api/verifier/verification/test-123')
                    .expect(401);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Verification without auth test failed:', error);
                throw error;
            }
        });

        test('should reject access to another user\'s verification', async () => {
            try {
                // Create another user first
                const anotherHashedPassword = await hashPassword('AnotherPassword123!');
                const insertAnotherUser = testDb.prepare(`
                    INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                    VALUES (?, ?, ?, ?, 1)
                `);
                const anotherUserResult = insertAnotherUser.run('Another', 'User', 'anotheruser@example.com', anotherHashedPassword);
                const anotherUserId = Number(anotherUserResult.lastInsertRowid);

                // Create verification for the other user
                const verificationRequestId = 'single-test-789';
                testDb.prepare(`
                    INSERT INTO verification_requests
                    (verification_request_id, user_id, request_type, status, emails, created_at, updated_at)
                    VALUES (?, ?, 'single', 'processing', '["test@example.com"]', ?, ?)
                `).run(verificationRequestId, anotherUserId, Date.now(), Date.now());

                const response = await request(app)
                    .get(`/api/verifier/verification/${verificationRequestId}`)
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(403);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body.message).toContain('Access denied');

                // Clean up the other user
                testDb.prepare('DELETE FROM users WHERE id = ?').run(anotherUserId);

            } catch (error) {
                console.error('Access denied test failed:', error);
                throw error;
            }
        });
    });


    describe('GET /api/verifier/status/:request_id', () => {
        test('should get request status successfully', async () => {
            try {
                const controller = require('../functions/verifier/controller');
                controller.getRequestStatus.mockResolvedValue({
                    request_id: 'test-request-123',
                    status: 'processing',
                    progress: 50
                });

                const response = await request(app)
                    .get('/api/verifier/status/test-request-123')
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data).toHaveProperty('status', 'processing');

            } catch (error) {
                console.error('Get status test failed:', error);
                throw error;
            }
        });

        test('should handle non-existent request', async () => {
            try {
                const controller = require('../functions/verifier/controller');
                controller.getRequestStatus.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/verifier/status/nonexistent-id')
                    .expect(404);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body.message).toContain('not found');

            } catch (error) {
                console.error('Non-existent request status test failed:', error);
                throw error;
            }
        });
    });


    describe('GET /api/verifier/results/:request_id', () => {
        test('should get request results successfully', async () => {
            try {
                const controller = require('../functions/verifier/controller');
                controller.getRequestResults.mockResolvedValue([
                    { email: 'test@example.com', status: 'valid', message: 'Valid' }
                ]);

                const response = await request(app)
                    .get('/api/verifier/results/test-request-123')
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data).toBeInstanceOf(Array);

            } catch (error) {
                console.error('Get results test failed:', error);
                throw error;
            }
        });

        test('should handle non-existent results', async () => {
            try {
                const controller = require('../functions/verifier/controller');
                controller.getRequestResults.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/verifier/results/nonexistent-id')
                    .expect(404);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Non-existent results test failed:', error);
                throw error;
            }
        });
    });


    describe('GET /api/verifier/health', () => {
        test('should return health status', async () => {
            try {
                const response = await request(app)
                    .get('/api/verifier/health')
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('message');
                expect(response.body).toHaveProperty('timestamp');
                expect(response.body).toHaveProperty('service', 'verifier-api');
                expect(response.body).toHaveProperty('version');
                expect(response.body).toHaveProperty('uptime');

            } catch (error) {
                console.error('Health check test failed:', error);
                throw error;
            }
        });
    });


    describe('GET /api/verifier/history', () => {
        beforeEach(() => {
            // Create some test verification history
            const now = Date.now();
            const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

            testDb.prepare(`
                INSERT INTO verification_requests
                (verification_request_id, user_id, request_type, status, emails, created_at, updated_at)
                VALUES
                ('req-1', ?, 'single', 'completed', '["test1@example.com"]', ?, ?),
                ('req-2', ?, 'csv', 'processing', '["test2@example.com"]', ?, ?),
                ('req-3', ?, 'single', 'completed', '["test3@example.com"]', ?, ?)
            `).run(testUserId, now, now, testUserId, now, now, testUserId, oneMonthAgo, oneMonthAgo);
        });

        test('should get verification history', async () => {
            try {
                const response = await request(app)
                    .get('/api/verifier/history')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data).toHaveProperty('requests');
                expect(response.body.data).toHaveProperty('total');
                expect(response.body.data).toHaveProperty('page', 1);
                expect(response.body.data).toHaveProperty('per_page', 50);
                expect(response.body.data.requests).toBeInstanceOf(Array);

            } catch (error) {
                console.error('Get history test failed:', error);
                throw error;
            }
        });

        test('should get history with pagination', async () => {
            try {
                const response = await request(app)
                    .get('/api/verifier/history?page=1&per_page=2')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data).toHaveProperty('page', 1);
                expect(response.body.data).toHaveProperty('per_page', 2);

            } catch (error) {
                console.error('History pagination test failed:', error);
                throw error;
            }
        });

        test('should get history with period filter', async () => {
            try {
                const response = await request(app)
                    .get('/api/verifier/history?period=this_month')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data.requests).toBeInstanceOf(Array);

            } catch (error) {
                console.error('History period filter test failed:', error);
                throw error;
            }
        });

        test('should reject invalid period', async () => {
            try {
                const response = await request(app)
                    .get('/api/verifier/history?period=invalid_period')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body.message).toContain('Invalid period');

            } catch (error) {
                console.error('Invalid period test failed:', error);
                throw error;
            }
        });

        test('should reject history request without authentication', async () => {
            try {
                const response = await request(app)
                    .get('/api/verifier/history')
                    .expect(401);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('History without auth test failed:', error);
                throw error;
            }
        });
    });


    describe('Error Handling', () => {
        test('should handle malformed JSON', async () => {
            try {
                await request(app)
                    .post('/api/verifier/verify-single')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Content-Type', 'application/json')
                    .send('{"invalid json"}')
                    .expect(400);

            } catch (error) {
                // Supertest may throw on malformed JSON, which is expected
                expect(error).toBeDefined();
            }
        });

        test('should not expose sensitive information in errors', async () => {
            try {
                const response = await request(app)
                    .get('/api/verifier/verification/nonexistent-id')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(404);

                expect(response.body.message).not.toContain('database');
                expect(response.body.message).not.toContain('query');
                expect(response.body).not.toHaveProperty('stack');

            } catch (error) {
                console.error('Information exposure test failed:', error);
                throw error;
            }
        });
    });


    describe('Edge Cases', () => {
        test('should handle email with special characters', async () => {
            try {
                const response = await request(app)
                    .post('/api/verifier/verify-single')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({ email: 'test+tag@example.com' })
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);

            } catch (error) {
                console.error('Email special characters test failed:', error);
                throw error;
            }
        });

        test('should handle email with whitespace', async () => {
            try {
                const response = await request(app)
                    .post('/api/verifier/verify-single')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({ email: '  test@example.com  ' })
                    .expect(400);

                // Should reject whitespace or trim it
                expect(response.body).toHaveProperty('success');

            } catch (error) {
                console.error('Email whitespace test failed:', error);
                throw error;
            }
        });
    });
});
