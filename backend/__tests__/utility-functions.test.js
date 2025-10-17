/**
 * Utility Functions Tests
 * Testing untested utility functions: cleanup, emailSplit, isValidEmail, jsonToMap, mapToJSON, etc.
 */

const emailSplit = require('../functions/utils/emailSplit');
const isValidEmail = require('../functions/utils/isValidEmail');
const jsonToMap = require('../functions/utils/jsonToMap');
const mapToJSON = require('../functions/utils/mapToJSON');
const promiseAwait = require('../functions/utils/promiseAwait');
const promiseAwaitMs = require('../functions/utils/promiseAwaitMs');
const cloneFunction = require('../functions/utils/cloneFunction');
const {
    cleanupUnverifiedUsers,
    cleanupExpiredTokens,
    runDatabaseCleanup
} = require('../functions/utils/cleanup');

describe('Utility Functions Tests', () => {
    let testDb;

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
            process.env.DB_PATH = '.sql/utils-functions-test.db';

            // Initialize test database
            const { initializeDatabase } = require('../database/connection');
            testDb = initializeDatabase();

        } catch (error) {
            console.error('Utility functions test setup failed:', error);
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
            const testDbPath = path.join(__dirname, '..', '.sql', 'utils-functions-test.db');
            if (fs.existsSync(testDbPath)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                try {
                    fs.unlinkSync(testDbPath);
                } catch (unlinkError) {
                    console.warn('Could not clean up test database file:', unlinkError.message);
                }
            }

        } catch (error) {
            console.error('Utility functions test cleanup failed:', error);
        }
    });

    describe('emailSplit', () => {
        test('should split simple email correctly', () => {
            try {
                const result = emailSplit('test@example.com');
                expect(result).toEqual({
                    username: 'test',
                    domain: 'example.com'
                });

            } catch (error) {
                console.error('Simple email split test failed:', error);
                throw error;
            }
        });

        test('should handle email with multiple @ symbols', () => {
            try {
                const result = emailSplit('test@sub@example.com');
                expect(result).toEqual({
                    username: 'test@sub',
                    domain: 'example.com'
                });

            } catch (error) {
                console.error('Multiple @ symbols test failed:', error);
                throw error;
            }
        });

        test('should handle email with subdomain', () => {
            try {
                const result = emailSplit('test@mail.example.com');
                expect(result).toEqual({
                    username: 'test',
                    domain: 'mail.example.com'
                });

            } catch (error) {
                console.error('Subdomain email test failed:', error);
                throw error;
            }
        });

        test('should handle email with + sign', () => {
            try {
                const result = emailSplit('test+tag@example.com');
                expect(result).toEqual({
                    username: 'test+tag',
                    domain: 'example.com'
                });

            } catch (error) {
                console.error('Plus sign email test failed:', error);
                throw error;
            }
        });

        test('should handle email with dots in username', () => {
            try {
                const result = emailSplit('test.user.name@example.com');
                expect(result).toEqual({
                    username: 'test.user.name',
                    domain: 'example.com'
                });

            } catch (error) {
                console.error('Dots in username test failed:', error);
                throw error;
            }
        });

        test('should handle empty string', () => {
            try {
                const result = emailSplit('');
                expect(result).toEqual({
                    username: '',
                    domain: ''
                });

            } catch (error) {
                console.error('Empty string test failed:', error);
                throw error;
            }
        });

        test('should handle null', () => {
            try {
                const result = emailSplit(null);
                expect(result).toEqual({
                    username: '',
                    domain: ''
                });

            } catch (error) {
                console.error('Null test failed:', error);
                throw error;
            }
        });

        test('should handle undefined', () => {
            try {
                const result = emailSplit(undefined);
                expect(result).toEqual({
                    username: '',
                    domain: ''
                });

            } catch (error) {
                console.error('Undefined test failed:', error);
                throw error;
            }
        });

        test('should handle email without @ symbol', () => {
            try {
                const result = emailSplit('invalidemail');
                expect(result).toEqual({
                    username: '',
                    domain: 'invalidemail'
                });

            } catch (error) {
                console.error('Email without @ test failed:', error);
                throw error;
            }
        });
    });

    describe('isValidEmail', () => {
        test('should validate standard email addresses', () => {
            try {
                expect(isValidEmail('test@example.com')).toBe(true);
                expect(isValidEmail('user.name@example.com')).toBe(true);
                expect(isValidEmail('user+tag@example.com')).toBe(true);
                expect(isValidEmail('test@subdomain.example.com')).toBe(true);

            } catch (error) {
                console.error('Standard email validation test failed:', error);
                throw error;
            }
        });

        test('should validate emails with numbers', () => {
            try {
                expect(isValidEmail('user123@example.com')).toBe(true);
                expect(isValidEmail('123user@example.com')).toBe(true);
                expect(isValidEmail('test@example123.com')).toBe(true);

            } catch (error) {
                console.error('Email with numbers test failed:', error);
                throw error;
            }
        });

        test('should validate emails with special characters', () => {
            try {
                expect(isValidEmail('user.name+tag@example.com')).toBe(true);
                expect(isValidEmail('user_name@example.com')).toBe(true);
                expect(isValidEmail('user-name@example.com')).toBe(true);

            } catch (error) {
                console.error('Special characters test failed:', error);
                throw error;
            }
        });

        test('should validate emails with accented characters', () => {
            try {
                expect(isValidEmail('tëst@example.com')).toBe(true);
                expect(isValidEmail('üser@example.com')).toBe(true);

            } catch (error) {
                console.error('Accented characters test failed:', error);
                throw error;
            }
        });

        test('should reject invalid email addresses', () => {
            try {
                expect(isValidEmail('invalid')).toBe(false);
                expect(isValidEmail('invalid@')).toBe(false);
                expect(isValidEmail('@example.com')).toBe(false);
                expect(isValidEmail('invalid@.com')).toBe(false);
                expect(isValidEmail('invalid@domain')).toBe(false);
                expect(isValidEmail('invalid..email@example.com')).toBe(false);
                expect(isValidEmail('')).toBe(false);

            } catch (error) {
                console.error('Invalid email rejection test failed:', error);
                throw error;
            }
        });

        test('should reject emails with spaces', () => {
            try {
                expect(isValidEmail('test user@example.com')).toBe(false);
                expect(isValidEmail('test@exam ple.com')).toBe(false);

            } catch (error) {
                console.error('Email with spaces test failed:', error);
                throw error;
            }
        });

        test('should reject emails with invalid TLD', () => {
            try {
                expect(isValidEmail('test@example.c')).toBe(false); // TLD too short

            } catch (error) {
                console.error('Invalid TLD test failed:', error);
                throw error;
            }
        });
    });

    describe('jsonToMap', () => {
        test('should convert simple JSON to Map', () => {
            try {
                const json = JSON.stringify([['key1', 'value1'], ['key2', 'value2']]);
                const result = jsonToMap(json);

                expect(result instanceof Map).toBe(true);
                expect(result.get('key1')).toBe('value1');
                expect(result.get('key2')).toBe('value2');

            } catch (error) {
                console.error('Simple JSON to Map test failed:', error);
                throw error;
            }
        });

        test('should handle empty Map', () => {
            try {
                const json = JSON.stringify([]);
                const result = jsonToMap(json);

                expect(result instanceof Map).toBe(true);
                expect(result.size).toBe(0);

            } catch (error) {
                console.error('Empty Map test failed:', error);
                throw error;
            }
        });

        test('should handle Map with different value types', () => {
            try {
                const json = JSON.stringify([
                    ['string', 'value'],
                    ['number', 123],
                    ['boolean', true],
                    ['null', null]
                ]);
                const result = jsonToMap(json);

                expect(result.get('string')).toBe('value');
                expect(result.get('number')).toBe(123);
                expect(result.get('boolean')).toBe(true);
                expect(result.get('null')).toBe(null);

            } catch (error) {
                console.error('Different value types test failed:', error);
                throw error;
            }
        });

        test('should handle complex nested structures', () => {
            try {
                const json = JSON.stringify([
                    ['key1', 'value1'],
                    ['key2', [1, 2, 3]]
                ]);
                const result = jsonToMap(json);

                expect(result instanceof Map).toBe(true);
                expect(result.get('key1')).toBe('value1');
                expect(Array.isArray(result.get('key2'))).toBe(true);

            } catch (error) {
                console.error('Complex nested structures test failed:', error);
                throw error;
            }
        });
    });

    describe('mapToJSON', () => {
        test('should convert simple Map to JSON', () => {
            try {
                const map = new Map([['key1', 'value1'], ['key2', 'value2']]);
                const result = mapToJSON(map);
                const parsed = JSON.parse(result);

                expect(Array.isArray(parsed)).toBe(true);
                expect(parsed).toContainEqual(['key1', 'value1']);
                expect(parsed).toContainEqual(['key2', 'value2']);

            } catch (error) {
                console.error('Simple Map to JSON test failed:', error);
                throw error;
            }
        });

        test('should handle empty Map', () => {
            try {
                const map = new Map();
                const result = mapToJSON(map);
                const parsed = JSON.parse(result);

                expect(Array.isArray(parsed)).toBe(true);
                expect(parsed).toHaveLength(0);

            } catch (error) {
                console.error('Empty Map to JSON test failed:', error);
                throw error;
            }
        });

        test('should handle Map with different value types', () => {
            try {
                const map = new Map([
                    ['string', 'value'],
                    ['number', 123],
                    ['boolean', true],
                    ['null', null]
                ]);
                const result = mapToJSON(map);
                const parsed = JSON.parse(result);

                expect(parsed).toContainEqual(['string', 'value']);
                expect(parsed).toContainEqual(['number', 123]);
                expect(parsed).toContainEqual(['boolean', true]);
                expect(parsed).toContainEqual(['null', null]);

            } catch (error) {
                console.error('Different value types Map to JSON test failed:', error);
                throw error;
            }
        });
    });

    describe('promiseAwait', () => {
        test('should resolve successful promise', async () => {
            try {
                const successPromise = Promise.resolve('success');
                const [error, result] = await promiseAwait(successPromise);

                expect(error).toBe(null);
                expect(result).toBe('success');

            } catch (error) {
                console.error('Successful promise test failed:', error);
                throw error;
            }
        });

        test('should handle rejected promise', async () => {
            try {
                const failPromise = Promise.reject(new Error('fail'));
                const [error, result] = await promiseAwait(failPromise);

                expect(error).toBeInstanceOf(Error);
                expect(error.message).toBe('fail');
                expect(result).toBe(undefined);

            } catch (error) {
                console.error('Rejected promise test failed:', error);
                throw error;
            }
        });

        test('should handle promise with object result', async () => {
            try {
                const objectPromise = Promise.resolve({ key: 'value' });
                const [error, result] = await promiseAwait(objectPromise);

                expect(error).toBe(null);
                expect(result).toEqual({ key: 'value' });

            } catch (error) {
                console.error('Object result promise test failed:', error);
                throw error;
            }
        });

        test('should handle promise with null result', async () => {
            try {
                const nullPromise = Promise.resolve(null);
                const [error, result] = await promiseAwait(nullPromise);

                expect(error).toBe(null);
                expect(result).toBe(null);

            } catch (error) {
                console.error('Null result promise test failed:', error);
                throw error;
            }
        });
    });

    describe('promiseAwaitMs', () => {
        test('should timeout after specified milliseconds', async () => {
            try {
                const slowPromise = new Promise(resolve => setTimeout(() => resolve('done'), 1000));
                const [error, result] = await promiseAwaitMs(slowPromise, 100);

                expect(error).toBeInstanceOf(Error);
                expect(error.message).toContain('timeout');
                expect(result).toBe(undefined);

            } catch (error) {
                console.error('Timeout test failed:', error);
                throw error;
            }
        });

        test('should resolve fast promise', async () => {
            try {
                const fastPromise = Promise.resolve('fast');
                const [error, result] = await promiseAwaitMs(fastPromise, 1000);

                expect(error).toBe(null);
                expect(result).toBe('fast');

            } catch (error) {
                console.error('Fast promise test failed:', error);
                throw error;
            }
        });

        test('should handle rejected promise', async () => {
            try {
                const failPromise = Promise.reject(new Error('fail'));
                const [error, result] = await promiseAwaitMs(failPromise, 1000);

                expect(error).toBeInstanceOf(Error);
                expect(error.message).toBe('fail');
                expect(result).toBe(undefined);

            } catch (error) {
                console.error('Rejected promise with timeout test failed:', error);
                throw error;
            }
        });
    });

    describe('cloneFunction', () => {
        test('should clone a simple function', () => {
            try {
                const original = function testFunc() { return 'test'; };
                const cloned = cloneFunction(original);

                expect(typeof cloned).toBe('function');
                expect(cloned()).toBe('test');
                expect(cloned).not.toBe(original); // Different reference

            } catch (error) {
                console.error('Simple function clone test failed:', error);
                throw error;
            }
        });

        test('should clone a function with parameters', () => {
            try {
                const original = function add(a, b) { return a + b; };
                const cloned = cloneFunction(original);

                expect(cloned(2, 3)).toBe(5);
                expect(cloned(10, 20)).toBe(30);

            } catch (error) {
                console.error('Function with parameters clone test failed:', error);
                throw error;
            }
        });

        test('should preserve function properties', () => {
            try {
                const original = function testFunc() { return 'test'; };
                original.customProp = 'value';
                const cloned = cloneFunction(original);

                expect(cloned.customProp).toBe('value');

            } catch (error) {
                console.error('Function properties clone test failed:', error);
                throw error;
            }
        });
    });

    describe('Database Cleanup Functions', () => {
        beforeEach(() => {
            try {
                // Clean up before each test
                testDb.prepare('DELETE FROM auth_tokens').run();
                testDb.prepare('DELETE FROM users WHERE email LIKE ?').run('%cleanup%');

            } catch (error) {
                console.error('Cleanup beforeEach failed:', error);
            }
        });

        describe('cleanupUnverifiedUsers', () => {
            test('should cleanup unverified users older than specified hours', async () => {
                try {
                    // Create old unverified user
                    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
                    testDb.prepare(`
                        INSERT INTO users (first_name, last_name, email, password_hash, is_verified, created_at)
                        VALUES (?, ?, ?, ?, 0, ?)
                    `).run('Old', 'User', 'oldunverified@cleanup.com', 'hash', oldDate);

                    const result = await cleanupUnverifiedUsers(24);

                    expect(result.success).toBe(true);
                    expect(result.deletedUsers).toBeGreaterThan(0);

                } catch (error) {
                    console.error('Cleanup old unverified users test failed:', error);
                    throw error;
                }
            });

            test('should not cleanup recent unverified users', async () => {
                try {
                    // Create recent unverified user
                    testDb.prepare(`
                        INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                        VALUES (?, ?, ?, ?, 0)
                    `).run('New', 'User', 'newunverified@cleanup.com', 'hash');

                    const beforeCount = testDb.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?')
                        .get('newunverified@cleanup.com').count;

                    const result = await cleanupUnverifiedUsers(24);

                    const afterCount = testDb.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?')
                        .get('newunverified@cleanup.com').count;

                    expect(result.success).toBe(true);
                    expect(beforeCount).toBe(afterCount);

                } catch (error) {
                    console.error('Preserve recent unverified users test failed:', error);
                    throw error;
                }
            });

            test('should not cleanup verified users', async () => {
                try {
                    // Create old verified user
                    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
                    testDb.prepare(`
                        INSERT INTO users (first_name, last_name, email, password_hash, is_verified, created_at)
                        VALUES (?, ?, ?, ?, 1, ?)
                    `).run('Old', 'Verified', 'oldverified@cleanup.com', 'hash', oldDate);

                    const beforeCount = testDb.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?')
                        .get('oldverified@cleanup.com').count;

                    const result = await cleanupUnverifiedUsers(24);

                    const afterCount = testDb.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?')
                        .get('oldverified@cleanup.com').count;

                    expect(result.success).toBe(true);
                    expect(beforeCount).toBe(afterCount);

                } catch (error) {
                    console.error('Preserve verified users test failed:', error);
                    throw error;
                }
            });
        });

        describe('cleanupExpiredTokens', () => {
            test('should cleanup expired tokens', async () => {
                try {
                    // Create user for foreign key
                    const userResult = testDb.prepare(`
                        INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                        VALUES (?, ?, ?, ?, 1)
                    `).run('Test', 'User', 'tokentest@cleanup.com', 'hash');

                    const userId = userResult.lastInsertRowid;

                    // Create expired token
                    const expiredDate = new Date(Date.now() - 1000).toISOString();
                    testDb.prepare(`
                        INSERT INTO auth_tokens (user_id, token, token_type, expires_at)
                        VALUES (?, ?, 'otp', ?)
                    `).run(userId, 'expired123', expiredDate);

                    const result = await cleanupExpiredTokens();

                    expect(result.success).toBe(true);
                    expect(result.deletedTokens).toBeGreaterThan(0);

                } catch (error) {
                    console.error('Cleanup expired tokens test failed:', error);
                    throw error;
                }
            });

            test('should not cleanup valid tokens', async () => {
                try {
                    // Create user for foreign key
                    const userResult = testDb.prepare(`
                        INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                        VALUES (?, ?, ?, ?, 1)
                    `).run('Test', 'User', 'validtoken@cleanup.com', 'hash');

                    const userId = userResult.lastInsertRowid;

                    // Create valid token
                    const futureDate = new Date(Date.now() + 10000).toISOString();
                    testDb.prepare(`
                        INSERT INTO auth_tokens (user_id, token, token_type, expires_at)
                        VALUES (?, ?, 'otp', ?)
                    `).run(userId, 'valid123', futureDate);

                    const beforeCount = testDb.prepare('SELECT COUNT(*) as count FROM auth_tokens WHERE token = ?')
                        .get('valid123').count;

                    const result = await cleanupExpiredTokens();

                    const afterCount = testDb.prepare('SELECT COUNT(*) as count FROM auth_tokens WHERE token = ?')
                        .get('valid123').count;

                    expect(result.success).toBe(true);
                    expect(beforeCount).toBe(afterCount);

                } catch (error) {
                    console.error('Preserve valid tokens test failed:', error);
                    throw error;
                }
            });
        });

        describe('runDatabaseCleanup', () => {
            test('should run comprehensive cleanup', async () => {
                try {
                    // Create old unverified user
                    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
                    const userResult = testDb.prepare(`
                        INSERT INTO users (first_name, last_name, email, password_hash, is_verified, created_at)
                        VALUES (?, ?, ?, ?, 0, ?)
                    `).run('Comprehensive', 'Test', 'comprehensive@cleanup.com', 'hash', oldDate);

                    const userId = userResult.lastInsertRowid;

                    // Create expired token
                    const expiredDate = new Date(Date.now() - 1000).toISOString();
                    testDb.prepare(`
                        INSERT INTO auth_tokens (user_id, token, token_type, expires_at)
                        VALUES (?, ?, 'otp', ?)
                    `).run(userId, 'expired456', expiredDate);

                    const result = await runDatabaseCleanup({ unverifiedUserHours: 24 });

                    expect(result.success).toBe(true);
                    expect(result.totalDeleted).toBeGreaterThan(0);
                    expect(result.results).toHaveProperty('unverifiedUsers');
                    expect(result.results).toHaveProperty('expiredTokens');

                } catch (error) {
                    console.error('Comprehensive cleanup test failed:', error);
                    throw error;
                }
            });

            test('should handle cleanup with no data to clean', async () => {
                try {
                    const result = await runDatabaseCleanup();

                    expect(result.success).toBe(true);
                    expect(result.totalDeleted).toBe(0);

                } catch (error) {
                    console.error('Cleanup with no data test failed:', error);
                    throw error;
                }
            });
        });
    });
});
