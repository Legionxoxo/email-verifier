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

const DB_PATH = getEnvVar('DB_PATH', '.sql/auth.db', false);


// Server configuration

const PORT = getEnvVar('PORT', '5000', false);
const NODE_ENV = getEnvVar('NODE_ENV', 'development', false);


// JWT configuration

const JWT_SECRET = getEnvVar('JWT_SECRET', 'your-super-secret-jwt-key', true);
const JWT_REFRESH_SECRET = getEnvVar('JWT_REFRESH_SECRET', 'your-super-secret-refresh-key', true);


// Email configuration (if needed for OTP)

const SMTP_HOST = getEnvVar('SMTP_HOST', '', false);
const SMTP_PORT = getEnvVar('SMTP_PORT', '587', false);
const SMTP_USER = getEnvVar('SMTP_USER', '', false);
const SMTP_PASS = getEnvVar('SMTP_PASS', '', false);


// Rate limiting configuration

const RATE_LIMIT_WINDOW_MS = getEnvVar('RATE_LIMIT_WINDOW_MS', '900000', false); // 15 minutes
const RATE_LIMIT_MAX = getEnvVar('RATE_LIMIT_MAX', '100', false);


// Security configuration

const CORS_ORIGIN = getEnvVar('CORS_ORIGIN', 'http://localhost:5173', false);
const BCRYPT_ROUNDS = getEnvVar('BCRYPT_ROUNDS', '12', false);


// Razorpay configuration

const RAZORPAY_KEY_ID = getEnvVar('RAZORPAY_KEY_ID', '', true);
const RAZORPAY_KEY_SECRET = getEnvVar('RAZORPAY_KEY_SECRET', '', true);
const RAZORPAY_WEBHOOK_SECRET = getEnvVar('RAZORPAY_WEBHOOK_SECRET', '', true);


/**
 * Validates all required environment variables
 * @returns {boolean} True if all required variables are present
 * @throws {Error} If any required environment variable is missing
 */
function validateEnvironment() {
    try {
        const requiredVars = [
            'JWT_SECRET',
            'JWT_REFRESH_SECRET',
            'RAZORPAY_KEY_ID',
            'RAZORPAY_KEY_SECRET',
            'RAZORPAY_WEBHOOK_SECRET'
        ];
        
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
    
    // JWT
    JWT_SECRET,
    JWT_REFRESH_SECRET,
    
    // Email
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    
    // Rate limiting
    RATE_LIMIT_WINDOW_MS: parseInt(RATE_LIMIT_WINDOW_MS, 10),
    RATE_LIMIT_MAX: parseInt(RATE_LIMIT_MAX, 10),
    
    // Security
    CORS_ORIGIN,
    BCRYPT_ROUNDS: parseInt(BCRYPT_ROUNDS, 10),
    
    // Razorpay
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET,
    
    // Utilities
    getEnvVar,
    validateEnvironment
};