/**
 * Environment variables configuration and validation for frontend
 * Centralizes all environment variable access and provides validation
 */

/**
 * Validates and returns an environment variable value
 * @param key - Environment variable name
 * @param defaultValue - Default value if environment variable is not set
 * @param required - Whether the variable is required
 * @returns Environment variable value
 * @throws Error if required environment variable is missing
 */
function getEnvVar(key: string, defaultValue: string | null = null, required: boolean = true): string {
    try {
        const value = import.meta.env[key];
        
        if (!value && required && !defaultValue) {
            throw new Error(`Required environment variable ${key} is not set`);
        }
        
        return value || defaultValue || '';
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Environment variable error:', errorMessage);
        throw error;
    } finally {
        // Debug logging omitted for production
    }
}


// API configuration

export const API_BASE_URL = getEnvVar('VITE_API_URL', 'http://localhost:5000', false);
export const API_TIMEOUT = parseInt(getEnvVar('VITE_API_TIMEOUT', '10000', false), 10);


// App configuration

export const APP_NAME = getEnvVar('VITE_APP_NAME', 'MicroSAAS Template', false);
export const APP_VERSION = getEnvVar('VITE_APP_VERSION', '1.0.0', false);
export const NODE_ENV = getEnvVar('VITE_NODE_ENV', 'development', false);


// Authentication configuration

export const JWT_STORAGE_KEY = getEnvVar('VITE_JWT_STORAGE_KEY', 'token', false);
export const USER_STORAGE_KEY = getEnvVar('VITE_USER_STORAGE_KEY', 'user', false);
export const REFRESH_TOKEN_STORAGE_KEY = getEnvVar('VITE_REFRESH_TOKEN_STORAGE_KEY', 'refreshToken', false);


// UI configuration

export const TOAST_DURATION = parseInt(getEnvVar('VITE_TOAST_DURATION', '4000', false), 10);
export const THEME_STORAGE_KEY = getEnvVar('VITE_THEME_STORAGE_KEY', 'theme', false);


// Feature flags

export const ENABLE_ANALYTICS = getEnvVar('VITE_ENABLE_ANALYTICS', 'false', false) === 'true';
export const ENABLE_DEBUG = getEnvVar('VITE_ENABLE_DEBUG', 'false', false) === 'true';
export const ENABLE_OTP_LOGIN = getEnvVar('VITE_ENABLE_OTP_LOGIN', 'true', false) === 'true';


// Development configuration

export const IS_DEVELOPMENT = NODE_ENV === 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';


/**
 * Validates all required environment variables
 * @returns True if all required variables are present
 * @throws Error if any required environment variable is missing
 */
export function validateEnvironment(): boolean {
    try {
        const requiredVars: string[] = [
            // Add any required environment variables here
        ];
        
        const missingVars: string[] = [];
        
        for (const varName of requiredVars) {
            if (!import.meta.env[varName]) {
                missingVars.push(varName);
            }
        }
        
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }
        
        // Debug logging omitted for production
        return true;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Environment validation failed:', errorMessage);
        throw error;
    } finally {
        // Debug logging omitted for production
    }
}


/**
 * Environment configuration object for easy access
 */
export const config = {
    api: {
        baseUrl: API_BASE_URL,
        timeout: API_TIMEOUT,
    },
    app: {
        name: APP_NAME,
        version: APP_VERSION,
        environment: NODE_ENV,
        isDevelopment: IS_DEVELOPMENT,
        isProduction: IS_PRODUCTION,
    },
    auth: {
        jwtStorageKey: JWT_STORAGE_KEY,
        userStorageKey: USER_STORAGE_KEY,
        refreshTokenStorageKey: REFRESH_TOKEN_STORAGE_KEY,
    },
    ui: {
        toastDuration: TOAST_DURATION,
        themeStorageKey: THEME_STORAGE_KEY,
    },
    features: {
        analytics: ENABLE_ANALYTICS,
        debug: ENABLE_DEBUG,
        otpLogin: ENABLE_OTP_LOGIN,
    },
} as const;


// Initialize environment validation on module load
try {
    validateEnvironment();
} catch (error) {
    if (IS_DEVELOPMENT) {
        console.warn('Environment validation failed during module initialization:', error);
    }
}