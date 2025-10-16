/**
 * Password Reset Route Functions Tests
 * Unit tests for password reset functionality
 */

const { initializeDatabase, getDatabase } = require('../database/connection');
const { handleForgotPassword, handleResetPassword } = require('../functions/route_fns/auth/password');
const { generatePasswordResetToken } = require('../functions/utils/jwt');
const { hashPassword } = require('../functions/utils/password');

describe('Password Reset Route Functions Unit Tests', () => {
    let mockReq;
    let mockRes;
    let testUser;

    beforeAll(async () => {
        // Initialize test database
        initializeDatabase();
    });

    beforeEach(async () => {
        // Create test user
        const db = getDatabase();
        const hashedPassword = await hashPassword('TestPassword123!');
        
        const insertUser = db.prepare(`
            INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
            VALUES (?, ?, ?, ?, 1)
        `);
        
        const userEmail = global.testUtils.generateTestEmail();
        const result = insertUser.run('Test', 'User', userEmail, hashedPassword);
        
        testUser = {
            id: result.lastInsertRowid,
            email: userEmail,
            firstName: 'Test',
            lastName: 'User'
        };

        // Mock request and response objects
        mockReq = {
            body: {}
        };

        mockRes = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis()
        };
    });

    describe('handleForgotPassword', () => {
        test('should handle forgot password for existing user', async () => {
            mockReq.body = {
                email: testUser.email
            };

            await handleForgotPassword(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'If an account with this email exists, you will receive a password reset link.'
            });
        });

        test('should handle forgot password for non-existent user', async () => {
            mockReq.body = {
                email: 'nonexistent@example.com'
            };

            await handleForgotPassword(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'If an account with this email exists, you will receive a password reset link.'
            });
        });

        test('should handle forgot password with missing email', async () => {
            mockReq.body = {};

            await handleForgotPassword(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'If an account with this email exists, you will receive a password reset link.'
            });
        });

        test('should handle forgot password with database error', async () => {
            // Mock database error
            const originalPrepare = getDatabase().prepare;
            getDatabase().prepare = jest.fn(() => {
                throw new Error('Database error');
            });

            mockReq.body = {
                email: testUser.email
            };

            await handleForgotPassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Password reset request failed'
            });

            // Restore original prepare function
            getDatabase().prepare = originalPrepare;
        });
    });

    describe('handleResetPassword', () => {
        test('should reset password with valid token', async () => {
            // Generate a valid reset token
            const resetToken = await generatePasswordResetToken({
                userId: testUser.id,
                email: testUser.email
            });

            mockReq.body = {
                token: resetToken,
                newPassword: 'NewPassword123!'
            };

            await handleResetPassword(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Password reset successfully. Please log in with your new password.'
            });

            // Verify password was actually changed
            const db = getDatabase();
            const updatedUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(testUser.id);
            expect(/** @type {{ password_hash: string }} */ (updatedUser).password_hash).not.toBe(testUser.password_hash);
        });

        test('should reject password reset with invalid token', async () => {
            mockReq.body = {
                token: 'invalid-token',
                newPassword: 'NewPassword123!'
            };

            await handleResetPassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Password reset failed'
            });
        });

        test('should reject password reset with missing token', async () => {
            mockReq.body = {
                newPassword: 'NewPassword123!'
            };

            await handleResetPassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Password reset failed'
            });
        });

        test('should reject password reset with missing password', async () => {
            const resetToken = await generatePasswordResetToken({
                userId: testUser.id,
                email: testUser.email
            });

            mockReq.body = {
                token: resetToken
            };

            await handleResetPassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Password reset failed'
            });
        });

        test('should handle password hashing error', async () => {
            const resetToken = await generatePasswordResetToken({
                userId: testUser.id,
                email: testUser.email
            });

            mockReq.body = {
                token: resetToken,
                newPassword: null  // This will cause hashPassword to fail
            };

            await handleResetPassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Password reset failed'
            });
        });

        test('should handle database update error', async () => {
            const resetToken = await generatePasswordResetToken({
                userId: testUser.id,
                email: testUser.email
            });

            // Mock database prepare to throw error on UPDATE
            const originalPrepare = getDatabase().prepare;
            getDatabase().prepare = jest.fn((sql) => {
                if (sql.includes('UPDATE users')) {
                    return {
                        run: jest.fn(() => {
                            throw new Error('Database update failed');
                        })
                    };
                }
                return originalPrepare.call(getDatabase(), sql);
            });

            mockReq.body = {
                token: resetToken,
                newPassword: 'NewPassword123!'
            };

            await handleResetPassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Password reset failed'
            });

            // Restore original prepare function
            getDatabase().prepare = originalPrepare;
        });
    });
});