/**
 * API Key revoke route function
 * Handles revoking API keys for users
 */

const { getDatabase } = require('../../../database/connection');


/**
 * Handle API key revocation
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function handleRevokeApiKey(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        // Validate user authentication
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in.'
            });
        }

        // Validate API key ID
        const keyId = parseInt(id, 10);
        if (isNaN(keyId) || keyId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid API key ID.'
            });
        }

        const db = getDatabase();

        // Check if API key exists and belongs to user
        const apiKey = /** @type {{
            id: number,
            user_id: number,
            name: string,
            is_revoked: number
        } | undefined} */ (db.prepare(`
            SELECT id, user_id, name, is_revoked
            FROM api_keys
            WHERE id = ?
        `).get(keyId));

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                message: 'API key not found or already revoked.'
            });
        }

        // Check if API key belongs to authenticated user
        if (apiKey.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You don\'t have permission to perform this action.'
            });
        }

        // Check if already revoked
        if (apiKey.is_revoked === 1) {
            return res.status(400).json({
                success: false,
                message: 'API key is already revoked.'
            });
        }

        // Revoke the API key
        const revokeKey = db.prepare(`
            UPDATE api_keys
            SET is_revoked = 1
            WHERE id = ?
        `);

        revokeKey.run(keyId);

        // Return success response
        res.status(200).json({
            success: true,
            message: 'API key revoked successfully',
            data: {
                id: apiKey.id,
                name: apiKey.name,
                revoked_at: new Date().toISOString()
            }
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('API key revocation failed:', errorMessage);

        res.status(500).json({
            success: false,
            message: 'Failed to revoke API key. Please try again.'
        });
    } finally {
        console.debug('API key revocation process completed');
    }
}


// Export function
module.exports = {
    handleRevokeApiKey
};
