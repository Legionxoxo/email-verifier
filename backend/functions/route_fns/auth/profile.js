/**
 * User profile route functions
 * Handles user profile retrieval business logic
 */


/**
 * Handle get user profile
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function handleGetProfile(req, res) {
    try {
        // User data is already available from auth middleware
        const user = req.user;
        
        res.json({
            success: true,
            message: 'Profile retrieved successfully',
            data: {
                user: {
                    id: user.userId,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    isVerified: user.isVerified,
                    createdAt: user.createdAt
                }
            }
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Get profile failed:', errorMessage);
        
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve profile'
        });
    } finally {
        console.debug('Get profile process completed');
    }
}


// Export functions
module.exports = {
    handleGetProfile
};