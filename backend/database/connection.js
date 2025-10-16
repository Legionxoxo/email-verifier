/**
 * Database connection and initialization utilities
 * Handles SQLite database setup and table creation
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { initializeSubscriptionSchema } = require('./subscription-schema');


// Import environment variables
const { DB_PATH: ENV_DB_PATH } = require('../data/env');

// Database configuration
const DB_PATH = ENV_DB_PATH.startsWith('/')
    ? ENV_DB_PATH
    : path.join(__dirname, '..', ENV_DB_PATH);


/**
 * Initialize database connection and create tables
 * @returns {import('better-sqlite3').Database} SQLite database instance
 */
function initializeDatabase() {
    let db = null;
    
    try {
        // Determine database path - use current DB_PATH or reload from env
        let dbPath = DB_PATH;
        if (process.env.DB_PATH && process.env.DB_PATH !== ENV_DB_PATH) {
            // Re-calculate path if environment changed (for tests)
            dbPath = process.env.DB_PATH.startsWith('/')
                ? process.env.DB_PATH
                : path.join(__dirname, '..', process.env.DB_PATH);
        }
        
        // Ensure .sql directory exists
        const sqlDir = path.dirname(dbPath);
        if (!fs.existsSync(sqlDir)) {
            fs.mkdirSync(sqlDir, { recursive: true });
        }
        
        // Initialize database connection
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        
        // Create tables
        createTables(db);
        
        // Initialize subscription schema
        initializeSubscriptionSchema(db);
        
        // Run schema migrations AFTER all tables are created
        runSchemaMigrations(db);
        
        console.log('Database initialized successfully at:', dbPath);
        return db;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Database initialization failed:', errorMessage);
        throw error;
    } finally {
        console.debug('Database initialization process completed');
    }
}


/**
 * Run schema migrations for existing tables
 * @param {import('better-sqlite3').Database} db - SQLite database instance
 * @returns {void}
 */
function runSchemaMigrations(db) {
    try {
        // Check if razorpay_customer_id column exists in users table
        const checkUsersColumn = db.prepare("PRAGMA table_info(users)");
        const usersColumns = /** @type {Array<{name: string}>} */ (checkUsersColumn.all());
        const hasRazorpayCustomerId = usersColumns.some(col => col.name === 'razorpay_customer_id');
        
        if (!hasRazorpayCustomerId) {
            console.log('🔄 Adding razorpay_customer_id column to users table...');
            const addRazorpayCustomerIdColumn = db.prepare(`
                ALTER TABLE users ADD COLUMN razorpay_customer_id TEXT
            `);
            addRazorpayCustomerIdColumn.run();
            console.log('✅ Added razorpay_customer_id column to users table');
        }
        
        // Add razorpay_customer_id column to user_subscriptions table if missing
        const checkUserSubsColumn = db.prepare("PRAGMA table_info(user_subscriptions)");
        const userSubsColumns = /** @type {Array<{name: string}>} */ (checkUserSubsColumn.all());
        const hasUserSubsRazorpayCustomerId = userSubsColumns.some(col => col.name === 'razorpay_customer_id');

        if (!hasUserSubsRazorpayCustomerId) {
            console.log('🔄 Adding razorpay_customer_id column to user_subscriptions table...');
            const addUserSubsRazorpayCustomerIdColumn = db.prepare(`
                ALTER TABLE user_subscriptions ADD COLUMN razorpay_customer_id TEXT
            `);
            addUserSubsRazorpayCustomerIdColumn.run();
            console.log('✅ Added razorpay_customer_id column to user_subscriptions table');
        }

        // Add cancellation_feedback column to user_subscriptions table if missing
        const hasCancellationFeedback = userSubsColumns.some(col => col.name === 'cancellation_feedback');
        
        if (!hasCancellationFeedback) {
            console.log('🔄 Adding cancellation_feedback column to user_subscriptions table...');
            const addCancellationFeedbackColumn = db.prepare(`
                ALTER TABLE user_subscriptions ADD COLUMN cancellation_feedback TEXT
            `);
            addCancellationFeedbackColumn.run();
            console.log('✅ Added cancellation_feedback column to user_subscriptions table');
        }

        // Migrate user_subscriptions table from plan_id to plan_code
        migrateUserSubscriptionsSchema(db);
        
        // Add email_change_pending token type support
        migrateAuthTokensSchema(db);
        
        console.log('✅ Schema migrations completed successfully');
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Schema migration failed:', errorMessage);
        throw error;
    } finally {
        console.debug('Schema migration process completed');
    }
}


