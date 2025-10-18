/**
 * API Programmatic Email Verification
 * Handles API key-based programmatic verification requests
 *
 * This file contains:
 * - Request validation for JSON email arrays
 * - Optional responseUrl validation
 * - Queue integration for background processing
 * - Support for both webhook and polling patterns
 */

const { v4: uuidv4 } = require('uuid');
const queue = require('../../staging/queue');
const { createVerificationRequest, updateVerificationStatus } = require('./verificationDB');
const { updateApiKeyLastUsed } = require('../../middleware/authenticateApiKey');


// ============================================================================
// CONSTANTS - Validation limits
// ============================================================================

const VALIDATION = {
	MIN_EMAILS: 1,
	MAX_EMAILS: 10000,
	EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};


// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate API verification request body
 * Checks emails array and optional responseUrl
 *
 * @param {Object} body - Request body
 * @returns {{isValid: boolean, errors: string[]}}
 */
function validateApiRequest(body) {
	/** @type {string[]} */
	const errors = [];

	// Validate emails array
	if (!Array.isArray(body.emails)) {
		errors.push('emails must be an array');
	} else if (body.emails.length < VALIDATION.MIN_EMAILS) {
		errors.push('emails array cannot be empty');
	} else if (body.emails.length > VALIDATION.MAX_EMAILS) {
		errors.push(`Maximum ${VALIDATION.MAX_EMAILS} emails per request`);
	} else {
		// Validate each email format
		body.emails.forEach((email, index) => {
			if (typeof email !== 'string') {
				errors.push(`Email at index ${index} must be a string`);
			} else if (!VALIDATION.EMAIL_REGEX.test(email)) {
				errors.push(`Invalid email format at index ${index}: ${email}`);
			}
		});

		// Limit error messages to prevent huge responses
		if (errors.length > 10) {
			const remaining = errors.length - 10;
			errors.splice(10);
			errors.push(`... and ${remaining} more validation errors`);
		}
	}

	// Validate responseUrl if provided (optional field)
	if (body.responseUrl !== undefined && body.responseUrl !== null && body.responseUrl !== '') {
		if (typeof body.responseUrl !== 'string') {
			errors.push('responseUrl must be a string');
		} else {
			try {
				const url = new URL(body.responseUrl);
				if (!['http:', 'https:'].includes(url.protocol)) {
					errors.push('responseUrl must use HTTP or HTTPS protocol');
				}
			} catch {
				errors.push('Invalid responseUrl format');
			}
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}


// ============================================================================
// MAIN ROUTE HANDLER - API programmatic verification
// ============================================================================

/**
 * @typedef {Object} AuthenticatedUser
 * @property {number} id
 * @property {number} userId
 * @property {string} email
 * @property {number} [apiKeyId]
 */

/**
 * Handle API-based email verification requests
 * Accepts JSON array of emails and optional webhook URL
 *
 * Flow:
 * 1. Validate request body (emails array, optional responseUrl)
 * 2. Generate verification request ID with "api-" prefix
 * 3. Create verification request in database
 * 4. Add to queue for background processing
 * 5. Return 202 Accepted with request ID
 *
 * @param {import('express').Request & { user?: AuthenticatedUser }} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function verifyApiRequest(req, res) {
	try {
		const { emails, responseUrl } = req.body;
		const user_id = req.user?.id;


		// Validate request body
		const validation = validateApiRequest(req.body);
		if (!validation.isValid) {
			return res.status(400).json({
				success: false,
				message: 'Request validation failed',
				errors: validation.errors,
			});
		}


		// Check if user is authenticated
		if (!user_id) {
			return res.status(401).json({
				success: false,
				message: 'Authentication required',
			});
		}


		// Generate verification request ID with api- prefix
		const verification_request_id = `api-${uuidv4()}`;


		// Create verification request in database
		const createResult = await createVerificationRequest({
			verification_request_id,
			user_id,
			request_type: 'api',
			emails,
		});

		if (!createResult.success) {
			return res.status(500).json({
				success: false,
				message: 'Failed to create verification request',
			});
		}


		// Add to verification queue with emails and responseUrl
		// If responseUrl not provided, pass empty string (controller handles this)
		const queueResult = await queue.add({
			request_id: verification_request_id,
			emails,
			response_url: responseUrl || '', // Empty string if not provided
		});

		if (!queueResult.success) {
			return res.status(500).json({
				success: false,
				message: 'Failed to add request to verification queue',
			});
		}


		// Update status to processing
		await updateVerificationStatus(verification_request_id, 'processing');


		// Update API key last_used timestamp (non-blocking)
		// This tracks actual API usage (emails queued) rather than just authentication
		if (req.user?.apiKeyId) {
			updateApiKeyLastUsed(req.user.apiKeyId).catch(error => {
				console.error('Failed to update API key last_used:', error);
			});
		}


		// Return 202 Accepted response
		// This indicates the request has been accepted for processing
		// API key caching is handled in authenticateApiKey middleware for performance
		return res.status(202).json({
			success: true,
			message: 'Verification request accepted',
			data: {
				verification_request_id,
				total_emails: emails.length,
				status: 'processing',
				...(responseUrl && { response_url: responseUrl }), // Only include if provided
			},
		});

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('API verification error:', errorMessage);

		return res.status(500).json({
			success: false,
			message: 'Internal server error occurred',
		});

	} finally {
		console.debug('API verification request completed');
	}
}


// Export functions
module.exports = {
	verifyApiRequest,
};
