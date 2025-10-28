/**
 * Environment variables configuration and validation
 * Centralizes all environment variable access and provides validation
 */

/**
 * Validates and returns an environment variable value
 * @param {string} key - Environment variable name
 * @param {string} [defaultValue] - Default value if environment variable is not set
 * @param {boolean} [required=true] - Whether the variable is required
 * @returns {string} Environment variable value
 * @throws {Error} If required environment variable is missing
 */
function getEnvVar(key, defaultValue = null, required = true) {
	try {
		const value = process.env[key];

		if (!value && required && !defaultValue) {
			throw new Error(`Required environment variable ${key} is not set`);
		}

		return value || defaultValue;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Environment variable error:', errorMessage);
		throw error;
	} finally {
		console.debug(`Environment variable ${key} processed`);
	}
}

// Database configuration

const DB_PATH = getEnvVar('DB_PATH', '.sql/user_auth.db', false);

// Server configuration

const PORT = getEnvVar('PORT', '5000', false);
const NODE_ENV = getEnvVar('NODE_ENV', 'development', false);

// Security configuration

const CORS_ORIGIN = getEnvVar('CORS_ORIGIN', 'http://localhost:5173', false);

// Admin authentication

const ADMIN_EMAIL = getEnvVar('ADMIN_EMAIL', 'admin@example.com', false);
const ADMIN_PASSWORD = getEnvVar('ADMIN_PASSWORD', 'admin123', false);

// CSV upload limits

const MAX_CSV_ROWS = getEnvVar('MAX_CSV_ROWS', '100000', false);
const MAX_CSV_SIZE_MB = getEnvVar('MAX_CSV_SIZE_MB', '100', false);

// Email verification configuration

const MX_DOMAIN = getEnvVar('MX_DOMAIN', '', true);
const EM_DOMAIN = getEnvVar('EM_DOMAIN', '', true);

/**
 * Validates all required environment variables
 * @returns {boolean} True if all required variables are present
 * @throws {Error} If any required environment variable is missing
 */
function validateEnvironment() {
	try {
		const requiredVars = ['MX_DOMAIN', 'EM_DOMAIN', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];

		const missingVars = [];

		for (const varName of requiredVars) {
			if (!process.env[varName]) {
				missingVars.push(varName);
			}
		}

		if (missingVars.length > 0) {
			throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
		}

		console.log('Environment validation successful');
		return true;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Environment validation failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Environment validation process completed');
	}
}

// Export all environment variables and utilities
module.exports = {
	// Database
	DB_PATH,

	// Server
	PORT,
	NODE_ENV,

	// Security
	CORS_ORIGIN,

	// Admin authentication
	ADMIN_EMAIL,
	ADMIN_PASSWORD,

	// CSV upload limits
	MAX_CSV_ROWS: parseInt(MAX_CSV_ROWS, 10),
	MAX_CSV_SIZE_MB: parseInt(MAX_CSV_SIZE_MB, 10),

	// Email verification
	MX_DOMAIN,
	EM_DOMAIN,

	// Utilities
	getEnvVar,
	validateEnvironment,
};
