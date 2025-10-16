/**
 * Database Connection and Schema Tests
 * Testing database initialization, connection, and table creation
 */

const { initializeDatabase, getDatabase, createTestDatabase } = require('../database/connection');
const fs = require('fs');
const path = require('path');

describe('Database Integration Tests', () => {
    let db;
    const testDbPath = path.join(__dirname, '..', '.sql', `test-${Date.now()}-${process.pid}.db`);

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

            // Ensure test database is clean
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }

            // Set test environment variable
            process.env.DB_PATH = '.sql/test.db';

            // Initialize isolated test database
            db = createTestDatabase(testDbPath);
            
            // Verify database is open and working
            const testQuery = db.prepare('SELECT 1 as test');
            const result = testQuery.get();
            if (/** @type {{ test: number }} */ (result).test !== 1) {
                throw new Error('Database connection test failed');
            }
            
        } catch (error) {
            console.error('Database test setup failed:', error);
            throw error;
        }
    });

    beforeEach(() => {
        try {
            // Ensure we have a valid database connection before each test
            if (!db || db.open === false) {
                db = createTestDatabase(testDbPath);
            }
        } catch (error) {
            console.error('Database beforeEach setup failed:', error);
            throw error;
        }
    });

    describe('Database Connection', () => {
        test('should initialize database successfully', () => {
            try {
                expect(db).toBeDefined();
                expect(typeof db).toBe('object');
                
                // Test basic database operations
                const result = db.prepare('SELECT 1 as test').get();
                expect(result).toEqual({ test: 1 });
                
            } catch (error) {
                console.error('Database connection test failed:', error);
                throw error;
            }
        });

        test('should create database file', () => {
            try {
                // The database file should exist after initialization
                expect(fs.existsSync(testDbPath)).toBe(true);
                
            } catch (error) {
                console.error('Database file creation test failed:', error);
                throw error;
            }
        });
    });

    describe('Database Schema', () => {
        test('should create users table with correct schema', () => {
            try {
                const schema = db.prepare(`
                    SELECT sql FROM sqlite_master 
                    WHERE type='table' AND name='users'
                `).get();

                expect(schema).toBeDefined();
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('users');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('id');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('email');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('password_hash');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('first_name');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('last_name');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('is_verified');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('created_at');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('updated_at');
                
            } catch (error) {
                console.error('Users table schema test failed:', error);
                throw error;
            }
        });

        test('should create auth_tokens table with correct schema', () => {
            try {
                const schema = db.prepare(`
                    SELECT sql FROM sqlite_master 
                    WHERE type='table' AND name='auth_tokens'
                `).get();

                expect(schema).toBeDefined();
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('auth_tokens');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('id');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('user_id');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('token');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('token_type');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('expires_at');
                expect(/** @type {{ sql: string }} */ (schema).sql).toContain('is_used');
                
            } catch (error) {
                console.error('Auth tokens table schema test failed:', error);
                throw error;
            }
        });

        test('should verify auth_tokens table supports different token types', () => {
            try {
                // First create a test user to satisfy foreign key constraint
                const insertUser = db.prepare(`
                    INSERT INTO users (first_name, last_name, email, password_hash)
                    VALUES (?, ?, ?, ?)
                `);
                const userResult = insertUser.run('Test', 'User', 'test-token@example.com', 'hashed_password');
                const userId = userResult.lastInsertRowid;

                // Test that the table supports the expected token types
                const testInsert = db.prepare(`
                    INSERT INTO auth_tokens (user_id, token, token_type, expires_at)
                    VALUES (?, 'test-token', 'otp', datetime('now', '+5 minutes'))
                `);

                // This should not throw an error if token_type constraint is correct
                expect(() => testInsert.run(userId)).not.toThrow();
                
                // Clean up
                db.prepare('DELETE FROM auth_tokens WHERE token = ?').run('test-token');
                db.prepare('DELETE FROM users WHERE id = ?').run(userId);
                
            } catch (error) {
                console.error('Token types verification test failed:', error);
                throw error;
            }
        });

        test('should have proper indexes for performance', () => {
            try {
                const indexes = db.prepare(`
                    SELECT name, sql FROM sqlite_master 
                    WHERE type='index' AND sql IS NOT NULL
                `).all();

                expect(indexes.length).toBeGreaterThan(0);
                
                // Check for critical indexes
                const indexNames = indexes.map(idx => /** @type {{ name: string }} */ (idx).name);
                expect(indexNames.some(name => name.includes('email'))).toBe(true);
                
            } catch (error) {
                console.error('Database indexes test failed:', error);
                throw error;
            }
        });
    });

    describe('Database Operations', () => {
        test('should support user CRUD operations', () => {
            try {
                // Insert test user
                const insertUser = db.prepare(`
                    INSERT INTO users (first_name, last_name, email, password_hash)
                    VALUES (?, ?, ?, ?)
                `);

                const result = insertUser.run('Test', 'User', 'test@example.com', 'hashed_password');
                expect(result.lastInsertRowid).toBeDefined();
                expect(result.changes).toBe(1);

                // Read user
                const selectUser = db.prepare('SELECT * FROM users WHERE email = ?');
                const user = selectUser.get('test@example.com');
                expect(user).toBeDefined();
                expect(/** @type {{ email: string }} */ (user).email).toBe('test@example.com');
                expect(/** @type {{ first_name: string }} */ (user).first_name).toBe('Test');
                expect(/** @type {{ last_name: string }} */ (user).last_name).toBe('User');

                // Update user
                const updateUser = db.prepare('UPDATE users SET is_verified = 1 WHERE email = ?');
                const updateResult = updateUser.run('test@example.com');
                expect(updateResult.changes).toBe(1);

                // Verify update
                const updatedUser = selectUser.get('test@example.com');
                expect(/** @type {{ is_verified: number }} */ (updatedUser).is_verified).toBe(1);

                // Delete user
                const deleteUser = db.prepare('DELETE FROM users WHERE email = ?');
                const deleteResult = deleteUser.run('test@example.com');
                expect(deleteResult.changes).toBe(1);
                
            } catch (error) {
                console.error('User CRUD operations test failed:', error);
                throw error;
            }
        });

        test('should support token management operations', () => {
            try {
                // Create a test user first
                const insertUser = db.prepare(`
                    INSERT INTO users (first_name, last_name, email, password_hash)
                    VALUES (?, ?, ?, ?)
                `);
                const userResult = insertUser.run('Token', 'User', 'token@example.com', 'hashed_password');
                const userId = userResult.lastInsertRowid;

                // Insert token (using 'token' column, not 'token_hash')
                const insertToken = db.prepare(`
                    INSERT INTO auth_tokens (user_id, token, token_type, expires_at)
                    VALUES (?, ?, ?, ?)
                `);

                const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
                const tokenResult = insertToken.run(userId, 'test_refresh_token', 'refresh', expiresAt);
                expect(tokenResult.lastInsertRowid).toBeDefined();

                // Read token
                const selectToken = db.prepare(`
                    SELECT * FROM auth_tokens 
                    WHERE user_id = ? AND token_type = ?
                `);
                const token = selectToken.get(userId, 'refresh');
                expect(token).toBeDefined();
                expect(/** @type {{ user_id: number | bigint }} */ (token).user_id).toBe(userId);
                expect(/** @type {{ token_type: string }} */ (token).token_type).toBe('refresh');
                expect(/** @type {{ token: string }} */ (token).token).toBe('test_refresh_token');

                // Update token (mark as used)
                const updateToken = db.prepare('UPDATE auth_tokens SET is_used = 1 WHERE id = ?');
                const updateResult = updateToken.run(/** @type {{ id: number | bigint }} */ (token).id);
                expect(updateResult.changes).toBe(1);
                
            } catch (error) {
                console.error('Token management operations test failed:', error);
                throw error;
            }
        });

        test('should support OTP operations', () => {
            try {
                // Create a test user first
                const insertUser = db.prepare(`
                    INSERT INTO users (first_name, last_name, email, password_hash)
                    VALUES (?, ?, ?, ?)
                `);
                const userResult = insertUser.run('OTP', 'User', 'otp@example.com', 'hashed_password');
                const userId = userResult.lastInsertRowid;

                // Insert OTP (using auth_tokens table)
                const insertOTP = db.prepare(`
                    INSERT INTO auth_tokens (user_id, token, token_type, expires_at)
                    VALUES (?, ?, 'otp', ?)
                `);

                const expiresAt = new Date(Date.now() + 300000).toISOString(); // 5 minutes from now
                const otpResult = insertOTP.run(userId, '123456', expiresAt);
                expect(otpResult.lastInsertRowid).toBeDefined();

                // Read OTP
                const selectOTP = db.prepare(`
                    SELECT * FROM auth_tokens 
                    WHERE user_id = ? AND token_type = 'otp'
                `);
                const otp = selectOTP.get(userId);
                expect(otp).toBeDefined();
                expect(/** @type {{ user_id: number | bigint }} */ (otp).user_id).toBe(userId);
                expect(/** @type {{ token: string }} */ (otp).token).toBe('123456');
                expect(/** @type {{ token_type: string }} */ (otp).token_type).toBe('otp');

                // Update OTP (mark as used)
                const updateOTP = db.prepare('UPDATE auth_tokens SET is_used = 1 WHERE id = ?');
                const updateResult = updateOTP.run(/** @type {{ id: number | bigint }} */ (otp).id);
                expect(updateResult.changes).toBe(1);
                
            } catch (error) {
                console.error('OTP operations test failed:', error);
                throw error;
            }
        });

        test('should enforce foreign key constraints', () => {
            try {
                // Try to insert token with non-existent user_id
                const insertToken = db.prepare(`
                    INSERT INTO auth_tokens (user_id, token, token_type, expires_at)
                    VALUES (?, ?, ?, ?)
                `);

                expect(() => {
                    insertToken.run(99999, 'test_token', 'refresh', new Date().toISOString());
                }).toThrow();
                
            } catch (error) {
                console.error('Foreign key constraints test failed:', error);
                throw error;
            }
        });

        test('should handle concurrent operations safely', () => {
            try {
                // Create multiple transactions simultaneously
                const promises = [];
                
                for (let i = 0; i < 10; i++) {
                    promises.push(new Promise((resolve, reject) => {
                        try {
                            const insertUser = db.prepare(`
                                INSERT INTO users (first_name, last_name, email, password_hash)
                                VALUES (?, ?, ?, ?)
                            `);
                            
                            const result = insertUser.run(
                                `Concurrent${i}`, 
                                'User', 
                                `concurrent${i}@example.com`, 
                                'hashed_password'
                            );
                            
                            resolve(result);
                        } catch (error) {
                            reject(error);
                        }
                    }));
                }

                return Promise.all(promises).then(results => {
                    expect(results).toHaveLength(10);
                    results.forEach(result => {
                        expect(result.lastInsertRowid).toBeDefined();
                        expect(result.changes).toBe(1);
                    });
                });
                
            } catch (error) {
                console.error('Concurrent operations test failed:', error);
                throw error;
            }
        });
    });

    describe('Database Error Handling', () => {
        test('should handle invalid SQL gracefully', () => {
            try {
                expect(() => {
                    db.prepare('INVALID SQL STATEMENT').run();
                }).toThrow();
                
            } catch (error) {
                console.error('Invalid SQL test failed:', error);
                throw error;
            }
        });

        test('should handle duplicate key violations', () => {
            try {
                const insertUser = db.prepare(`
                    INSERT INTO users (first_name, last_name, email, password_hash)
                    VALUES (?, ?, ?, ?)
                `);

                // Insert first user
                insertUser.run('Duplicate', 'User', 'duplicate@example.com', 'hashed_password');

                // Try to insert duplicate email
                expect(() => {
                    insertUser.run('Another', 'User', 'duplicate@example.com', 'hashed_password');
                }).toThrow();
                
            } catch (error) {
                console.error('Duplicate key violations test failed:', error);
                throw error;
            }
        });
    });

    afterEach(() => {
        try {
            // Clean up test data after each test but keep connection open
            if (db && db.open) {
                // Clean up any test data - using safer, more targeted cleanup
                try {
                    // Use transaction for atomic cleanup
                    const cleanupTransaction = db.transaction(() => {
                        db.prepare('DELETE FROM auth_tokens WHERE token LIKE "%test%" OR token LIKE "%Test%" OR token LIKE "%OTP%" OR token LIKE "%Concurrent%" OR token LIKE "%duplicate%"').run();
                        db.prepare('DELETE FROM users WHERE email LIKE "%test%" OR email LIKE "%Test%" OR email LIKE "%OTP%" OR email LIKE "%Concurrent%" OR email LIKE "%duplicate%"').run();
                    });
                    cleanupTransaction();
                } catch (e) {
                    // Ignore cleanup errors - tables might not exist yet
                }
            }
        } catch (error) {
            console.error('Database afterEach cleanup failed:', error);
        }
    });

    afterAll(async () => {
        try {
            // Close the test database connection
            if (db && db.open) {
                db.close();
            }

            // Wait briefly for file handles to release
            await new Promise(resolve => setTimeout(resolve, 100));

            // Clean up test database file
            if (fs.existsSync(testDbPath)) {
                try {
                    fs.unlinkSync(testDbPath);
                } catch (unlinkError) {
                    // If file is locked, try again after a short delay
                    await new Promise(resolve => setTimeout(resolve, 200));
                    try {
                        fs.unlinkSync(testDbPath);
                    } catch (retryError) {
                        console.warn('Could not clean up test database file:', retryError.message);
                    }
                }
            }
            
        } catch (error) {
            console.error('Database test cleanup failed:', error);
        }
    });
});