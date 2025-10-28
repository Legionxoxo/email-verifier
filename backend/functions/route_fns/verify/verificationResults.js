/**
 * Verification Results Handler
 * Handles result retrieval with DB-level pagination for all verification statuses
 *
 * This file contains:
 * - Result retrieval with pagination (default 20 items)
 * - DB-level LIMIT/OFFSET queries for performance
 * - CSV details integration
 * - Statistics aggregation
 * - Status information for incomplete verifications (allows single-endpoint polling)
 */

const { getVerificationRequest, getCsvDetails, getVerificationResultsPaginated } = require('./verificationDB');
const controller = require('../../verifier/controller');


// ============================================================================
// CONSTANTS - Pagination defaults
// ============================================================================

const PAGINATION = {
	DEFAULT_PAGE: 1,
	DEFAULT_PER_PAGE: 20,
	MAX_PER_PAGE: 100,
	MIN_PAGE: 1,
	MIN_PER_PAGE: 1,
};

const REQUEST_TYPE = {
	SINGLE: 'single',
	CSV: 'csv',
	API: 'api',
};

const PROGRESS_STEP = {
	RECEIVED: 'received',
	PROCESSING: 'processing',
	ANTI_GREYLISTING: 'antiGreyListing',
	COMPLETE: 'complete',
	FAILED: 'failed',
};


// ============================================================================
// PAGINATION HELPERS - Reusable pagination logic
// ============================================================================

/**
 * Parse and validate pagination parameters from query string
 * Enforces min/max limits to prevent abuse
 *
 * @param {Object} query - Express request query object
 * @returns {{page: number, perPage: number}} Sanitized pagination parameters
 */
function parsePaginationParams(query) {
	const page = Math.max(
		PAGINATION.MIN_PAGE,
		parseInt(String(query.page || PAGINATION.DEFAULT_PAGE)) || PAGINATION.DEFAULT_PAGE
	);

	const perPage = Math.min(
		PAGINATION.MAX_PER_PAGE,
		Math.max(
			PAGINATION.MIN_PER_PAGE,
			parseInt(String(query.per_page || PAGINATION.DEFAULT_PER_PAGE)) || PAGINATION.DEFAULT_PER_PAGE
		)
	);

	return { page, perPage };
}


/**
 * Build pagination metadata for API response
 * Pure function - no side effects
 *
 * @param {number} total - Total number of items
 * @param {number} page - Current page number
 * @param {number} perPage - Items per page
 * @returns {Object} Pagination metadata object
 */
function buildPaginationMetadata(total, page, perPage) {
	const offset = (page - 1) * perPage;

	return {
		page,
		per_page: perPage,
		total,
		total_pages: Math.ceil(total / perPage),
		has_more: offset + perPage < total,
	};
}


// ============================================================================
// STATUS HELPERS - For incomplete verifications
// ============================================================================

/**
 * Map controller status to frontend progress step
 * Handles greylisting detection for anti-greylisting step
 * Pure function - no side effects
 *
 * @param {Object|null} controllerStatus - Status object from controller
 * @returns {string} Progress step string for frontend
 */
function mapControllerStatusToProgressStep(controllerStatus) {
	if (!controllerStatus) {
		return PROGRESS_STEP.RECEIVED;
	}

	if (controllerStatus.status === 'completed') {
		return PROGRESS_STEP.COMPLETE;
	}

	if (controllerStatus.status === 'failed') {
		return PROGRESS_STEP.FAILED;
	}

	if (controllerStatus.status === 'processing' || controllerStatus.verifying) {
		return controllerStatus.greylist_found ? PROGRESS_STEP.ANTI_GREYLISTING : PROGRESS_STEP.PROCESSING;
	}

	if (controllerStatus.status === 'queued') {
		return PROGRESS_STEP.RECEIVED;
	}

	return PROGRESS_STEP.RECEIVED;
}


// ============================================================================
// MAIN ROUTE HANDLER - Get verification results with pagination
// ============================================================================

/**
 * Get verification results for ANY verification status
 * Allows single-endpoint polling - returns status while processing, results when completed
 * Uses DB-level pagination (LIMIT/OFFSET) for performance
 * Default 20 items per page
 *
 * Flow:
 * 1. Validate inputs and authorize user
 * 2. If not completed → return status info for polling (HTTP 200)
 * 3. If completed → fetch paginated results from DB using LIMIT/OFFSET
 * 4. Add statistics and CSV details if applicable
 * 5. Return results with pagination metadata
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function getVerificationResults(req, res) {
	try {
		// Validate request ID
		const { verification_request_id } = req.params;
		// For simple auth, use a default user_id of 1 if no user is authenticated
		const user_id = req.user?.id || 1;

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


		// Authorize - check user ownership (skip for simple auth with default user_id)
		if (verificationRequest.user_id !== user_id) {
			return res.status(403).json({
				success: false,
				message: 'Access denied',
			});
		}


		// If verification is NOT completed, return status info for polling
		// This allows single-endpoint polling: user calls /results and gets status until ready
		if (verificationRequest.status !== 'completed') {
			// Poll controller for real-time status
			const controllerStatus = await controller.getRequestStatus(verification_request_id);
			const progressStep = mapControllerStatusToProgressStep(controllerStatus);

			return res.status(200).json({
				success: true,
				data: {
					verification_request_id: verificationRequest.verification_request_id,
					request_type: verificationRequest.request_type,
					status: verificationRequest.status,
					progress_step: progressStep,
					message: 'Verification in progress. Poll this endpoint to get results when complete.',
					greylist_found: controllerStatus?.greylist_found || false,
					blacklist_found: controllerStatus?.blacklist_found || false,
					created_at: verificationRequest.created_at,
					updated_at: verificationRequest.updated_at,
				},
			});
		}


		// Verification is completed - fetch and return results
		// Parse and validate pagination parameters
		const { page, perPage } = parsePaginationParams(req.query);


		// Fetch paginated results from DB using LIMIT/OFFSET
		const paginatedData = await getVerificationResultsPaginated(verification_request_id, page, perPage);

		if (!paginatedData) {
			return res.status(500).json({
				success: false,
				message: 'Failed to fetch verification results',
			});
		}


		// Build pagination metadata
		const pagination = buildPaginationMetadata(paginatedData.total, page, perPage);


		// Build response data
		const responseData = {
			verification_request_id: verificationRequest.verification_request_id,
			request_type: verificationRequest.request_type,
			status: verificationRequest.status,
			results: paginatedData.results,
			pagination,
			created_at: verificationRequest.created_at,
			updated_at: verificationRequest.updated_at,
			completed_at: verificationRequest.completed_at,
		};


		// Add statistics if available
		if (verificationRequest.statistics) {
			responseData.statistics = verificationRequest.statistics;
		}


		// Add CSV details if this is a CSV verification
		if (verificationRequest.request_type === REQUEST_TYPE.CSV) {
			const csvDetails = await getCsvDetails(verificationRequest.verification_request_id);
			if (csvDetails) {
				responseData.csv_details = csvDetails;
			}
		}


		return res.json({
			success: true,
			data: responseData,
		});

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Get verification results error:', errorMessage);

		return res.status(500).json({
			success: false,
			message: 'Internal server error occurred',
		});

	} finally {
		console.debug('Get verification results request completed');
	}
}


// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
	getVerificationResults,
};
