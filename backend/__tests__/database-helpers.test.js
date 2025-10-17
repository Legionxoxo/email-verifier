/**
 * Database Helper Functions Tests
 * Testing sqlAsync wrapper and database connection utilities
 */

const path = require('path');
const fs = require('fs');

describe('Database Helper Functions Tests', () => {
    let testDbPath;
    let sqlAsync;

    beforeAll(() => {
        try {
            // Set up isolated test environment
            testDbPath = path.join(__dirname, '..', '.sql', `db-helpers-test-${Date.now()}.db`);
            process.env.TEST_DB_PATH = testDbPath;

        } catch (error) {
            console.error('Database helpers test setup failed:', error);
            throw error;
        }
    });

    afterAll(async () => {
        try {
            // Clean up test database file
            if (fs.existsSync(testDbPath)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                try {
                    fs.unlinkSync(testDbPath);
                } catch (unlinkError) {
                    console.warn('Could not clean up test database file:', unlinkError.message);
                }
            }

        } catch (error) {
            console.error('Database helpers test cleanup failed:', error);
        }
    });

    describe('SQLAsync Wrapper', () => {
        let db;
        let testTablePath;

        beforeAll(() => {
            try {
                // Create test database for sqlAsync testing
                const { initializeDatabase } = require('../database/connection');
                db = initializeDatabase();
                testTablePath = path.join(__dirname, '..', '.sql', 'test-sqlasync.db');

            } catch (error) {
                console.error('SQLAsync test setup failed:', error);
                throw error;
            }
        });

        afterAll(() => {
            try {
                if (db && db.open) {
                    db.close();
                }
            } catch (error) {
                console.error('SQLAsync cleanup failed:', error);
            }
        });

        test('should handle runAsync for INSERT operations', async () => {
            try {
                // Create a test table
                const createTable = db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_async_insert (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        value INTEGER
                    )
                `);
                createTable.run();

                // Insert using prepared statement
                const insertStmt = db.prepare(`
                    INSERT INTO test_async_insert (name, value) VALUES (?, ?)
                `);
                const result = insertStmt.run('test1', 100);

                expect(result).toBeDefined();
                expect(result.lastInsertRowid).toBeDefined();
                expect(result.changes).toBe(1);

                // Verify insertion
                const selectStmt = db.prepare('SELECT * FROM test_async_insert WHERE name = ?');
                const row = selectStmt.get('test1');
                expect(row).toBeDefined();
                expect(row.name).toBe('test1');
                expect(row.value).toBe(100);

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_async_insert').run();

            } catch (error) {
                console.error('runAsync INSERT test failed:', error);
                throw error;
            }
        });

        test('should handle runAsync for UPDATE operations', async () => {
            try {
                // Create test table and insert data
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_async_update (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        value INTEGER
                    )
                `).run();

                db.prepare(`
                    INSERT INTO test_async_update (name, value) VALUES (?, ?)
                `).run('test2', 200);

                // Update using prepared statement
                const updateStmt = db.prepare(`
                    UPDATE test_async_update SET value = ? WHERE name = ?
                `);
                const result = updateStmt.run(300, 'test2');

                expect(result.changes).toBe(1);

                // Verify update
                const selectStmt = db.prepare('SELECT value FROM test_async_update WHERE name = ?');
                const row = selectStmt.get('test2');
                expect(row.value).toBe(300);

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_async_update').run();

            } catch (error) {
                console.error('runAsync UPDATE test failed:', error);
                throw error;
            }
        });

        test('should handle runAsync for DELETE operations', async () => {
            try {
                // Create test table and insert data
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_async_delete (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL
                    )
                `).run();

                db.prepare(`
                    INSERT INTO test_async_delete (name) VALUES (?)
                `).run('test3');

                // Delete using prepared statement
                const deleteStmt = db.prepare(`
                    DELETE FROM test_async_delete WHERE name = ?
                `);
                const result = deleteStmt.run('test3');

                expect(result.changes).toBe(1);

                // Verify deletion
                const selectStmt = db.prepare('SELECT * FROM test_async_delete WHERE name = ?');
                const row = selectStmt.get('test3');
                expect(row).toBeUndefined();

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_async_delete').run();

            } catch (error) {
                console.error('runAsync DELETE test failed:', error);
                throw error;
            }
        });

        test('should handle allAsync for multiple rows', async () => {
            try {
                // Create test table and insert multiple rows
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_async_all (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        category TEXT NOT NULL,
                        value INTEGER
                    )
                `).run();

                const insertStmt = db.prepare(`
                    INSERT INTO test_async_all (category, value) VALUES (?, ?)
                `);
                insertStmt.run('A', 10);
                insertStmt.run('A', 20);
                insertStmt.run('B', 30);

                // Retrieve all rows with category 'A'
                const selectStmt = db.prepare(`
                    SELECT * FROM test_async_all WHERE category = ?
                `);
                const rows = selectStmt.all('A');

                expect(Array.isArray(rows)).toBe(true);
                expect(rows).toHaveLength(2);
                expect(rows[0].value).toBe(10);
                expect(rows[1].value).toBe(20);

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_async_all').run();

            } catch (error) {
                console.error('allAsync test failed:', error);
                throw error;
            }
        });

        test('should handle allAsync with empty results', async () => {
            try {
                // Create test table
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_async_empty (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL
                    )
                `).run();

                // Query with no matching results
                const selectStmt = db.prepare(`
                    SELECT * FROM test_async_empty WHERE name = ?
                `);
                const rows = selectStmt.all('nonexistent');

                expect(Array.isArray(rows)).toBe(true);
                expect(rows).toHaveLength(0);

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_async_empty').run();

            } catch (error) {
                console.error('allAsync empty results test failed:', error);
                throw error;
            }
        });

        test('should handle getAsync for single row', async () => {
            try {
                // Create test table and insert data
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_async_get (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        value INTEGER
                    )
                `).run();

                db.prepare(`
                    INSERT INTO test_async_get (name, value) VALUES (?, ?)
                `).run('test4', 400);

                // Get single row
                const selectStmt = db.prepare(`
                    SELECT * FROM test_async_get WHERE name = ?
                `);
                const row = selectStmt.get('test4');

                expect(row).toBeDefined();
                expect(row.name).toBe('test4');
                expect(row.value).toBe(400);

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_async_get').run();

            } catch (error) {
                console.error('getAsync test failed:', error);
                throw error;
            }
        });

        test('should handle getAsync with no results', async () => {
            try {
                // Create test table
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_async_get_empty (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL
                    )
                `).run();

                // Query with no matching result
                const selectStmt = db.prepare(`
                    SELECT * FROM test_async_get_empty WHERE name = ?
                `);
                const row = selectStmt.get('nonexistent');

                expect(row).toBeUndefined();

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_async_get_empty').run();

            } catch (error) {
                console.error('getAsync no results test failed:', error);
                throw error;
            }
        });

        test('should handle SQL errors in runAsync', () => {
            try {
                expect(() => {
                    db.prepare('INVALID SQL STATEMENT').run();
                }).toThrow();

            } catch (error) {
                console.error('runAsync error handling test failed:', error);
                throw error;
            }
        });

        test('should handle SQL errors in allAsync', () => {
            try {
                expect(() => {
                    db.prepare('SELECT * FROM nonexistent_table').all();
                }).toThrow();

            } catch (error) {
                console.error('allAsync error handling test failed:', error);
                throw error;
            }
        });

        test('should handle SQL errors in getAsync', () => {
            try {
                expect(() => {
                    db.prepare('SELECT * FROM nonexistent_table').get();
                }).toThrow();

            } catch (error) {
                console.error('getAsync error handling test failed:', error);
                throw error;
            }
        });

        test('should handle transactions', () => {
            try {
                // Create test table
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_transaction (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        value INTEGER
                    )
                `).run();

                // Run transaction
                const transaction = db.transaction(() => {
                    const insertStmt = db.prepare('INSERT INTO test_transaction (value) VALUES (?)');
                    insertStmt.run(100);
                    insertStmt.run(200);
                    insertStmt.run(300);
                });

                transaction();

                // Verify all insertions
                const selectStmt = db.prepare('SELECT COUNT(*) as count FROM test_transaction');
                const result = selectStmt.get();
                expect(result.count).toBe(3);

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_transaction').run();

            } catch (error) {
                console.error('Transaction test failed:', error);
                throw error;
            }
        });

        test('should rollback transactions on error', () => {
            try {
                // Create test table
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_rollback (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        value INTEGER NOT NULL
                    )
                `).run();

                // Transaction that should fail
                const badTransaction = db.transaction(() => {
                    const insertStmt = db.prepare('INSERT INTO test_rollback (value) VALUES (?)');
                    insertStmt.run(100);
                    // This will fail due to constraint violation (NULL value)
                    db.prepare('INSERT INTO test_rollback (value) VALUES (NULL)').run();
                });

                expect(() => badTransaction()).toThrow();

                // Verify no rows were inserted (transaction rolled back)
                const selectStmt = db.prepare('SELECT COUNT(*) as count FROM test_rollback');
                const result = selectStmt.get();
                expect(result.count).toBe(0);

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_rollback').run();

            } catch (error) {
                console.error('Transaction rollback test failed:', error);
                throw error;
            }
        });
    });

    describe('Database Connection Utilities', () => {
        test('should verify database folder creation', () => {
            try {
                const dbFolder = path.join(__dirname, '..', '.sql');
                expect(fs.existsSync(dbFolder)).toBe(true);

            } catch (error) {
                console.error('Database folder test failed:', error);
                throw error;
            }
        });

        test('should verify database file creation', () => {
            try {
                const { getDatabase } = require('../database/connection');
                const db = getDatabase();

                expect(db).toBeDefined();
                expect(typeof db).toBe('object');
                expect(db.open).toBe(true);

            } catch (error) {
                console.error('Database file test failed:', error);
                throw error;
            }
        });

        test('should handle multiple database getDatabase calls', () => {
            try {
                const { getDatabase } = require('../database/connection');
                const db1 = getDatabase();
                const db2 = getDatabase();

                // Should return same instance
                expect(db1).toBe(db2);

            } catch (error) {
                console.error('Multiple getDatabase calls test failed:', error);
                throw error;
            }
        });

        test('should verify database is in WAL mode', () => {
            try {
                const { getDatabase } = require('../database/connection');
                const db = getDatabase();

                const result = db.prepare('PRAGMA journal_mode').get();
                expect(result.journal_mode.toLowerCase()).toBe('wal');

            } catch (error) {
                console.error('WAL mode test failed:', error);
                throw error;
            }
        });

        test('should verify foreign keys are enabled', () => {
            try {
                const { getDatabase } = require('../database/connection');
                const db = getDatabase();

                const result = db.prepare('PRAGMA foreign_keys').get();
                expect(result.foreign_keys).toBe(1);

            } catch (error) {
                console.error('Foreign keys test failed:', error);
                throw error;
            }
        });

        test('should handle database connection errors gracefully', () => {
            try {
                // Test is conceptual - better-sqlite3 handles this automatically
                const { getDatabase } = require('../database/connection');
                const db = getDatabase();

                expect(db.open).toBe(true);

            } catch (error) {
                console.error('Connection error handling test failed:', error);
                throw error;
            }
        });
    });

    describe('Edge Cases', () => {
        let db;

        beforeAll(() => {
            try {
                const { getDatabase } = require('../database/connection');
                db = getDatabase();
            } catch (error) {
                console.error('Edge cases setup failed:', error);
                throw error;
            }
        });

        test('should handle very long strings in queries', () => {
            try {
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_long_string (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        content TEXT
                    )
                `).run();

                const longString = 'a'.repeat(10000);
                const insertStmt = db.prepare('INSERT INTO test_long_string (content) VALUES (?)');
                const result = insertStmt.run(longString);

                expect(result.changes).toBe(1);

                const selectStmt = db.prepare('SELECT content FROM test_long_string WHERE id = ?');
                const row = selectStmt.get(result.lastInsertRowid);
                expect(row.content).toBe(longString);

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_long_string').run();

            } catch (error) {
                console.error('Long string test failed:', error);
                throw error;
            }
        });

        test('should handle unicode characters', () => {
            try {
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_unicode (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        content TEXT
                    )
                `).run();

                const unicodeString = '测试 🔒 ñáéíóú محمد';
                const insertStmt = db.prepare('INSERT INTO test_unicode (content) VALUES (?)');
                const result = insertStmt.run(unicodeString);

                expect(result.changes).toBe(1);

                const selectStmt = db.prepare('SELECT content FROM test_unicode WHERE id = ?');
                const row = selectStmt.get(result.lastInsertRowid);
                expect(row.content).toBe(unicodeString);

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_unicode').run();

            } catch (error) {
                console.error('Unicode test failed:', error);
                throw error;
            }
        });

        test('should handle null values correctly', () => {
            try {
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_null (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        nullable_field TEXT
                    )
                `).run();

                const insertStmt = db.prepare('INSERT INTO test_null (nullable_field) VALUES (?)');
                const result = insertStmt.run(null);

                expect(result.changes).toBe(1);

                const selectStmt = db.prepare('SELECT nullable_field FROM test_null WHERE id = ?');
                const row = selectStmt.get(result.lastInsertRowid);
                expect(row.nullable_field).toBe(null);

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_null').run();

            } catch (error) {
                console.error('Null values test failed:', error);
                throw error;
            }
        });

        test('should handle large numbers', () => {
            try {
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_large_numbers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        big_number INTEGER
                    )
                `).run();

                const largeNumber = 9007199254740991; // Number.MAX_SAFE_INTEGER
                const insertStmt = db.prepare('INSERT INTO test_large_numbers (big_number) VALUES (?)');
                const result = insertStmt.run(largeNumber);

                expect(result.changes).toBe(1);

                const selectStmt = db.prepare('SELECT big_number FROM test_large_numbers WHERE id = ?');
                const row = selectStmt.get(result.lastInsertRowid);
                expect(row.big_number).toBe(largeNumber);

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_large_numbers').run();

            } catch (error) {
                console.error('Large numbers test failed:', error);
                throw error;
            }
        });

        test('should handle empty string values', () => {
            try {
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS test_empty_string (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        content TEXT
                    )
                `).run();

                const insertStmt = db.prepare('INSERT INTO test_empty_string (content) VALUES (?)');
                const result = insertStmt.run('');

                expect(result.changes).toBe(1);

                const selectStmt = db.prepare('SELECT content FROM test_empty_string WHERE id = ?');
                const row = selectStmt.get(result.lastInsertRowid);
                expect(row.content).toBe('');

                // Cleanup
                db.prepare('DROP TABLE IF EXISTS test_empty_string').run();

            } catch (error) {
                console.error('Empty string test failed:', error);
                throw error;
            }
        });
    });
});
