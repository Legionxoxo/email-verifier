/**
 * Database connection and initialization utilities
 * Handles SQLite database setup and table creation
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Import environment variables
const { DB_PATH: ENV_DB_PATH } = require('../data/env');

// Database configuration
const DB_PATH = ENV_DB_PATH.startsWith('/') ? ENV_DB_PATH : path.join(__dirname, '..', ENV_DB_PATH);

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
		const tableInfo = /** @type {{sql?: string} | undefined} */ (
			db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='auth_tokens'").get()
		);
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
			db.prepare(
				`
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
            `
			).run();

			// Copy data from old table
			db.prepare(
				`
                INSERT INTO auth_tokens_new (id, user_id, token, token_type, expires_at, is_used, created_at)
                SELECT id, user_id, token, token_type, expires_at, is_used, created_at
                FROM auth_tokens
            `
			).run();

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

		// Verification requests table (unified for single, CSV, API verifications)
		const createVerificationRequestsTable = db.prepare(`
            CREATE TABLE IF NOT EXISTS verification_requests (
                verification_request_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                request_type TEXT CHECK(request_type IN ('single', 'csv', 'api')) NOT NULL,
                emails TEXT NOT NULL,
                results TEXT,
                status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                completed_at INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);

		// CSV uploads table (CSV-specific metadata)
		const createCsvUploadsTable = db.prepare(`
            CREATE TABLE IF NOT EXISTS csv_uploads (
                csv_upload_id TEXT PRIMARY KEY,
                verification_request_id TEXT,
                user_id INTEGER NOT NULL,
                original_filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                has_header INTEGER NOT NULL DEFAULT 1,
                headers TEXT NOT NULL,
                row_count INTEGER NOT NULL,
                column_count INTEGER NOT NULL,
                preview_data TEXT NOT NULL,
                selected_email_column TEXT,
                selected_email_column_index INTEGER,
                column_scores TEXT,
                detection_confidence REAL,
                upload_status TEXT CHECK(upload_status IN ('uploaded', 'detecting', 'ready', 'submitted')) DEFAULT 'uploaded',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (verification_request_id) REFERENCES verification_requests (verification_request_id) ON DELETE CASCADE
            )
        `);

		// Execute table creation
		createUsersTable.run();
		createAuthTokensTable.run();
		createVerificationRequestsTable.run();
		createCsvUploadsTable.run();

		// Create indexes for better performance
		const createEmailIndex = db.prepare('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)');
		const createTokenIndex = db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens (token)');
		const createTokenTypeIndex = db.prepare(
			'CREATE INDEX IF NOT EXISTS idx_auth_tokens_type ON auth_tokens (token_type)'
		);
		const createVerificationUserDateIndex = db.prepare(
			'CREATE INDEX IF NOT EXISTS idx_verification_user_date ON verification_requests(user_id, created_at DESC)'
		);
		const createVerificationUserTypeIndex = db.prepare(
			'CREATE INDEX IF NOT EXISTS idx_verification_user_type ON verification_requests(user_id, request_type)'
		);
		const createVerificationStatusIndex = db.prepare(
			'CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_requests(user_id, status)'
		);
		const createCsvUserIndex = db.prepare('CREATE INDEX IF NOT EXISTS idx_csv_user ON csv_uploads(user_id)');
		const createCsvVerificationIndex = db.prepare(
			'CREATE INDEX IF NOT EXISTS idx_csv_verification ON csv_uploads(verification_request_id)'
		);
		const createCsvUploadStatusIndex = db.prepare(
			'CREATE INDEX IF NOT EXISTS idx_csv_upload_status ON csv_uploads(upload_status)'
		);

		createEmailIndex.run();
		createTokenIndex.run();
		createTokenTypeIndex.run();
		createVerificationUserDateIndex.run();
		createVerificationUserTypeIndex.run();
		createVerificationStatusIndex.run();
		createCsvUserIndex.run();
		createCsvVerificationIndex.run();
		createCsvUploadStatusIndex.run();

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
	createTestDatabase,
};
