/**
 * Email Verifier API routes
 * Provides endpoints for email verification status and results queries
 *
 * This module provides:
 * - Single email verification endpoints (verifySingleEmail)
 * - CSV bulk verification endpoints (uploadCSV, detectEmailColumn, submitCSVVerification, downloadCSVResults)
 * - Separate status and results endpoints for ALL verification types
 * - Verification history endpoints (getHistory)
 * - Health check endpoint
 */

const express = require('express');
const { authenticate } = require('../../functions/middleware/auth');
const { verifySingleEmail } = require('../../functions/route_fns/verify/singleEmailVerification');
const {
	upload,
	uploadCSV,
	detectEmailColumn,
	submitCSVVerification,
	downloadCSVResults,
} = require('../../functions/route_fns/verify/bulkCSVVerification');
const { getVerificationStatus } = require('../../functions/route_fns/verify/verificationStatus');
const { getVerificationResults } = require('../../functions/route_fns/verify/verificationResults');
const { getHistory } = require('../../functions/route_fns/verify/verificationHistory');
const { MAX_CSV_SIZE_MB } = require('../../data/env');


// Create Express router instance
const router = express.Router();


/**
 * POST /api/verifier/verify-single
 * Verify a single email address
 * Requires authentication
 *
 * @function verifySingleEmail - From singleEmailVerification.js
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with verification request ID
 */
router.post('/verify-single', authenticate, verifySingleEmail);


/**
 * GET /api/verifier/verification/:verification_request_id/status
 * Get verification status and progress for ANY request type (single, CSV, or API)
 * Returns ONLY status and progress information - NO results
 * Requires authentication
 *
 * @function getVerificationStatus - From verificationStatus.js
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with verification status and progress
 */
router.get('/verification/:verification_request_id/status', authenticate, getVerificationStatus);


/**
 * GET /api/verifier/verification/:verification_request_id/results
 * Get verification results for completed verifications ONLY
 * Returns results with pagination (default 20 items per page)
 * Requires authentication
 * Query params: ?page=1&per_page=20
 *
 * @function getVerificationResults - From verificationResults.js
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with paginated verification results
 */
router.get('/verification/:verification_request_id/results', authenticate, getVerificationResults);


/**
 * POST /api/verifier/csv/upload
 * Upload CSV file for email verification
 * Requires authentication and multipart/form-data
 *
 * @function uploadCSV - From bulkCSVVerification.js
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with CSV upload details
 */
router.post('/csv/upload', authenticate, upload.single('csvFile'), (err, req, res, next) => {
	if (err) {
		if (err.code === 'LIMIT_FILE_SIZE') {
			return res.status(400).json({
				success: false,
				message: `File too large. Maximum size is ${MAX_CSV_SIZE_MB}MB`,
			});
		}
		if (err.message === 'Only CSV files allowed') {
			return res.status(400).json({
				success: false,
				message: 'Only CSV files are allowed',
			});
		}
		return res.status(400).json({
			success: false,
			message: err.message || 'File upload failed',
		});
	}
	next();
}, uploadCSV);


/**
 * POST /api/verifier/csv/detect-email
 * Detect email column in uploaded CSV
 * Requires authentication
 *
 * @function detectEmailColumn - From bulkCSVVerification.js
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with detected email column
 */
router.post('/csv/detect-email', authenticate, detectEmailColumn);


/**
 * POST /api/verifier/csv/verify
 * Submit CSV for email verification
 * Requires authentication
 *
 * @function submitCSVVerification - From bulkCSVVerification.js
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with verification request details
 */
router.post('/csv/verify', authenticate, submitCSVVerification);


/**
 * GET /api/verifier/csv/:csv_upload_id/download
 * Download CSV with verification results
 * Requires authentication
 *
 * @function downloadCSVResults - From bulkCSVVerification.js
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends CSV file with results
 */
router.get('/csv/:csv_upload_id/download', authenticate, downloadCSVResults);


/**
 * GET /api/verifier/history
 * Get user's verification history with time-based filters
 * Requires authentication
 * Query params: ?page=1&per_page=50&period=this_month
 * Period options: this_month, last_month, last_6_months
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with paginated history
 */
router.get('/history', authenticate, getHistory);


/**
 * GET /api/verifier/health
 * Health check endpoint for verifier service monitoring
 *
 * @param {import('express').Request} _req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends health status JSON response
 */
router.get('/health', (_req, res) => {
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
 * @param {import('express').NextFunction} _next - Express next function
 * @returns {Promise<void>} Sends error response or calls next
 */
router.use((error, req, res, _next) => {
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
