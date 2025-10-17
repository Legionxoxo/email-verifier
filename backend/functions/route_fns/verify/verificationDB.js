/**
 * Database functions for verification_requests table
 * Handles all database operations for email verification requests
 */

const { getDb } = require('../../../database/connection');

/**
 * @typedef {Object} VerificationRequestRow
 * @property {string} verification_request_id
 * @property {number} user_id
 * @property {string} request_type
 * @property {string} emails - JSON string array
 * @property {string | null} results - JSON string array or null
 * @property {string} status
 * @property {number} created_at
 * @property {number} updated_at
 * @property {number | null} completed_at
 */

/**
 * @typedef {Object} VerificationRequestCountRow
 * @property {number} total
 */


/**
 * Create a new verification request in the database
 * @param {Object} params - Verification request parameters
 * @param {string} params.verification_request_id - Unique ID for the verification request
 * @param {number} params.user_id - User ID making the request
 * @param {'single' | 'csv' | 'api'} params.request_type - Type of verification request
 * @param {string[]} params.emails - Array of emails to verify
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function createVerificationRequest({ verification_request_id, user_id, request_type, emails }) {
	try {
		const db = getDb();
		const now = Date.now();

		const stmt = db.prepare(`
            INSERT INTO verification_requests
            (verification_request_id, user_id, request_type, emails, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `);

		stmt.run(verification_request_id, user_id, request_type, JSON.stringify(emails), now, now);

		return {
			success: true,
			message: 'Verification request created successfully',
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Create verification request error:', errorMessage);

		return {
			success: false,
			message: 'Failed to create verification request',
		};
	} finally {
		console.debug('Create verification request process completed');
	}
}


/**
 * Update verification request status
 * @param {string} verification_request_id - Verification request ID
 * @param {'pending' | 'processing' | 'completed' | 'failed'} status - New status
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function updateVerificationStatus(verification_request_id, status) {
	try {
		const db = getDb();
		const now = Date.now();

		const stmt = db.prepare(`
            UPDATE verification_requests
            SET status = ?, updated_at = ?
            WHERE verification_request_id = ?
        `);

		stmt.run(status, now, verification_request_id);

		return {
			success: true,
			message: 'Verification status updated successfully',
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Update verification status error:', errorMessage);

		return {
			success: false,
			message: 'Failed to update verification status',
		};
	} finally {
		console.debug('Update verification status process completed');
	}
}


/**
 * Update verification request with results
 * @param {string} verification_request_id - Verification request ID
 * @param {Array<Object>} results - Verification results array
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function updateVerificationResults(verification_request_id, results) {
	try {
		const db = getDb();
		const now = Date.now();

		const stmt = db.prepare(`
            UPDATE verification_requests
            SET results = ?, status = 'completed', completed_at = ?, updated_at = ?
            WHERE verification_request_id = ?
        `);

		stmt.run(JSON.stringify(results), now, now, verification_request_id);

		return {
			success: true,
			message: 'Verification results updated successfully',
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Update verification results error:', errorMessage);

		return {
			success: false,
			message: 'Failed to update verification results',
		};
	} finally {
		console.debug('Update verification results process completed');
	}
}


/**
 * Get verification request by ID
 * @param {string} verification_request_id - Verification request ID
 * @returns {Promise<Object | null>} Verification request object or null
 */
async function getVerificationRequest(verification_request_id) {
	try {
		const db = getDb();

		const stmt = db.prepare(`
            SELECT * FROM verification_requests
            WHERE verification_request_id = ?
        `);

		const row = /** @type {VerificationRequestRow | undefined} */ (stmt.get(verification_request_id));

		if (!row) {
			return null;
		}

		// Parse JSON fields
		return {
			verification_request_id: row.verification_request_id,
			user_id: row.user_id,
			request_type: row.request_type,
			emails: JSON.parse(row.emails),
			results: row.results ? JSON.parse(row.results) : null,
			status: row.status,
			created_at: row.created_at,
			updated_at: row.updated_at,
			completed_at: row.completed_at,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Get verification request error:', errorMessage);

		return null;
	} finally {
		console.debug('Get verification request process completed');
	}
}


/**
 * Get user's verification history
 * @param {number} user_id - User ID
 * @param {Object} options - Query options
 * @param {number} [options.page] - Page number (default: 1)
 * @param {number} [options.per_page] - Items per page (default: 50)
 * @param {'single' | 'csv' | 'api'} [options.request_type] - Filter by request type
 * @param {'pending' | 'processing' | 'completed' | 'failed'} [options.status] - Filter by status
 * @returns {Promise<{requests: Array<Object>, total: number, page: number, per_page: number}>}
 */
async function getUserVerificationHistory(user_id, options = {}) {
	const page = options.page || 1;
	const per_page = options.per_page || 50;

	try {
		const db = getDb();
		const offset = (page - 1) * per_page;

		// Build WHERE clause with filters
		const whereClauses = ['user_id = ?'];
		/** @type {Array<string | number>} */
		const params = [user_id];

		if (options.request_type) {
			whereClauses.push('request_type = ?');
			params.push(options.request_type);
		}

		if (options.status) {
			whereClauses.push('status = ?');
			params.push(options.status);
		}

		const whereClause = whereClauses.join(' AND ');

		// Get total count
		const countStmt = db.prepare(`
            SELECT COUNT(*) as total
            FROM verification_requests
            WHERE ${whereClause}
        `);
		const countRow = /** @type {VerificationRequestCountRow | undefined} */ (countStmt.get(...params));
		const total = countRow?.total || 0;

		// Get paginated requests
		const stmt = db.prepare(`
            SELECT
                verification_request_id,
                request_type,
                status,
                json_array_length(emails) as email_count,
                created_at,
                updated_at,
                completed_at
            FROM verification_requests
            WHERE ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `);

		const rows = stmt.all(...params, per_page, offset);

		return {
			requests: rows,
			total: total,
			page: page,
			per_page: per_page,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Get user verification history error:', errorMessage);

		return {
			requests: [],
			total: 0,
			page: page,
			per_page: per_page,
		};
	} finally {
		console.debug('Get user verification history process completed');
	}
}


// Export functions
module.exports = {
	createVerificationRequest,
	updateVerificationStatus,
	updateVerificationResults,
	getVerificationRequest,
	getUserVerificationHistory,
};
