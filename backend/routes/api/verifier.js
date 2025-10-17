/**
 * Email Verifier API routes
 * Provides endpoints for email verification status and results queries
 *
 * This module provides:
 * - Request status tracking
 * - Results retrieval for completed verifications
 * - Health check endpoint
 */

const express = require('express');
const controller = require('../../functions/verifier/controller');
const { authenticate } = require('../../functions/middleware/auth');
const { verifySingleEmail, getVerificationStatus } = require('../../functions/route_fns/verify/singleEmailVerification');


// Create Express router instance
const router = express.Router();


/**
 * POST /api/verifier/verify-single
 * Verify a single email address
 * Requires authentication
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with verification request ID
 */
router.post('/verify-single', authenticate, verifySingleEmail);


/**
 * GET /api/verifier/verification/:verification_request_id
 * Get verification status and results for a specific request
 * Requires authentication
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with verification status and results
 */
router.get('/verification/:verification_request_id', authenticate, getVerificationStatus);


/**
 * GET /api/verifier/status/:request_id
 * Get the status of an email verification request
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends status JSON response
 */
router.get('/status/:request_id', async (req, res) => {
	try {
		const { request_id } = req.params;

		if (!request_id) {
			return res.status(400).json({
				success: false,
				message: 'Request ID is required'
			});
		}

		const status = await controller.getRequestStatus(request_id);

		if (!status) {
			return res.status(404).json({
				success: false,
				message: 'Request not found'
			});
		}

		return res.json({
			success: true,
			data: status
		});

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Get status error:', errorMessage);

		return res.status(500).json({
			success: false,
			message: 'Internal server error occurred'
		});
	} finally {
		console.debug('Get status request completed');
	}
});


/**
 * GET /api/verifier/results/:request_id
 * Get the results of a completed email verification request
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends results JSON response
 */
router.get('/results/:request_id', async (req, res) => {
	try {
		const { request_id } = req.params;

		if (!request_id) {
			return res.status(400).json({
				success: false,
				message: 'Request ID is required'
			});
		}

		const results = await controller.getRequestResults(request_id);

		if (!results) {
			return res.status(404).json({
				success: false,
				message: 'Results not found or verification not yet completed'
			});
		}

		return res.json({
			success: true,
			data: results
		});

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Get results error:', errorMessage);

		return res.status(500).json({
			success: false,
			message: 'Internal server error occurred'
		});
	} finally {
		console.debug('Get results request completed');
	}
});


/**
 * GET /api/verifier/health
 * Health check endpoint for verifier service monitoring
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends health status JSON response
 */
router.get('/health', (req, res) => {
	try {
		const healthData = {
			success: true,
			message: 'Verifier service is healthy',
			timestamp: new Date().toISOString(),
			service: 'verifier-api',
			version: '1.0.0',
			uptime: process.uptime()
		};

		return res.json(healthData);

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Verifier health check failed:', {
			error: errorMessage,
			timestamp: new Date().toISOString()
		});

		return res.status(500).json({
			success: false,
			message: 'Verifier service health check failed',
			timestamp: new Date().toISOString()
		});
	} finally {
		console.debug('Verifier health check process completed');
	}
});


// Comprehensive error handling middleware for verifier routes

/**
 * Error handling middleware for verifier routes
 * Handles different error types with appropriate HTTP status codes
 *
 * @param {Error} error - Error object
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>} Sends error response or calls next
 */
router.use((error, req, res, next) => {
	try {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const requestInfo = {
			method: req.method,
			url: req.url,
			ip: req.ip,
			userAgent: req.get('User-Agent'),
			timestamp: new Date().toISOString()
		};

		console.error('Verifier route error:', {
			error: errorMessage,
			request: requestInfo
		});

		// Handle specific error types with appropriate status codes
		if (error.name === 'ValidationError') {
			return res.status(400).json({
				success: false,
				message: 'Request validation failed',
				error: errorMessage
			});
		}

		// Generic server error with minimal information exposure
		return res.status(500).json({
			success: false,
			message: 'Internal server error occurred'
		});

	} catch (handlerError) {
		const handlerErrorMessage = handlerError instanceof Error ? handlerError.message : String(handlerError);
		console.error('Verifier error handler failed:', {
			originalError: error instanceof Error ? error.message : String(error),
			handlerError: handlerErrorMessage,
			timestamp: new Date().toISOString()
		});

		return res.status(500).json({
			success: false,
			message: 'Critical system error'
		});
	} finally {
		console.debug('Verifier error handling process completed');
	}
});


// Export configured verifier router
module.exports = router;
