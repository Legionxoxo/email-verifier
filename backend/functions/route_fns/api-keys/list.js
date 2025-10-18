/**
 * API Key list route function
 * Handles retrieving all API keys for a user
 */

const { getDatabase } = require('../../../database/connection');
const { createMaskedKey } = require('../../utils/apikey');


/**
 * Handle listing API keys
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function handleListApiKeys(req, res) {
    try {
        const userId = req.user?.userId;

        // Validate user authentication
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in.'
            });
        }

        const db = getDatabase();

        // Get all active (non-revoked) API keys for the user
        const apiKeys = /** @type {Array<{
            id: number,
            name: string,
            key_prefix: string,
            expires_at: string | null,
            is_revoked: number,
            last_used: string | null,
            created_at: string
        }>} */ (db.prepare(`
            SELECT
                id,
                name,
                key_prefix,
                expires_at,
                is_revoked,
                last_used,
                created_at
            FROM api_keys
            WHERE user_id = ? AND is_revoked = 0
            ORDER BY created_at DESC
        `).all(userId));

        // Transform data for response
        const formattedKeys = apiKeys.map(key => ({
            id: key.id,
            name: key.name,
            key_masked: createMaskedKey(key.key_prefix),
            expires_at: key.expires_at,
            is_revoked: key.is_revoked === 1,
            last_used: key.last_used,
            created_at: key.created_at
        }));

        res.status(200).json({
            success: true,
            data: {
                apiKeys: formattedKeys
            }
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('API key listing failed:', errorMessage);

        res.status(500).json({
            success: false,
            message: 'Failed to load API keys. Please try again.'
        });
    } finally {
        console.debug('API key listing process completed');
    }
}


// Export function
module.exports = {
    handleListApiKeys
};
