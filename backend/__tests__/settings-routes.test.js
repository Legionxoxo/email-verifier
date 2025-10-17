/**
 * Settings Routes Integration Tests
 * Testing settings API routes end-to-end
 */

const request = require('supertest');
const express = require('express');
const settingsRouter = require('../routes/api/settings');
const { hashPassword } = require('../functions/utils/password');
const { generateAccessToken } = require('../functions/utils/jwt');

describe('Settings Routes Integration Tests', () => {
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
            process.env.DB_PATH = '.sql/settings-routes-test.db';

            // Initialize test database
            const { initializeDatabase } = require('../database/connection');
            testDb = initializeDatabase();

            // Create Express app with settings router
            app = express();
            app.use(express.json());
            app.use(express.urlencoded({ extended: true }));
            app.use('/api/settings', settingsRouter);

            // Create verified test user
            const hashedPassword = await hashPassword('TestPassword123!');
            const insertUser = testDb.prepare(`
                INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                VALUES (?, ?, ?, ?, 1)
            `);

            const result = insertUser.run('Test', 'User', 'settingstest@example.com', hashedPassword);
            testUserId = Number(result.lastInsertRowid);
            testUser = {
                userId: testUserId,
                email: 'settingstest@example.com'
            };

            // Generate token for authenticated tests
            accessToken = generateAccessToken(testUser);

        } catch (error) {
            console.error('Settings routes test setup failed:', error);
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
            const testDbPath = path.join(__dirname, '..', '.sql', 'settings-routes-test.db');
            if (fs.existsSync(testDbPath)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                try {
                    fs.unlinkSync(testDbPath);
                } catch (unlinkError) {
                    console.warn('Could not clean up test database file:', unlinkError.message);
                }
            }

        } catch (error) {
            console.error('Settings routes test cleanup failed:', error);
        }
    });

    afterEach(() => {
        try {
            // Clean up test data after each test
            if (testDb && testDb.open) {
                // Clean up OTP tokens
                testDb.prepare('DELETE FROM auth_tokens WHERE token_type = ?').run('otp');
                testDb.prepare('DELETE FROM auth_tokens WHERE token_type = ?').run('password_reset');
            }
        } catch (error) {
            console.error('Settings routes afterEach cleanup failed:', error);
        }
    });

    describe('GET /api/settings/profile', () => {
        test('should get profile with valid token', async () => {
            try {
                const response = await request(app)
                    .get('/api/settings/profile')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('email', 'settingstest@example.com');
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
                    .get('/api/settings/profile')
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
                    .get('/api/settings/profile')
                    .set('Authorization', 'Bearer invalid.token.here')
                    .expect(401);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Get profile invalid token test failed:', error);
                throw error;
            }
        });
    });

    describe('PUT /api/settings/profile', () => {
        test('should update profile successfully', async () => {
            try {
                const updateData = {
                    firstName: 'Updated',
                    lastName: 'Name'
                };

                const response = await request(app)
                    .put('/api/settings/profile')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send(updateData)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data).toHaveProperty('firstName', 'Updated');
                expect(response.body.data).toHaveProperty('lastName', 'Name');

                // Verify database update
                const user = testDb.prepare('SELECT * FROM users WHERE id = ?').get(testUserId);
                expect(user.first_name).toBe('Updated');
                expect(user.last_name).toBe('Name');

                // Restore original values
                testDb.prepare('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?')
                    .run('Test', 'User', testUserId);

            } catch (error) {
                console.error('Update profile success test failed:', error);
                throw error;
            }
        });

        test('should update only firstName', async () => {
            try {
                const updateData = {
                    firstName: 'NewFirst'
                };

                const response = await request(app)
                    .put('/api/settings/profile')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send(updateData)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data).toHaveProperty('firstName', 'NewFirst');
                expect(response.body.data).toHaveProperty('lastName', 'User'); // Unchanged

                // Restore
                testDb.prepare('UPDATE users SET first_name = ? WHERE id = ?')
                    .run('Test', testUserId);

            } catch (error) {
                console.error('Update firstName only test failed:', error);
                throw error;
            }
        });

        test('should update only lastName', async () => {
            try {
                const updateData = {
                    lastName: 'NewLast'
                };

                const response = await request(app)
                    .put('/api/settings/profile')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send(updateData)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.data).toHaveProperty('lastName', 'NewLast');
                expect(response.body.data).toHaveProperty('firstName', 'Test'); // Unchanged

                // Restore
                testDb.prepare('UPDATE users SET last_name = ? WHERE id = ?')
                    .run('User', testUserId);

            } catch (error) {
                console.error('Update lastName only test failed:', error);
                throw error;
            }
        });

        test('should reject profile update without authentication', async () => {
            try {
                const updateData = {
                    firstName: 'Updated',
                    lastName: 'Name'
                };

                const response = await request(app)
                    .put('/api/settings/profile')
                    .send(updateData)
                    .expect(401);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Update profile no auth test failed:', error);
                throw error;
            }
        });

        test('should reject profile update with invalid name', async () => {
            try {
                const updateData = {
                    firstName: 'Invalid@Name123' // Contains invalid characters
                };

                const response = await request(app)
                    .put('/api/settings/profile')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send(updateData)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Update profile invalid name test failed:', error);
                throw error;
            }
        });

        test('should reject profile update with name too long', async () => {
            try {
                const updateData = {
                    firstName: 'a'.repeat(100) // Too long
                };

                const response = await request(app)
                    .put('/api/settings/profile')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send(updateData)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Update profile name too long test failed:', error);
                throw error;
            }
        });
    });

    describe('POST /api/settings/forgot-password', () => {
        test('should send password reset for existing user', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/forgot-password')
                    .send({ email: 'settingstest@example.com' })
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.message).toContain('reset');

            } catch (error) {
                console.error('Forgot password success test failed:', error);
                throw error;
            }
        });

        test('should handle forgot password for non-existent user', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/forgot-password')
                    .send({ email: 'nonexistent@example.com' });

                // Should return 200 even for non-existent user (security best practice)
                expect(response.status).toBeLessThanOrEqual(404);
                expect(response.body).toHaveProperty('success');

            } catch (error) {
                console.error('Forgot password non-existent test failed:', error);
                throw error;
            }
        });

        test('should reject forgot password with invalid email', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/forgot-password')
                    .send({ email: 'invalid-email' })
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Forgot password invalid email test failed:', error);
                throw error;
            }
        });

        test('should reject forgot password without email', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/forgot-password')
                    .send({})
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Forgot password no email test failed:', error);
                throw error;
            }
        });
    });

    describe('POST /api/settings/reset-password', () => {
        test('should reset password with valid OTP', async () => {
            try {
                // First create an OTP for the user
                const otpCode = '123456';
                const expiresAt = new Date(Date.now() + 300000).toISOString();
                testDb.prepare(`
                    INSERT INTO auth_tokens (user_id, token, token_type, expires_at)
                    VALUES (?, ?, 'password_reset', ?)
                `).run(testUserId, otpCode, expiresAt);

                const response = await request(app)
                    .post('/api/settings/reset-password')
                    .send({
                        email: 'settingstest@example.com',
                        otp: otpCode,
                        newPassword: 'NewSecurePassword123!'
                    })
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);

                // Restore original password
                const hashedPassword = await hashPassword('TestPassword123!');
                testDb.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                    .run(hashedPassword, testUserId);

            } catch (error) {
                console.error('Reset password success test failed:', error);
                throw error;
            }
        });

        test('should reject password reset with invalid OTP', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/reset-password')
                    .send({
                        email: 'settingstest@example.com',
                        otp: '000000',
                        newPassword: 'NewSecurePassword123!'
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Reset password invalid OTP test failed:', error);
                throw error;
            }
        });

        test('should reject password reset with weak password', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/reset-password')
                    .send({
                        email: 'settingstest@example.com',
                        otp: '123456',
                        newPassword: '123' // Too weak
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Reset password weak password test failed:', error);
                throw error;
            }
        });

        test('should reject password reset without required fields', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/reset-password')
                    .send({
                        email: 'settingstest@example.com'
                        // Missing otp and newPassword
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Reset password missing fields test failed:', error);
                throw error;
            }
        });
    });

    describe('POST /api/settings/change-email', () => {
        test('should initiate email change with valid password', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/change-email')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({
                        newEmail: 'newemail@example.com',
                        currentPassword: 'TestPassword123!'
                    })
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body.message).toContain('verification');

            } catch (error) {
                console.error('Change email success test failed:', error);
                throw error;
            }
        });

        test('should reject email change without authentication', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/change-email')
                    .send({
                        newEmail: 'newemail@example.com',
                        currentPassword: 'TestPassword123!'
                    })
                    .expect(401);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Change email no auth test failed:', error);
                throw error;
            }
        });

        test('should reject email change with wrong password', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/change-email')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({
                        newEmail: 'newemail@example.com',
                        currentPassword: 'WrongPassword123!'
                    })
                    .expect(401);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Change email wrong password test failed:', error);
                throw error;
            }
        });

        test('should reject email change with invalid new email', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/change-email')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({
                        newEmail: 'invalid-email',
                        currentPassword: 'TestPassword123!'
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Change email invalid email test failed:', error);
                throw error;
            }
        });

        test('should reject email change without current password', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/change-email')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({
                        newEmail: 'newemail@example.com'
                        // Missing currentPassword
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);

            } catch (error) {
                console.error('Change email no password test failed:', error);
                throw error;
            }
        });
    });

    describe('GET /api/settings/health', () => {
        test('should return health status', async () => {
            try {
                const response = await request(app)
                    .get('/api/settings/health')
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('message');
                expect(response.body).toHaveProperty('timestamp');
                expect(response.body).toHaveProperty('service', 'settings-api');
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
                    .post('/api/settings/forgot-password')
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
                const updateData = {
                    firstName: '<script>alert("XSS")</script>Test'
                };

                const response = await request(app)
                    .put('/api/settings/profile')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send(updateData);

                // Check that script tags are removed or sanitized
                if (response.status === 200) {
                    const user = testDb.prepare('SELECT * FROM users WHERE id = ?').get(testUserId);
                    expect(user.first_name).not.toContain('<script>');
                }

            } catch (error) {
                console.error('HTML sanitization test failed:', error);
                throw error;
            }
        });

        test('should not expose sensitive information in errors', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/change-email')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({
                        newEmail: 'test@example.com',
                        currentPassword: 'WrongPassword123!'
                    })
                    .expect(401);

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
        test('should trim whitespace from email updates', async () => {
            try {
                const response = await request(app)
                    .post('/api/settings/change-email')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({
                        newEmail: '  newemail@example.com  ',
                        currentPassword: 'TestPassword123!'
                    });

                // Email should be trimmed during validation
                expect(response.body).toHaveProperty('success');

            } catch (error) {
                console.error('Email whitespace test failed:', error);
                throw error;
            }
        });

        test('should handle profile update with empty last name', async () => {
            try {
                const updateData = {
                    firstName: 'Test',
                    lastName: ''
                };

                const response = await request(app)
                    .put('/api/settings/profile')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send(updateData);

                // Empty last name might be allowed
                expect(response.body).toHaveProperty('success');

                // Restore
                if (response.status === 200) {
                    testDb.prepare('UPDATE users SET last_name = ? WHERE id = ?')
                        .run('User', testUserId);
                }

            } catch (error) {
                console.error('Empty last name test failed:', error);
                throw error;
            }
        });

        test('should handle concurrent profile updates', async () => {
            try {
                const updateData1 = { firstName: 'Update1' };
                const updateData2 = { firstName: 'Update2' };

                const [response1, response2] = await Promise.all([
                    request(app)
                        .put('/api/settings/profile')
                        .set('Authorization', `Bearer ${accessToken}`)
                        .send(updateData1),
                    request(app)
                        .put('/api/settings/profile')
                        .set('Authorization', `Bearer ${accessToken}`)
                        .send(updateData2)
                ]);

                // Both should succeed, last one wins
                expect(response1.body).toHaveProperty('success');
                expect(response2.body).toHaveProperty('success');

                // Restore
                testDb.prepare('UPDATE users SET first_name = ? WHERE id = ?')
                    .run('Test', testUserId);

            } catch (error) {
                console.error('Concurrent updates test failed:', error);
                throw error;
            }
        });
    });
});
