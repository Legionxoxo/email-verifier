/**
 * Single email verification route function
 * Handles verification of individual email addresses
 */

const { v4: uuidv4 } = require('uuid');
const queue = require('../../staging/queue');
const controller = require('../../verifier/controller');
const {
	createVerificationRequest,
	updateVerificationStatus,
	updateVerificationResults,
	getVerificationRequest,
} = require('./verificationDB');


/**
 * Verify a single email address
 * Creates a verification request and adds it to the queue
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function verifySingleEmail(req, res) {
	try {
		const { email } = req.body;
		const user_id = req.user?.id;

		// Validate input
		if (!email || typeof email !== 'string') {
			return res.status(400).json({
				success: false,
				message: 'Email address is required',
			});
		}

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({
				success: false,
				message: 'Invalid email address format',
			});
		}

		// Check if user is authenticated
		if (!user_id) {
			return res.status(401).json({
				success: false,
				message: 'Authentication required',
			});
		}

		// Generate verification request ID
		const verification_request_id = `single-${uuidv4()}`;

		// Create verification request in database
		const createResult = await createVerificationRequest({
			verification_request_id,
			user_id,
			request_type: 'single',
			emails: [email],
		});

		if (!createResult.success) {
			return res.status(500).json({
				success: false,
				message: 'Failed to create verification request',
			});
		}

		// Add to verification queue
		const queueResult = await queue.add({
			request_id: verification_request_id,
			emails: [email],
			response_url: '', // Empty for single email - we'll poll for results
		});

		if (!queueResult.success) {
			return res.status(500).json({
				success: false,
				message: 'Failed to add request to verification queue',
			});
		}

		// Update status to processing
		await updateVerificationStatus(verification_request_id, 'processing');

		// Return success response
		return res.json({
			success: true,
			message: 'Email verification started',
			data: {
				verification_request_id,
				email,
				status: 'processing',
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Single email verification error:', errorMessage);

		return res.status(500).json({
			success: false,
			message: 'Internal server error occurred',
		});
	} finally {
		console.debug('Single email verification request completed');
	}
}


/**
 * Get verification status for a request
 * Polls the controller and updates the database if completed
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function getVerificationStatus(req, res) {
	try {
		const { verification_request_id } = req.params;
		const user_id = req.user?.id;

		if (!verification_request_id) {
			return res.status(400).json({
				success: false,
				message: 'Verification request ID is required',
			});
		}

		// Get verification request from database
		const verificationRequest = await getVerificationRequest(verification_request_id);

		if (!verificationRequest) {
			return res.status(404).json({
				success: false,
				message: 'Verification request not found',
			});
		}

		// Check if user owns this request
		if (verificationRequest.user_id !== user_id) {
			return res.status(403).json({
				success: false,
				message: 'Access denied',
			});
		}

		// If already completed, return stored results
		if (verificationRequest.status === 'completed') {
			const responseData = {
				verification_request_id: verificationRequest.verification_request_id,
				request_type: verificationRequest.request_type,
				status: verificationRequest.status,
				emails: verificationRequest.emails,
				results: verificationRequest.results,
				created_at: verificationRequest.created_at,
				updated_at: verificationRequest.updated_at,
				completed_at: verificationRequest.completed_at,
			};

			// Add statistics if available
			if (verificationRequest.statistics) {
				responseData.statistics = verificationRequest.statistics;
			}

			return res.json({
				success: true,
				data: responseData,
			});
		}

		// Check controller for updated status
		const controllerStatus = await controller.getRequestStatus(verification_request_id);

		if (controllerStatus && controllerStatus.status === 'completed') {
			// Get results from controller
			const results = await controller.getRequestResults(verification_request_id);

			if (results) {
				// Map to simplified format
				const resultsArray = results.map(result => {
					let status, message;

					if (result.error) {
						status = 'unknown';
						message = result.error_msg || 'Verification error';
					} else if (result.smtp.deliverable) {
						status = 'valid';
						message = 'Email verified successfully';
					} else if (result.smtp.catch_all) {
						status = 'catch-all';
						message = 'Domain accepts all emails (catch-all)';
					} else if (result.smtp.full_inbox) {
						status = 'invalid';
						message = 'Mailbox is full';
					} else if (result.smtp.disabled) {
						status = 'invalid';
						message = 'Mailbox is disabled';
					} else if (!result.has_mx_records) {
						status = 'invalid';
						message = 'No MX records found for domain';
					} else {
						status = 'invalid';
						message = result.error_msg || 'Email not deliverable';
					}

					return { email: result.email, status, message };
				});

				// Update database with results (statistics are calculated inside this function)
				await updateVerificationResults(verification_request_id, resultsArray);

				// Calculate statistics for response
				const statistics = {
					valid: 0,
					invalid: 0,
					catch_all: 0,
					unknown: 0,
				};

				for (const result of resultsArray) {
					const status = result.status.toLowerCase().replace('-', '_');
					if (status === 'valid') {
						statistics.valid++;
					} else if (status === 'invalid') {
						statistics.invalid++;
					} else if (status === 'catch_all' || status === 'catchall') {
						statistics.catch_all++;
					} else if (status === 'unknown') {
						statistics.unknown++;
					}
				}

				// Return updated results
				return res.json({
					success: true,
					data: {
						verification_request_id: verificationRequest.verification_request_id,
						request_type: verificationRequest.request_type,
						status: 'completed',
						emails: verificationRequest.emails,
						results: resultsArray,
						statistics: statistics,
						created_at: verificationRequest.created_at,
						completed_at: Date.now(),
					},
				});
			}
		}

		// Return current status
		return res.json({
			success: true,
			data: {
				verification_request_id: verificationRequest.verification_request_id,
				request_type: verificationRequest.request_type,
				status: verificationRequest.status,
				emails: verificationRequest.emails,
				created_at: verificationRequest.created_at,
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Get verification status error:', errorMessage);

		return res.status(500).json({
			success: false,
			message: 'Internal server error occurred',
		});
	} finally {
		console.debug('Get verification status request completed');
	}
}


// Export functions
module.exports = {
	verifySingleEmail,
	getVerificationStatus,
};