/**
 * Migrate user_subscriptions table from plan_id (INTEGER) to plan_code (TEXT)
 * @param {import('better-sqlite3').Database} db - SQLite database instance
 * @returns {void}
 */
function migrateUserSubscriptionsSchema(db) {
    try {
        // Check if user_subscriptions table exists
        const checkTable = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='user_subscriptions'
        `);
        const tableExists = checkTable.get();
        
        if (!tableExists) {
            console.log('📝 user_subscriptions table does not exist yet, will be created with plan_code');
            return;
        }
        
        // Check current schema of user_subscriptions table
        const checkColumns = db.prepare("PRAGMA table_info(user_subscriptions)");
        const columns = /** @type {Array<{name: string, type: string}>} */ (checkColumns.all());
        
        const hasPlanId = columns.some(col => col.name === 'plan_id');
        const hasPlanCode = columns.some(col => col.name === 'plan_code');
        
        console.log(`🔍 user_subscriptions schema check: has_plan_id=${hasPlanId}, has_plan_code=${hasPlanCode}`);
        
        // Case 1: Already migrated (has plan_code, no plan_id)
        if (hasPlanCode && !hasPlanId) {
            console.log('✅ user_subscriptions table already uses plan_code schema');
            return;
        }
        
        // Case 2: Old schema (has plan_id, no plan_code) - needs migration
        if (hasPlanId && !hasPlanCode) {
            console.log('🔄 Migrating user_subscriptions from plan_id to plan_code schema...');
            
            // Step 1: Add plan_code column
            console.log('  📝 Adding plan_code column...');
            const addPlanCodeColumn = db.prepare(`
                ALTER TABLE user_subscriptions 
                ADD COLUMN plan_code TEXT
            `);
            addPlanCodeColumn.run();
            
            // Step 2: Migrate existing data from plan_id to plan_code
            console.log('  🔄 Migrating existing subscription data...');
            const migrateDataQuery = db.prepare(`
                UPDATE user_subscriptions 
                SET plan_code = CASE 
                    WHEN plan_id = 1 THEN 'free'
                    WHEN plan_id = 2 THEN 'pro'
                    WHEN plan_id = 3 THEN 'plus'
                    ELSE 'free'
                END
                WHERE plan_code IS NULL
            `);
            const migrationResult = migrateDataQuery.run();
            console.log(`  ✅ Migrated ${migrationResult.changes} subscription records`);
            
            // Step 3: Add CHECK constraint for plan_code
            console.log('  📝 Adding plan_code constraint...');
            // Note: SQLite doesn't support adding CHECK constraints to existing tables
            // The constraint will be enforced by the application and new inserts
            
            // Step 4: Verify migration
            const verifyQuery = db.prepare(`
                SELECT COUNT(*) as total_records,
                       COUNT(CASE WHEN plan_code IS NOT NULL THEN 1 END) as migrated_records
                FROM user_subscriptions
            `);
            const verification = /** @type {{total_records: number, migrated_records: number}} */ (verifyQuery.get());
            
            if (verification.total_records === verification.migrated_records) {
                console.log(`  ✅ Migration verification passed: ${verification.total_records} records migrated`);
                
                // Step 5: Remove plan_id column (create new table without plan_id)
                console.log('  🔄 Removing old plan_id column...');
                
                // Begin transaction for table recreation
                const transaction = db.transaction(() => {
                    // Create new table with correct schema
                    db.prepare(`
                        CREATE TABLE user_subscriptions_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL,
                            plan_code TEXT NOT NULL CHECK (plan_code IN ('free', 'pro', 'plus')),
                            razorpay_subscription_id TEXT UNIQUE,
                            status TEXT NOT NULL CHECK (status IN ('created', 'authenticated', 'active', 'past_due', 'cancelled', 'completed', 'paused', 'halted', 'upgraded')),
                            billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')) DEFAULT 'monthly',
                            current_period_start DATETIME NOT NULL,
                            current_period_end DATETIME NOT NULL,
                            trial_start DATETIME,
                            trial_end DATETIME,
                            cancel_at_period_end BOOLEAN DEFAULT 0,
                            cancelled_at DATETIME NULL,
                            cancellation_reason TEXT,
                            cancellation_feedback TEXT,
                            pause_count INTEGER DEFAULT 0,
                            paused_at DATETIME NULL,
                            resume_at DATETIME NULL,
                            next_billing_date DATETIME,
                            proration_amount INTEGER DEFAULT 0,
                            discount_amount INTEGER DEFAULT 0,
                            tax_amount INTEGER DEFAULT 0,
                            total_amount INTEGER NOT NULL,
                            auto_renewal BOOLEAN DEFAULT 1,
                            grace_period_days INTEGER DEFAULT 3,
                            failed_payment_count INTEGER DEFAULT 0,
                            last_payment_attempt DATETIME,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            
                            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                            
                            CHECK (current_period_end > current_period_start),
                            CHECK (trial_end IS NULL OR trial_end > trial_start),
                            CHECK (total_amount >= 0),
                            CHECK (pause_count >= 0),
                            CHECK (failed_payment_count >= 0)
                        )
                    `).run();
                    
                    // Get the exact columns that exist in the old table
                    const oldColumns = /** @type {Array<{name: string, type: string}>} */ (db.prepare("PRAGMA table_info(user_subscriptions)").all());
                    const oldColumnNames = oldColumns.map(col => col.name);
                    
                    // Define the new table columns and their defaults
                    const newTableColumns = [
                        'id', 'user_id', 'plan_code', 'razorpay_subscription_id', 'status', 'billing_cycle',
                        'current_period_start', 'current_period_end', 'trial_start', 'trial_end',
                        'cancel_at_period_end', 'cancelled_at', 'cancellation_reason', 'cancellation_feedback', 'pause_count',
                        'paused_at', 'resume_at', 'next_billing_date', 'proration_amount',
                        'discount_amount', 'tax_amount', 'total_amount', 'auto_renewal',
                        'grace_period_days', 'failed_payment_count', 'last_payment_attempt',
                        'created_at', 'updated_at'
                    ];
                    
                    // Build SELECT and INSERT clauses based on existing columns
                    const selectClauses = [];
                    const insertColumns = [];
                    
                    newTableColumns.forEach(column => {
                        if (oldColumnNames.includes(column) && column !== 'plan_id') {
                            // Column exists in old table, copy it
                            selectClauses.push(column);
                            insertColumns.push(column);
                        } else if (column === 'plan_code') {
                            // plan_code was just added, copy it
                            selectClauses.push('plan_code');
                            insertColumns.push('plan_code');
                        } else {
                            // Column doesn't exist in old table, use default
                            if (column === 'razorpay_subscription_id') {
                                selectClauses.push('NULL as razorpay_subscription_id');
                            } else if (column === 'status' && !oldColumnNames.includes('status')) {
                                selectClauses.push("'active' as status");
                            } else if (column === 'billing_cycle' && !oldColumnNames.includes('billing_cycle')) {
                                selectClauses.push("'monthly' as billing_cycle");
                            } else if (column === 'total_amount' && !oldColumnNames.includes('total_amount')) {
                                selectClauses.push('0 as total_amount');
                            } else if (column === 'auto_renewal' && !oldColumnNames.includes('auto_renewal')) {
                                selectClauses.push('1 as auto_renewal');
                            } else if (column === 'grace_period_days' && !oldColumnNames.includes('grace_period_days')) {
                                selectClauses.push('3 as grace_period_days');
                            } else if (column === 'failed_payment_count' && !oldColumnNames.includes('failed_payment_count')) {
                                selectClauses.push('0 as failed_payment_count');
                            } else if (column === 'pause_count' && !oldColumnNames.includes('pause_count')) {
                                selectClauses.push('0 as pause_count');
                            } else if (column === 'cancel_at_period_end' && !oldColumnNames.includes('cancel_at_period_end')) {
                                selectClauses.push('0 as cancel_at_period_end');
                            } else if (column === 'discount_amount' && !oldColumnNames.includes('discount_amount')) {
                                selectClauses.push('0 as discount_amount');
                            } else if (column === 'tax_amount' && !oldColumnNames.includes('tax_amount')) {
                                selectClauses.push('0 as tax_amount');
                            } else if (column === 'proration_amount' && !oldColumnNames.includes('proration_amount')) {
                                selectClauses.push('0 as proration_amount');
                            } else if (!oldColumnNames.includes(column)) {
                                selectClauses.push('NULL as ' + column);
                            }
                            insertColumns.push(column);
                        }
                    });
                    
                    const insertSql = `
                        INSERT INTO user_subscriptions_new (${insertColumns.join(', ')})
                        SELECT ${selectClauses.join(', ')}
                        FROM user_subscriptions
                    `;
                    
                    console.log('    🔄 Data migration SQL:', insertSql);
                    db.prepare(insertSql).run();
                    
                    // Drop old table
                    db.prepare('DROP TABLE user_subscriptions').run();
                    
                    // Rename new table
                    db.prepare('ALTER TABLE user_subscriptions_new RENAME TO user_subscriptions').run();
                });
                
                transaction();
                console.log('  ✅ Successfully removed plan_id column');
                
            } else {
                throw new Error(`Migration verification failed: ${verification.total_records} total records, ${verification.migrated_records} migrated`);
            }
            
            console.log('✅ user_subscriptions migration completed successfully');
            return;
        }
        
        // Case 3: Hybrid state (has both) - clean up by removing plan_id
        if (hasPlanId && hasPlanCode) {
            console.log('🔄 Cleaning up hybrid schema (removing plan_id column)...');
            // Same table recreation process as above
            // This handles the case where migration was partially completed
            migrateUserSubscriptionsSchema(db); // Recursive call will handle Case 2
            return;
        }
        
        // Case 4: Neither column exists (corrupted state)
        if (!hasPlanId && !hasPlanCode) {
            console.log('❌ user_subscriptions table exists but has neither plan_id nor plan_code');
            throw new Error('Corrupted user_subscriptions table: missing both plan_id and plan_code columns');
        }
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ user_subscriptions migration failed:', errorMessage);
        throw error;
    } finally {
        console.debug('user_subscriptions migration process completed');
    }
}


/**
 * Migrate auth_tokens table to support email_change_pending token type
 * @param {import('better-sqlite3').Database} db - SQLite database instance
 * @returns {void}
 */
function migrateAuthTokensSchema(db) {
    try {
        // Check if auth_tokens table exists
        const checkTable = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='auth_tokens'
        `);
        const tableExists = checkTable.get();
        
        if (!tableExists) {
            console.log('📝 auth_tokens table does not exist yet, will be created with email_change_pending support');
            return;
        }
        
        // Check current schema constraints
        const tableInfo = /** @type {{sql?: string} | undefined} */ (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='auth_tokens'").get());
        const tableSQL = tableInfo?.sql || '';
        
        // Check if email_change_pending is already supported
        if (tableSQL.includes('email_change_pending')) {
            console.log('✅ auth_tokens table already supports email_change_pending token type');
            return;
        }
        
        console.log('🔄 Migrating auth_tokens table to support email_change_pending token type...');
        
        // SQLite doesn't support modifying CHECK constraints, so we need to recreate the table
        const transaction = db.transaction(() => {
            // Create new table with updated schema
            db.prepare(`
                CREATE TABLE auth_tokens_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    token TEXT NOT NULL,
                    token_type TEXT NOT NULL CHECK (token_type IN ('otp', 'password_reset', 'refresh', 'email_change_pending')),
                    expires_at DATETIME NOT NULL,
                    is_used BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            `).run();
            
            // Copy data from old table
            db.prepare(`
                INSERT INTO auth_tokens_new (id, user_id, token, token_type, expires_at, is_used, created_at)
                SELECT id, user_id, token, token_type, expires_at, is_used, created_at
                FROM auth_tokens
            `).run();
            
            // Drop old table
            db.prepare('DROP TABLE auth_tokens').run();
            
            // Rename new table
            db.prepare('ALTER TABLE auth_tokens_new RENAME TO auth_tokens').run();
            
            // Recreate indexes
            db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens (token)').run();
            db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_tokens_type ON auth_tokens (token_type)').run();
        });
        
        transaction();
        console.log('✅ auth_tokens table migration completed successfully');
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ auth_tokens migration failed:', errorMessage);
        throw error;
    } finally {
        console.debug('auth_tokens migration process completed');
    }
}


