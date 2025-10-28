/**
 * Simple authentication middleware
 * Verifies admin credentials against environment variables
 */

const { ADMIN_EMAIL, ADMIN_PASSWORD } = require('../../data/env');

/**
 * Middleware to verify simple login credentials
 * Since there's no token/session, this is only used for login endpoint
 * After login, frontend just stores a flag indicating logged in
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function verifyAdminCredentials(req, res, next) {
	try {
		const { email, password } = req.body;

		// Validate input presence
		if (!email || !password) {
			return res.status(400).json({
				success: false,
				message: 'Email and password are required',
			});
		}

		// Simple comparison with env variables
		if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
			// Credentials match - allow access
			next();
		} else {
			// Credentials don't match
			return res.status(401).json({
				success: false,
				message: 'Invalid email or password',
			});
		}
	} catch (error) {
		console.error('Simple auth error:', error);
		return res.status(500).json({
			success: false,
			message: 'Authentication error occurred',
		});
	}
}

/**
 * Dummy middleware for routes that previously required auth
 * Since this is single-user dev environment with no persistence,
 * we just allow all requests through
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function allowAll(req, res, next) {
	try {
		// Just pass through - no authentication required
		next();
	} catch (error) {
		console.error('AllowAll middleware error:', error);
		return res.status(500).json({
			success: false,
			message: 'Server error',
		});
	}
}

module.exports = {
	verifyAdminCredentials,
	allowAll,
};
