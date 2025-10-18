/**
 * Verification Status Handler
 * Handles status and progress tracking for ALL verification types (single, CSV, API)
 *
 * This file contains:
 * - Status polling and progress tracking
 * - Controller integration for real-time status
 * - Progress step mapping (received, processing, anti-greylisting, complete, failed)
 * - NO results or pagination - use verificationResults.js for that
 */

const controller = require('../../verifier/controller');
const { getVerificationRequest } = require('./verificationDB');


// ============================================================================
// CONSTANTS - Single source of truth for status values
// ============================================================================

const VERIFICATION_STATUS = {
	PENDING: 'pending',
	PROCESSING: 'processing',
	COMPLETED: 'completed',
	FAILED: 'failed',
};

const PROGRESS_STEP = {
	RECEIVED: 'received',
	PROCESSING: 'processing',
	ANTI_GREYLISTING: 'antiGreyListing',
	COMPLETE: 'complete',
	FAILED: 'failed',
};


// ============================================================================
// STATUS MAPPERS - Controller status to frontend progress steps
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
// MAIN ROUTE HANDLER - Get verification status (NO RESULTS)
// ============================================================================

/**
 * Get verification status for ANY request type (single, CSV, or API)
 * This endpoint ONLY returns status and progress - NO RESULTS
 * For results, use verificationResults.js endpoint
 *
 * Flow:
 * 1. Validate inputs and authorize user
 * 2. Get verification request from database
 * 3. Poll controller for real-time status if active
 * 4. Return status, progress step, and metadata (NO RESULTS)
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function getVerificationStatus(req, res) {
	try {
		// Validate request ID
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


		// Authorize - check user ownership
		if (verificationRequest.user_id !== user_id) {
			return res.status(403).json({
				success: false,
				message: 'Access denied',
			});
		}


		// Build base response data
		const responseData = {
			verification_request_id: verificationRequest.verification_request_id,
			request_type: verificationRequest.request_type,
			status: verificationRequest.status,
			created_at: verificationRequest.created_at,
			updated_at: verificationRequest.updated_at,
		};


		// For completed verifications
		if (verificationRequest.status === VERIFICATION_STATUS.COMPLETED) {
			responseData.progress_step = PROGRESS_STEP.COMPLETE;
			responseData.completed_at = verificationRequest.completed_at;

			// Add statistics if available
			if (verificationRequest.statistics) {
				responseData.statistics = verificationRequest.statistics;
			}

			return res.json({
				success: true,
				data: responseData,
			});
		}


		// For active verifications - poll controller for real-time status
		const controllerStatus = await controller.getRequestStatus(verification_request_id);
		const progressStep = mapControllerStatusToProgressStep(controllerStatus);

		responseData.progress_step = progressStep;
		responseData.greylist_found = controllerStatus?.greylist_found || false;
		responseData.blacklist_found = controllerStatus?.blacklist_found || false;

		return res.json({
			success: true,
			data: responseData,
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


// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
	getVerificationStatus,
};
