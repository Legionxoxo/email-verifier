/**
 * Extended Password Utilities Tests
 * Additional unit tests for password utility functions to improve coverage
 */

const { 
    hashPassword, 
    verifyPassword, 
    validatePasswordStrength,
    generateRandomPassword 
} = require('../functions/utils/password');

describe('Extended Password Utilities Unit Tests', () => {
    describe('validatePasswordStrength', () => {
        test('should validate strong passwords', () => {
            const strongPasswords = [
                'TestPassword123!',
                'AnotherStr0ng@Pass',
                'Complex1ty#Rules',
                'MySecure$Password9'
            ];

            for (const password of strongPasswords) {
                const result = validatePasswordStrength(password);
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            }
        });

        test('should reject weak passwords', () => {
            const weakPasswords = [
                'password',      // No uppercase, numbers, special chars
                'PASSWORD',      // No lowercase, numbers, special chars
                '12345678',      // No letters, special chars
                'Password',      // No numbers, special chars
                'Password123',   // No special chars
                'Password!',     // No numbers
                'Pass12!',       // Too short (7 chars)
                ''               // Empty
            ];

            for (const password of weakPasswords) {
                const result = validatePasswordStrength(password);
                expect(result.isValid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
            }
        });

        test('should handle null and undefined passwords', () => {
            const result1 = validatePasswordStrength(null);
            expect(result1.isValid).toBe(false);
            expect(result1.errors).toContain('Password is required');

            const result2 = validatePasswordStrength(undefined);
            expect(result2.isValid).toBe(false);
            expect(result2.errors).toContain('Password is required');
        });

        test('should handle very long passwords', () => {
            const longPassword = 'A'.repeat(200) + '1!';
            const result = validatePasswordStrength(longPassword);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Password must be less than 128 characters long');
        });

        test('should provide specific error messages', () => {
            const result = validatePasswordStrength('weak');
            
            expect(result.errors).toContain('Password must be at least 8 characters long');
            expect(result.errors).toContain('Password must contain at least one uppercase letter');
            expect(result.errors).toContain('Password must contain at least one number');
            expect(result.errors).toContain('Password must contain at least one special character');
        });
    });

    describe('generateRandomPassword', () => {
        test('should generate different passwords', () => {
            const password1 = generateRandomPassword();
            const password2 = generateRandomPassword();
            
            expect(password1).not.toBe(password2);
            expect(typeof password1).toBe('string');
            expect(typeof password2).toBe('string');
            expect(password1.length).toBeGreaterThan(0);
            expect(password2.length).toBeGreaterThan(0);
        });

        test('should generate passwords of specified length', () => {
            const lengths = [8, 12, 16, 20];
            
            for (const length of lengths) {
                const password = generateRandomPassword(length);
                expect(password.length).toBe(length);
            }
        });

        test('should generate passwords meeting strength requirements', () => {
            for (let i = 0; i < 5; i++) {
                const password = generateRandomPassword();
                const validation = validatePasswordStrength(password);
                expect(validation.isValid).toBe(true);
            }
        });

        test('should handle invalid length parameters', () => {
            expect(() => generateRandomPassword(0)).toThrow();
            expect(() => generateRandomPassword(-1)).toThrow();
            expect(() => generateRandomPassword(null)).toThrow();
        });
    });


    describe('Edge Cases and Error Handling', () => {
        test('should handle bcrypt errors in hashPassword', async () => {
            // Mock bcrypt to throw error
            const bcrypt = require('bcryptjs');
            const originalHash = bcrypt.hash;
            bcrypt.hash = jest.fn(() => {
                throw new Error('Bcrypt hash error');
            });

            await expect(hashPassword('TestPassword123!')).rejects.toThrow('Bcrypt hash error');

            // Restore original function
            bcrypt.hash = originalHash;
        });

        test('should handle bcrypt errors in verifyPassword', async () => {
            const password = 'TestPassword123!';
            const hash = await hashPassword(password);

            // Mock bcrypt to throw error
            const bcrypt = require('bcryptjs');
            const originalCompare = bcrypt.compare;
            bcrypt.compare = jest.fn(() => {
                throw new Error('Bcrypt compare error');
            });

            await expect(verifyPassword(password, hash)).rejects.toThrow('Bcrypt compare error');

            // Restore original function
            bcrypt.compare = originalCompare;
        });

        test('should handle various input types', async () => {
            // Test with numbers
            await expect(hashPassword(/** @type {any} */ (123))).rejects.toThrow();
            
            // Test with objects
            await expect(hashPassword(/** @type {any} */ ({}))).rejects.toThrow();
            
            // Test with arrays
            await expect(hashPassword(/** @type {any} */ ([]))).rejects.toThrow();
        });

        test('should handle special characters in passwords', async () => {
            const specialPasswords = [
                'Test@#$%^&*()Password123',
                'Unicode测试密码123!',
                'Emoji😀Password123!',
                'Quotes"\'Password123!'
            ];

            for (const password of specialPasswords) {
                const hash = await hashPassword(password);
                const isValid = await verifyPassword(password, hash);
                expect(isValid).toBe(true);
            }
        });
    });
});