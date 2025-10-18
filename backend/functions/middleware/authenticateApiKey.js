/**
 * API Key Authentication Middleware
 * Validates API keys from Authorization header and authenticates users
 */

const { validateApiKeyFormat, compareApiKey } = require('../utils/apikey');
const { getDatabase } = require('../../database/connection');


/**
 * @typedef {Object} AuthenticatedUser
 * @property {number} id - User ID
 * @property {number} userId - User ID (duplicate for compatibility)
 * @property {number} [apiKeyId] - API Key ID (only present for API key auth)
 * @property {string} [email] - User email (only present for JWT auth)
 */

/**
 * Middleware to authenticate API key from Authorization header
 * Format: Bearer brndnv_sk_xxxxx...
 *
 * @param {import('express').Request & { user?: AuthenticatedUser }} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void | import('express').Response>}
 */
async function authenticateApiKey(req, res, next) {
    try {
        // Extract API key from Authorization header
        const authHeader = req.headers['authorization'];
        const apiKey = authHeader && authHeader.startsWith('Bearer brndnv_sk_')
            ? authHeader.substring(7)
            : null;

        if (!apiKey) {
            res.status(401).json({
                success: false,
                message: 'API key is required'
            });
            return;
        }


        // Validate API key format
        if (!validateApiKeyFormat(apiKey)) {
            res.status(401).json({
                success: false,
                message: 'Invalid API key format'
            });
            return;
        }


        // Find and validate API key in database
        const validApiKey = await validateAndFetchApiKey(apiKey);

        if (!validApiKey) {
            res.status(401).json({
                success: false,
                message: 'Invalid or expired API key'
            });
            return;
        }


        // Attach user information to request object
        req.user = {
            id: validApiKey.user_id,
            userId: validApiKey.user_id,
            email: '', // Empty for API key auth (not available from API key)
            apiKeyId: validApiKey.id
        };


        next();

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('API key authentication error:', errorMessage);

        res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
        return;

    } finally {
        console.debug('API key authentication process completed');
    }
}


/**
 * @typedef {Object} ApiKeyRow
 * @property {number} id
 * @property {number} user_id
 * @property {string} name
 * @property {string} key_hash
 * @property {string | null} expires_at
 */

/**
 * Validate API key and fetch from database
 * Checks all active API keys and compares using bcrypt
 *
 * @param {string} apiKey - Plain text API key
 * @returns {Promise<{id: number, user_id: number, name: string, expires_at: string | null} | null>}
 */
async function validateAndFetchApiKey(apiKey) {
    try {
        const db = getDatabase();

        // Get all non-revoked API keys
        const apiKeys = /** @type {ApiKeyRow[]} */ (db.prepare(`
            SELECT id, user_id, name, key_hash, expires_at
            FROM api_keys
            WHERE is_revoked = 0
        `).all());


        // Check each API key hash using bcrypt.compare
        for (const key of apiKeys) {
            const isMatch = await compareApiKey(apiKey, key.key_hash);

            if (isMatch) {
                // Check if expired
                if (key.expires_at) {
                    const expiryDate = new Date(key.expires_at);
                    const now = new Date();

                    if (expiryDate < now) {
                        // API key has expired
                        return null;
                    }
                }

                // Valid API key found
                return {
                    id: key.id,
                    user_id: key.user_id,
                    name: key.name,
                    expires_at: key.expires_at
                };
            }
        }

        // No matching API key found
        return null;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('API key validation error:', errorMessage);
        return null;

    } finally {
        console.debug('API key validation process completed');
    }
}


/**
 * Update last_used timestamp for API key
 * Runs asynchronously without blocking the request
 *
 * @param {number} apiKeyId - API key ID
 * @returns {Promise<void>}
 */
async function updateApiKeyLastUsed(apiKeyId) {
    try {
        const db = getDatabase();
        const now = new Date().toISOString();

        db.prepare(`
            UPDATE api_keys
            SET last_used = ?
            WHERE id = ?
        `).run(now, apiKeyId);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to update last_used timestamp:', errorMessage);
        throw error;

    } finally {
        console.debug('API key last_used update completed');
    }
}


// Export middleware and utility function
module.exports = {
    authenticateApiKey,
    updateApiKeyLastUsed,
};
