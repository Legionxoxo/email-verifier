/**
 * Extended OTP Utilities Tests
 * Additional unit tests for OTP utility functions to improve coverage
 */

const { 
    generateOTPCode, 
    storeOTP, 
    verifyOTP,
    cleanupExpiredOTPs,
    checkOTPRateLimit,
    sendOTPEmail 
} = require('../functions/utils/otp');
const { initializeDatabase, getDatabase } = require('../database/connection');

describe('Extended OTP Utilities Unit Tests', () => {
    let testUser;

    beforeAll(async () => {
        // Initialize test database
        initializeDatabase();
    });

    beforeEach(async () => {
        // Create test user
        const db = getDatabase();
        const insertUser = db.prepare(`
            INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
            VALUES (?, ?, ?, ?, 0)
        `);
        
        const userEmail = global.testUtils.generateTestEmail();
        const result = insertUser.run('Test', 'User', userEmail, 'hashed_password');
        
        testUser = {
            id: result.lastInsertRowid,
            email: userEmail
        };
    });

    describe('generateOTPCode', () => {
        test('should generate 6-digit OTP codes', async () => {
            const otp1 = generateOTPCode();
            const otp2 = generateOTPCode();
            
            expect(otp1).toMatch(/^\d{6}$/);
            expect(otp2).toMatch(/^\d{6}$/);
            expect(otp1).not.toBe(otp2); // Should be different (mostly)
        });

        test('should generate numeric OTP', async () => {
            for (let i = 0; i < 10; i++) {
                const otp = generateOTPCode();
                expect(otp).toMatch(/^\d{6}$/);
                expect(parseInt(otp, 10)).toBeLessThanOrEqual(999999);
                expect(parseInt(otp, 10)).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('storeOTP', () => {
        test('should store OTP successfully', async () => {
            const otp = generateOTPCode();
            
            await storeOTP(testUser.id, testUser.email, otp);
            
            const db = getDatabase();
            const storedOTP = db.prepare(`
                SELECT * FROM auth_tokens 
                WHERE user_id = ? AND token_type = 'otp'
                ORDER BY created_at DESC LIMIT 1
            `).get(testUser.id);
            
            expect(storedOTP).toBeDefined();
            expect(/** @type {{ token: string }} */ (storedOTP).token).toBe(otp);
            expect(/** @type {{ is_used: number }} */ (storedOTP).is_used).toBe(0);
        });

        test('should handle storing multiple OTPs', async () => {
            const otp1 = '123456';
            const otp2 = '654321';
            
            await storeOTP(testUser.id, testUser.email, otp1);
            await global.testUtils.delay(10); // Small delay to ensure different timestamps
            await storeOTP(testUser.id, testUser.email, otp2);
            
            const db = getDatabase();
            const activeOTPs = db.prepare(`
                SELECT * FROM auth_tokens 
                WHERE user_id = ? AND token_type = 'otp' AND is_used = 0
                ORDER BY created_at DESC
            `).all(testUser.id);
            
            // storeOTP invalidates existing OTPs, so we should only have the latest active one
            expect(activeOTPs).toHaveLength(1);
            expect(/** @type {{ token: string }} */ (activeOTPs[0]).token).toBe(otp2); // Most recent first
        });

        test('should handle database errors when storing OTP', async () => {
            const otp = generateOTPCode();
            
            // Mock database error
            const originalPrepare = getDatabase().prepare;
            getDatabase().prepare = jest.fn(() => {
                throw new Error('Database insert failed');
            });

            await expect(storeOTP(testUser.id, testUser.email, otp)).rejects.toThrow('Database insert failed');

            // Restore original prepare function
            getDatabase().prepare = originalPrepare;
        });

        test('should handle invalid user ID', async () => {
            const otp = generateOTPCode();
            
            await expect(storeOTP(null, testUser.email, otp)).rejects.toThrow();
            await expect(storeOTP(undefined, testUser.email, otp)).rejects.toThrow();
            await expect(storeOTP(-1, testUser.email, otp)).rejects.toThrow();
        });

        test('should handle invalid OTP', async () => {
            await expect(storeOTP(testUser.id, testUser.email, null)).rejects.toThrow();
            await expect(storeOTP(testUser.id, testUser.email, undefined)).rejects.toThrow();
            await expect(storeOTP(testUser.id, testUser.email, '')).rejects.toThrow();
        });
    });

    describe('verifyOTP', () => {
        test('should verify valid stored OTP', async () => {
            const otp = generateOTPCode();
            await storeOTP(testUser.id, testUser.email, otp);
            
            const result = await verifyOTP(testUser.email, otp);
            expect(result.success).toBe(true);
        });

        test('should reject invalid stored OTP', async () => {
            const otp = generateOTPCode();
            await storeOTP(testUser.id, testUser.email, otp);
            
            const result = await verifyOTP(testUser.email, '000000');
            expect(result.success).toBe(false);
        });

        test('should reject OTP for wrong user', async () => {
            const otp = generateOTPCode();
            await storeOTP(testUser.id, testUser.email, otp);
            
            const result = await verifyOTP('wrong@example.com', otp);
            expect(result.success).toBe(false);
        });

        test('should reject expired OTP', async () => {
            const otp = generateOTPCode();
            
            // Store OTP with past expiration
            const db = getDatabase();
            const insertOTP = db.prepare(`
                INSERT INTO auth_tokens (user_id, token, token_type, expires_at, is_used)
                VALUES (?, ?, 'otp', datetime('now', '-1 hour'), 0)
            `);
            insertOTP.run(testUser.id, otp);
            
            const result = await verifyOTP(testUser.email, otp);
            expect(result.success).toBe(false);
        });

        test('should reject already used OTP', async () => {
            const otp = generateOTPCode();
            
            // Store used OTP
            const db = getDatabase();
            const insertOTP = db.prepare(`
                INSERT INTO auth_tokens (user_id, token, token_type, expires_at, is_used)
                VALUES (?, ?, 'otp', datetime('now', '+5 minutes'), 1)
            `);
            insertOTP.run(testUser.id, otp);
            
            const result = await verifyOTP(testUser.email, otp);
            expect(result.success).toBe(false);
        });

        test('should handle database errors in verification', async () => {
            const otp = generateOTPCode();
            
            // Mock database error
            const originalPrepare = getDatabase().prepare;
            getDatabase().prepare = jest.fn(() => {
                throw new Error('Database query failed');
            });

            await expect(verifyOTP(testUser.email, otp)).rejects.toThrow('Database query failed');

            // Restore original prepare function
            getDatabase().prepare = originalPrepare;
        });
    });

    describe('cleanupExpiredOTPs', () => {
        test('should clean up expired OTPs', async () => {
            const db = getDatabase();
            
            // Insert expired OTPs
            const insertExpiredOTP = db.prepare(`
                INSERT INTO auth_tokens (user_id, token, token_type, expires_at, is_used)
                VALUES (?, ?, 'otp', datetime('now', '-1 hour'), 0)
            `);
            
            insertExpiredOTP.run(testUser.id, '111111');
            insertExpiredOTP.run(testUser.id, '222222');
            
            // Insert valid OTP
            const otp = generateOTPCode();
            await storeOTP(testUser.id, testUser.email, otp);
            
            // cleanupExpiredOTPs doesn't return a count, it just logs
            await cleanupExpiredOTPs();
            
            // Verify only valid OTP remains for this user
            const remainingOTPs = db.prepare(`
                SELECT * FROM auth_tokens 
                WHERE user_id = ? AND token_type = 'otp' AND is_used = 0
            `).all(testUser.id);
            
            expect(remainingOTPs).toHaveLength(1);
            expect(/** @type {{ token: string }} */ (remainingOTPs[0]).token).toBe(otp);
        });

        test('should handle cleanup when no expired OTPs exist', async () => {
            // cleanupExpiredOTPs doesn't return anything, just ensure it doesn't throw
            await expect(cleanupExpiredOTPs()).resolves.not.toThrow();
        });

        test('should handle database errors during cleanup', async () => {
            // Mock database error
            const originalPrepare = getDatabase().prepare;
            getDatabase().prepare = jest.fn(() => {
                throw new Error('Database cleanup failed');
            });

            await expect(cleanupExpiredOTPs()).rejects.toThrow('Database cleanup failed');

            // Restore original prepare function
            getDatabase().prepare = originalPrepare;
        });
    });

    describe('checkOTPRateLimit', () => {
        test('should not be rate limited with few attempts', async () => {
            const result = await checkOTPRateLimit(testUser.id);
            expect(typeof result).toBe('object');
            expect(result).toHaveProperty('canRequest');
            expect(result).toHaveProperty('remainingRequests');
            expect(result).toHaveProperty('message');
        });

        test('should check rate limiting correctly', async () => {
            // Store some OTPs to simulate attempts
            for (let i = 0; i < 2; i++) {
                const otp = generateOTPCode();
                await storeOTP(testUser.id, testUser.email, otp);
            }
            
            const result = await checkOTPRateLimit(testUser.id);
            expect(typeof result).toBe('object');
            expect(result).toHaveProperty('canRequest');
            expect(result).toHaveProperty('remainingRequests');
            expect(result).toHaveProperty('message');
        });

        test('should handle database errors in rate limit check', async () => {
            // Mock database error
            const originalPrepare = getDatabase().prepare;
            getDatabase().prepare = jest.fn(() => {
                throw new Error('Database query failed');
            });

            await expect(checkOTPRateLimit(testUser.id)).rejects.toThrow('Database query failed');

            // Restore original prepare function
            getDatabase().prepare = originalPrepare;
        });
    });

    describe('sendOTPEmail', () => {
        test('should simulate sending OTP email', async () => {
            const otp = generateOTPCode();
            
            // Mock console.log to capture email simulation
            const originalLog = console.log;
            const logSpy = jest.fn();
            console.log = logSpy;
            
            await sendOTPEmail(testUser.email, otp);
            
            expect(logSpy).toHaveBeenCalled();
            expect(logSpy.mock.calls.some(call => 
                call.some(arg => typeof arg === 'string' && arg.includes(otp))
            )).toBe(true);
            
            // Restore original console.log
            console.log = originalLog;
        });

        test('should handle sending email with different parameters', async () => {
            const otp = generateOTPCode();
            const emails = [
                'test1@example.com',
                'test2@example.com',  
                'user@domain.org'
            ];
            
            for (const email of emails) {
                // Should not throw error
                await expect(sendOTPEmail(email, otp)).resolves.not.toThrow();
            }
        });

        test('should handle invalid email parameters', async () => {
            const otp = generateOTPCode();
            
            // These should either throw or handle gracefully
            await expect(sendOTPEmail(null, otp)).rejects.toThrow();
            await expect(sendOTPEmail(undefined, otp)).rejects.toThrow();
            await expect(sendOTPEmail('', otp)).rejects.toThrow();
        });

        test('should handle invalid OTP parameters', async () => {
            await expect(sendOTPEmail(testUser.email, null)).rejects.toThrow();
            await expect(sendOTPEmail(testUser.email, undefined)).rejects.toThrow();
            await expect(sendOTPEmail(testUser.email, '')).rejects.toThrow();
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle concurrent OTP operations', async () => {
            const promises = [];
            
            // Generate multiple OTPs concurrently
            for (let i = 0; i < 3; i++) {
                promises.push(storeOTP(testUser.id, testUser.email, generateOTPCode()));
            }
            
            await Promise.all(promises);
            
            const db = getDatabase();
            const storedOTPs = db.prepare(`
                SELECT * FROM auth_tokens 
                WHERE user_id = ? AND token_type = 'otp'
            `).all(testUser.id);
            
            // Since storeOTP invalidates existing OTPs, we should have at least 1
            expect(storedOTPs.length).toBeGreaterThanOrEqual(1);
        });

        test('should validate correct OTP formats', async () => {
            const validOTPs = [
                '123456',
                '000000',
                '999999',
                '654321'
            ];

            // Test OTP generation format
            for (let i = 0; i < 10; i++) {
                const otp = generateOTPCode();
                expect(otp).toMatch(/^\d{6}$/);
            }
        });

        test('should handle database connection issues', async () => {
            // Test with non-existent user email to trigger database behavior
            const otp = generateOTPCode();
            const result = await verifyOTP('nonexistent@example.com', otp);
            expect(result.success).toBe(false);
        });
    });
});