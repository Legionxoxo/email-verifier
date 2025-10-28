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
 * Ensure admin user exists in database
 * Creates user with id=1 if it doesn't exist (for foreign key relationships)
 * @param {import('better-sqlite3').Database} db - SQLite database instance
 * @returns {void}
 */
function ensureAdminUserExists(db) {
	try {
		// Check if user with id=1 exists
		const checkUser = db.prepare('SELECT id FROM users WHERE id = 1');
		const userExists = checkUser.get();

		if (!userExists) {
			// Insert admin user with id=1
			const insertUser = db.prepare('INSERT INTO users (id) VALUES (1)');
			insertUser.run();
			console.log('✅ Admin user (id=1) created successfully');
		} else {
			console.log('✅ Admin user (id=1) already exists');
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('❌ Failed to ensure admin user exists:', errorMessage);
		throw error;
	} finally {
		console.debug('Admin user check completed');
	}
}


/**
 * Create database tables if they don't exist
 * @param {import('better-sqlite3').Database} db - SQLite database instance
 * @returns {void}
 */
function createTables(db) {
	try {
		// Users table - minimal schema for simple auth (just id for foreign keys)
		const createUsersTable = db.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT
            )
        `);

		// Verification requests table (unified for single, CSV, API verifications)
		// emails column stores: string[] during pending/processing, results[] after completion
		const createVerificationRequestsTable = db.prepare(`
            CREATE TABLE IF NOT EXISTS verification_requests (
                verification_request_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                request_type TEXT CHECK(request_type IN ('single', 'csv', 'api')) NOT NULL,
                emails TEXT NOT NULL,
                statistics TEXT,
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
                list_name TEXT,
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

		// API keys table for programmatic API access
		const createApiKeysTable = db.prepare(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                key_hash TEXT NOT NULL UNIQUE,
                key_prefix TEXT NOT NULL,
                expires_at DATETIME,
                is_revoked BOOLEAN DEFAULT 0,
                last_used DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);

		// Execute table creation
		createUsersTable.run();
		createVerificationRequestsTable.run();
		createCsvUploadsTable.run();
		createApiKeysTable.run();

		// Ensure admin user exists (user_id = 1 for all foreign keys)
		ensureAdminUserExists(db);

		// Create indexes for better performance
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
		const createApiKeysUserIndex = db.prepare('CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)');
		const createApiKeysHashIndex = db.prepare('CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)');
		const createApiKeysRevokedIndex = db.prepare('CREATE INDEX IF NOT EXISTS idx_api_keys_revoked ON api_keys(user_id, is_revoked)');

		createVerificationUserDateIndex.run();
		createVerificationUserTypeIndex.run();
		createVerificationStatusIndex.run();
		createCsvUserIndex.run();
		createCsvVerificationIndex.run();
		createCsvUploadStatusIndex.run();
		createApiKeysUserIndex.run();
		createApiKeysHashIndex.run();
		createApiKeysRevokedIndex.run();

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
