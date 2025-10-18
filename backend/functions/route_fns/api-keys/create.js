/**
 * API Key creation route function
 * Handles creating new API keys for users
 */

const { getDatabase } = require('../../../database/connection');
const {
    generateApiKey,
    hashApiKey,
    extractKeyPrefix
} = require('../../utils/apikey');


/**
 * Handle API key creation
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function handleCreateApiKey(req, res) {
    try {
        const { name, expiryDays } = req.body;
        const userId = req.user?.userId;

        // Validate user authentication
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in.'
            });
        }

        // Validate name
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input. Please provide a valid API key name.'
            });
        }

        if (name.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input. API key name must be 100 characters or less.'
            });
        }

        // Validate expiryDays if provided
        if (expiryDays !== undefined && expiryDays !== null) {
            if (typeof expiryDays !== 'number' || expiryDays < 1 || expiryDays > 365) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid input. Expiry days must be between 1 and 365.'
                });
            }
        }

        const db = getDatabase();

        // Get user's API key limit
        const user = /** @type {{api_key_limit: number} | undefined} */ (db.prepare(`
            SELECT api_key_limit
            FROM users
            WHERE id = ?
        `).get(userId));

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Account not found. Please check your email address or create a new account.'
            });
        }

        // Check active API key count
        const activeKeyCount = /** @type {{count: number}} */ (db.prepare(`
            SELECT COUNT(*) as count
            FROM api_keys
            WHERE user_id = ? AND is_revoked = 0
        `).get(userId));

        if (activeKeyCount.count >= user.api_key_limit) {
            return res.status(403).json({
                success: false,
                message: `You have reached the maximum limit of ${user.api_key_limit} API keys. Please revoke an existing key before creating a new one.`
            });
        }

        // Generate API key
        const apiKey = generateApiKey();
        const keyHash = await hashApiKey(apiKey);
        const keyPrefix = extractKeyPrefix(apiKey);

        // Calculate expiry date
        let expiresAt = null;
        if (expiryDays) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + expiryDays);
            expiresAt = expiryDate.toISOString();
        }

        // Insert API key into database
        const insertKey = db.prepare(`
            INSERT INTO api_keys (user_id, name, key_hash, key_prefix, expires_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = insertKey.run(
            userId,
            name.trim(),
            keyHash,
            keyPrefix,
            expiresAt
        );

        // Get the created API key details
        const keyId = result.lastInsertRowid;
        const createdKey = /** @type {{
            id: number,
            name: string,
            key_prefix: string,
            expires_at: string | null,
            created_at: string
        } | undefined} */ (db.prepare(`
            SELECT id, name, key_prefix, expires_at, created_at
            FROM api_keys
            WHERE id = ?
        `).get(keyId));

        if (!createdKey) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create API key. Please try again.'
            });
        }

        // Return success with full API key (only time user will see it)
        res.status(201).json({
            success: true,
            message: 'API key created successfully',
            data: {
                apiKey: apiKey,
                keyData: {
                    id: createdKey.id,
                    name: createdKey.name,
                    key_prefix: createdKey.key_prefix,
                    expires_at: createdKey.expires_at,
                    created_at: createdKey.created_at
                }
            }
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('API key creation failed:', errorMessage);

        res.status(500).json({
            success: false,
            message: 'Failed to create API key. Please try again.'
        });
    } finally {
        console.debug('API key creation process completed');
    }
}


// Export function
module.exports = {
    handleCreateApiKey
};
