/**
 * Token management route functions
 * Handles token refresh and logout business logic
 */

const { getDatabase } = require('../../../database/connection');
const { 
    generateAccessToken, 
    generateRefreshToken,
    verifyRefreshToken,
    invalidateRefreshToken
} = require('../../utils/jwt');


/**
 * Handle token refresh
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function handleRefreshToken(req, res) {
    try {
        const { refreshToken } = req.body;
        
        // Verify refresh token
        const decoded = await verifyRefreshToken(refreshToken);
        
        // Get user data
        const db = getDatabase();
        const user = /** @type {{id: number, email: string, first_name: string, last_name: string, is_verified: number} | undefined} */ (db.prepare(`
            SELECT id, email, first_name, last_name, is_verified
            FROM users 
            WHERE id = ?
        `).get(decoded.userId));
        
        if (!user) {
            // User not found in database - likely deleted
            // Tell frontend to clear authentication data
            res.setHeader('X-Clear-Auth', 'true');
            
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Generate new tokens
        const payload = { userId: user.id, email: user.email };
        const newAccessToken = generateAccessToken(payload);
        const newRefreshToken = await generateRefreshToken(payload);
        
        // Invalidate old refresh token
        await invalidateRefreshToken(refreshToken);
        
        res.json({
            success: true,
            message: 'Tokens refreshed successfully',
            data: {
                tokens: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken
                }
            }
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Token refresh failed:', errorMessage);
        
        if (errorMessage.includes('expired') || 
            errorMessage.includes('invalid') || 
            errorMessage.includes('malformed') ||
            errorMessage.includes('signature')) {
            // Set header to clear auth data for any refresh token failure
            res.setHeader('X-Clear-Auth', 'true');
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Token refresh failed'
        });
    } finally {
        console.debug('Token refresh process completed');
    }
}


/**
 * Handle user logout
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function handleLogout(req, res) {
    try {
        const { refreshToken } = req.body;
        
        if (refreshToken) {
            await invalidateRefreshToken(refreshToken);
        }
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Logout failed:', errorMessage);
        
        // Still return success even if token invalidation fails
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } finally {
        console.debug('Logout process completed');
    }
}


// Export functions
module.exports = {
    handleRefreshToken,
    handleLogout
};