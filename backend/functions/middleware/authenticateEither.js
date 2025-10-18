/**
 * Dual Authentication Middleware
 * Accepts EITHER JWT access token OR API key
 * Used for endpoints that serve both UI users and API users
 */

const { authenticateToken } = require('./auth');
const { authenticateApiKey } = require('./authenticateApiKey');


/**
 * Middleware that accepts either JWT or API key authentication
 * Detects authentication type from Authorization header format:
 * - JWT: Authorization: Bearer eyJhbGc... (starts with eyJ)
 * - API Key: Authorization: Bearer brndnv_sk_... (starts with brndnv_sk_)
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
function authenticateEither(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }


        // Check if Authorization header uses Bearer scheme
        if (!authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Invalid authorization header format. Use: Bearer <token>'
            });
            return;
        }


        const token = authHeader.substring(7); // Remove "Bearer " prefix


        // Detect authentication type based on token format
        if (token.startsWith('brndnv_sk_')) {
            // API Key authentication
            authenticateApiKey(req, res, next);
            return;
        } else {
            // JWT authentication (tokens typically start with eyJ in base64)
            authenticateToken(req, res, next);
            return;
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Dual authentication error:', errorMessage);

        res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
        return;

    } finally {
        console.debug('Dual authentication process completed');
    }
}


// Export middleware
module.exports = {
    authenticateEither,
};
