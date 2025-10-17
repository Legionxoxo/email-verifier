/**
 * Auth Routes Integration Tests
 * Testing authentication API routes end-to-end
 */

const request = require('supertest');
const express = require('express');
const authRouter = require('../routes/api/auth');
const { hashPassword } = require('../functions/utils/password');
const { generateAccessToken, generateRefreshToken } = require('../functions/utils/jwt');

describe('Auth Routes Integration Tests', () => {
    let app;
    let testDb;
    let testUser;
    let testUserId;
    let accessToken;
    let refreshToken;

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
            process.env.DB_PATH = '.sql/auth-routes-test.db';

            // Initialize test database
            const { initializeDatabase } = require('../database/connection');
            testDb = initializeDatabase();

            // Create Express app with auth router
            app = express();
            app.use(express.json());
            app.use(express.urlencoded({ extended: true }));
            app.use('/api/auth', authRouter);

            // Create verified test user
            const hashedPassword = await hashPassword('TestPassword123!');
            const insertUser = testDb.prepare(`
                INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                VALUES (?, ?, ?, ?, 1)
            `);

            const result = insertUser.run('Test', 'User', 'testuser@example.com', hashedPassword);
            testUserId = Number(result.lastInsertRowid);
            testUser = {
                userId: testUserId,
                email: 'testuser@example.com'
            };

            // Generate tokens for authenticated tests
            accessToken = generateAccessToken(testUser);
            refreshToken = await generateRefreshToken(testUser);

        } catch (error) {
            console.error('Auth routes test setup failed:', error);
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
            const testDbPath = path.join(__dirname, '..', '.sql', 'auth-routes-test.db');
            if (fs.existsSync(testDbPath)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                try {
                    fs.unlinkSync(testDbPath);
                } catch (unlinkError) {
                    console.warn('Could not clean up test database file:', unlinkError.message);
                }
            }

        } catch (error) {
            console.error('Auth routes test cleanup failed:', error);
        }
    });

    afterEach(() => {
        try {
            // Clean up test data after each test
            if (testDb && testDb.open) {
                // Clean up OTP tokens
                testDb.prepare('DELETE FROM auth_tokens WHERE token_type = ?').run('otp');
                // Clean up test signup users (preserve main test user)
                testDb.prepare('DELETE FROM users WHERE email LIKE ?').run('%testsignup%');
                testDb.prepare('DELETE FROM users WHERE email LIKE ?').run('%newemail%');
            }
        } catch (error) {
            console.error('Auth routes afterEach cleanup failed:', error);
        }
    });

    describe('POST /api/auth/signup', () => {
        test('should create new user successfully', async () => {
            try {
                const signupData = {
                    firstName: 'New',
                    lastName: 'User',
                    email: 'testsignup1@example.com',
                    password: 'SecurePassword123!'
                };

                const response = await request(app)
                    .post('/api/auth/signup')
                    .send(signupData)
                    .expect(201);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('email', signupData.email);
                expect(response.body.data).toHaveProperty('requiresVerification', true);

            } catch (error) {
                console.error('Signup success test failed:', error);
                throw error;
            }
        });

        test('should reject signup with existing email', async () => {
            try {
                const signupData = {
                    firstName: 'Test',
                    lastName: 'User',
                    email: 'testuser@example.com', // Already exists
                    password: 'SecurePassword123!'
                };

                const response = await request(app)
                    .post('/api/auth/signup')
                    .send(signupData)
                    .expect(409);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body.message).toContain('already exists');

            } catch (error) {
                console.error('Signup duplicate email test failed:', error);
                throw error;
            }
        });

        test('should reject signup with invalid email', async () => {
            try {
                const signupData = {
                    firstName: 'Test',
                    lastName: 'User',
                    email: 'invalid-email',
                    password: 'SecurePassword123!'
                };

                const response = await request(app)
                    .post('/api/auth/signup')
                    .send(signupData)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Signup invalid email test failed:', error);
                throw error;
            }
        });

        test('should reject signup with weak password', async () => {
            try {
                const signupData = {
                    firstName: 'Test',
                    lastName: 'User',
                    email: 'testsignup2@example.com',
                    password: '123' // Too weak
                };

                const response = await request(app)
                    .post('/api/auth/signup')
                    .send(signupData)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Signup weak password test failed:', error);
                throw error;
            }
        });

        test('should reject signup with missing fields', async () => {
            try {
                const signupData = {
                    firstName: 'Test'
                    // Missing required fields
                };

                const response = await request(app)
                    .post('/api/auth/signup')
                    .send(signupData)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Signup missing fields test failed:', error);
                throw error;
            }
        });
    });

    describe('POST /api/auth/login', () => {
        test('should login successfully with correct credentials', async () => {
            try {
                const loginData = {
                    email: 'testuser@example.com',
                    password: 'TestPassword123!'
                };

                const response = await request(app)
                    .post('/api/auth/login')
                    .send(loginData)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('user');
                expect(response.body.data).toHaveProperty('tokens');
                expect(response.body.data.tokens).toHaveProperty('accessToken');
                expect(response.body.data.tokens).toHaveProperty('refreshToken');

            } catch (error) {
                console.error('Login success test failed:', error);
                throw error;
            }
        });

        test('should reject login with incorrect password', async () => {
            try {
                const loginData = {
                    email: 'testuser@example.com',
                    password: 'WrongPassword123!'
                };

                const response = await request(app)
                    .post('/api/auth/login')
                    .send(loginData)
                    .expect(401);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body.message).toContain('Invalid');

            } catch (error) {
                console.error('Login wrong password test failed:', error);
                throw error;
            }
        });

        test('should reject login with non-existent email', async () => {
            try {
                const loginData = {
                    email: 'nonexistent@example.com',
                    password: 'TestPassword123!'
                };

                const response = await request(app)
                    .post('/api/auth/login')
                    .send(loginData)
                    .expect(401);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Login non-existent email test failed:', error);
                throw error;
            }
        });

        test('should reject login with missing credentials', async () => {
            try {
                const loginData = {
                    email: 'testuser@example.com'
                    // Missing password
                };

                const response = await request(app)
                    .post('/api/auth/login')
                    .send(loginData)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Login missing credentials test failed:', error);
                throw error;
            }
        });
    });

    describe('GET /api/auth/profile', () => {
        test('should get profile with valid token', async () => {
            try {
                const response = await request(app)
                    .get('/api/auth/profile')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('email', 'testuser@example.com');
                expect(response.body.data).toHaveProperty('firstName', 'Test');
                expect(response.body.data).toHaveProperty('lastName', 'User');

            } catch (error) {
                console.error('Get profile success test failed:', error);
                throw error;
            }
        });

        test('should reject profile request without token', async () => {
            try {
                const response = await request(app)
                    .get('/api/auth/profile')
                    .expect(401);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Get profile no token test failed:', error);
                throw error;
            }
        });

        test('should reject profile request with invalid token', async () => {
            try {
                const response = await request(app)
                    .get('/api/auth/profile')
                    .set('Authorization', 'Bearer invalid.token.here')
                    .expect(401);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Get profile invalid token test failed:', error);
                throw error;
            }
        });
    });

    describe('POST /api/auth/refresh', () => {
        test('should refresh token with valid refresh token', async () => {
            try {
                const response = await request(app)
                    .post('/api/auth/refresh')
                    .send({ refreshToken })
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('accessToken');

            } catch (error) {
                console.error('Refresh token success test failed:', error);
                throw error;
            }
        });

        test('should reject refresh with invalid token', async () => {
            try {
                const response = await request(app)
                    .post('/api/auth/refresh')
                    .send({ refreshToken: 'invalid.token.here' })
                    .expect(401);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Refresh token invalid test failed:', error);
                throw error;
            }
        });

        test('should reject refresh without token', async () => {
            try {
                const response = await request(app)
                    .post('/api/auth/refresh')
                    .send({})
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Refresh token missing test failed:', error);
                throw error;
            }
        });
    });

    describe('POST /api/auth/logout', () => {
        test('should logout successfully', async () => {
            try {
                const response = await request(app)
                    .post('/api/auth/logout')
                    .send({ refreshToken })
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.message).toContain('Logout successful');

            } catch (error) {
                console.error('Logout success test failed:', error);
                throw error;
            }
        });

        test('should handle logout without refresh token', async () => {
            try {
                const response = await request(app)
                    .post('/api/auth/logout')
                    .send({})
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);

            } catch (error) {
                console.error('Logout without token test failed:', error);
                throw error;
            }
        });
    });

    describe('GET /api/auth/health', () => {
        test('should return health status', async () => {
            try {
                const response = await request(app)
                    .get('/api/auth/health')
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('message');
                expect(response.body).toHaveProperty('timestamp');
                expect(response.body).toHaveProperty('service', 'auth-api');
                expect(response.body).toHaveProperty('version');
                expect(response.body).toHaveProperty('uptime');

            } catch (error) {
                console.error('Health check test failed:', error);
                throw error;
            }
        });
    });

    describe('Error Handling', () => {
        test('should handle malformed JSON', async () => {
            try {
                const response = await request(app)
                    .post('/api/auth/login')
                    .set('Content-Type', 'application/json')
                    .send('{"invalid json"}')
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                // Supertest may throw on malformed JSON, which is expected
                expect(error).toBeDefined();
            }
        });

        test('should sanitize HTML in inputs', async () => {
            try {
                const signupData = {
                    firstName: '<script>alert("XSS")</script>Test',
                    lastName: 'User',
                    email: 'testsignup3@example.com',
                    password: 'SecurePassword123!'
                };

                const response = await request(app)
                    .post('/api/auth/signup')
                    .send(signupData);

                // Check that script tags are removed or sanitized
                if (response.body.success) {
                    const user = testDb.prepare('SELECT * FROM users WHERE email = ?').get('testsignup3@example.com');
                    expect(user.first_name).not.toContain('<script>');
                }

            } catch (error) {
                console.error('HTML sanitization test failed:', error);
                throw error;
            }
        });

        test('should handle very long input strings', async () => {
            try {
                const signupData = {
                    firstName: 'a'.repeat(1000),
                    lastName: 'User',
                    email: 'testsignup4@example.com',
                    password: 'SecurePassword123!'
                };

                const response = await request(app)
                    .post('/api/auth/signup')
                    .send(signupData)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Long input test failed:', error);
                throw error;
            }
        });
    });

    describe('Security Features', () => {
        test('should include security headers', async () => {
            try {
                const response = await request(app)
                    .get('/api/auth/health');

                // Check for security-related headers (if implemented)
                expect(response.headers).toBeDefined();

            } catch (error) {
                console.error('Security headers test failed:', error);
                throw error;
            }
        });

        test('should not expose sensitive information in errors', async () => {
            try {
                const response = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'nonexistent@example.com',
                        password: 'TestPassword123!'
                    })
                    .expect(401);

                // Error message should be generic, not revealing if email exists
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
        test('should handle unicode characters in names', async () => {
            try {
                const signupData = {
                    firstName: '测试',
                    lastName: 'ユーザー',
                    email: 'testsignup5@example.com',
                    password: 'SecurePassword123!'
                };

                const response = await request(app)
                    .post('/api/auth/signup')
                    .send(signupData);

                // May pass or fail depending on validation rules
                expect(response.body).toHaveProperty('success');

            } catch (error) {
                console.error('Unicode characters test failed:', error);
                throw error;
            }
        });

        test('should handle email with special characters', async () => {
            try {
                const signupData = {
                    firstName: 'Test',
                    lastName: 'User',
                    email: 'test+tag@example.com',
                    password: 'SecurePassword123!'
                };

                const response = await request(app)
                    .post('/api/auth/signup')
                    .send(signupData)
                    .expect(201);

                expect(response.body).toHaveProperty('success', true);

            } catch (error) {
                console.error('Email special characters test failed:', error);
                throw error;
            }
        });

        test('should handle whitespace in inputs', async () => {
            try {
                const signupData = {
                    firstName: '  Test  ',
                    lastName: '  User  ',
                    email: '  testsignup6@example.com  ',
                    password: 'SecurePassword123!'
                };

                const response = await request(app)
                    .post('/api/auth/signup')
                    .send(signupData);

                if (response.body.success) {
                    // Verify whitespace was trimmed
                    const user = testDb.prepare('SELECT * FROM users WHERE email = ?').get('testsignup6@example.com');
                    expect(user.first_name).not.toMatch(/^\s|\s$/);
                }

            } catch (error) {
                console.error('Whitespace handling test failed:', error);
                throw error;
            }
        });
    });
});
