/**
 * Simple login handler
 * Just returns success if credentials were verified by middleware
 * No tokens, no database, no persistence
 */


/**
 * Handle simple login
 * Credentials already verified by middleware
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleSimpleLogin(req, res) {
    try {
        // If we reached here, middleware already verified credentials
        // Just return success
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    email: req.body.email,
                    // No other user data needed for dev environment
                }
            }
        });
    } catch (error) {
        console.error('Simple login handler error:', error);
        return res.status(500).json({
            success: false,
            message: 'Login failed due to server error'
        });
    } finally {
        // Debug logging
    }
}


module.exports = {
    handleSimpleLogin
};