/**
 * Create database tables if they don't exist
 * @param {import('better-sqlite3').Database} db - SQLite database instance
 * @returns {void}
 */
function createTables(db) {
    try {
        // Users table
        const createUsersTable = db.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                razorpay_customer_id TEXT UNIQUE,
                is_verified BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Auth tokens table for OTP and password reset
        const createAuthTokensTable = db.prepare(`
            CREATE TABLE IF NOT EXISTS auth_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                token TEXT NOT NULL,
                token_type TEXT NOT NULL CHECK (token_type IN ('otp', 'password_reset', 'refresh', 'email_change_pending')),
                expires_at DATETIME NOT NULL,
                is_used BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);
        
        // Execute table creation
        createUsersTable.run();
        createAuthTokensTable.run();
        
        // Create indexes for better performance
        const createEmailIndex = db.prepare('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)');
        const createRazorpayCustomerIndex = db.prepare('CREATE INDEX IF NOT EXISTS idx_users_razorpay_customer ON users (razorpay_customer_id)');
        const createTokenIndex = db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens (token)');
        const createTokenTypeIndex = db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_tokens_type ON auth_tokens (token_type)');
        
        createEmailIndex.run();
        createRazorpayCustomerIndex.run();
        createTokenIndex.run();
        createTokenTypeIndex.run();
        
        console.log('Database tables created successfully');
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Table creation failed:', errorMessage);
        throw error;
    } finally {
        console.debug('Table creation process completed');
    }
}


/**
 * Get database instance (singleton pattern)
 * @returns {import('better-sqlite3').Database} SQLite database instance
 */
function getDatabase() {
    try {
        if (!global.databaseInstance || global.databaseInstance.open === false) {
            global.databaseInstance = initializeDatabase();
        }
        return global.databaseInstance;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to get database instance:', errorMessage);
        throw error;
    } finally {
        console.debug('Database instance retrieval completed');
    }
}


/**
 * Create isolated database instance for testing
 * @param {string} testDbPath - Path to test database file
 * @returns {import('better-sqlite3').Database} SQLite database instance
 */
function createTestDatabase(testDbPath) {
    try {
        // Ensure directory exists
        const sqlDir = path.dirname(testDbPath);
        if (!fs.existsSync(sqlDir)) {
            fs.mkdirSync(sqlDir, { recursive: true });
        }
        
        // Create isolated database instance
        const db = new Database(testDbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        
        // Create tables
        createTables(db);
        
        // Initialize subscription schema
        initializeSubscriptionSchema(db);
        
        // Run schema migrations AFTER all tables are created
        runSchemaMigrations(db);
        
        console.log('Test database initialized successfully at:', testDbPath);
        return db;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Test database initialization failed:', errorMessage);
        throw error;
    } finally {
        console.debug('Test database initialization process completed');
    }
}


/**
 * Close database connection
 * @returns {void}
 */
function closeDatabase() {
    try {
        if (global.databaseInstance) {
            global.databaseInstance.close();
            global.databaseInstance = null;
            console.log('Database connection closed');
        }
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to close database:', errorMessage);
        throw error;
    } finally {
        console.debug('Database closure process completed');
    }
}


/**
 * Convenient alias for getDatabase()
 * @returns {import('better-sqlite3').Database} SQLite database instance
 */
function getDb() {
    return getDatabase();
}


// Export functions
module.exports = {
    initializeDatabase,
    getDatabase,
    getDb,
    closeDatabase,
    createTestDatabase
};