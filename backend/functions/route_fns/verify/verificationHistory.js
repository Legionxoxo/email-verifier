/**
 * Verification history route functions
 * Handles retrieving verification history for users
 *
 * Each history item contains a verification_request_id that can be used with:
 * - GET /api/verifier/verification/:verification_request_id/status - For current status
 * - GET /api/verifier/verification/:verification_request_id/results - For results (completed only)
 */

const { getDb } = require('../../../database/connection');


/**
 * @typedef {Object} HistoryQueryParams
 * @property {string} [page] - Page number
 * @property {string} [per_page] - Items per page
 * @property {string} [period] - Time period filter (this_month, last_month, last_6_months)
 */


/**
 * Calculate timestamp range for period filter
 * @param {string} period - Time period
 * @returns {{start: number, end: number | null}} Timestamp range in milliseconds (null end means no upper bound)
 */
function getPeriodTimestampRange(period) {
	const now = new Date();

	switch (period) {
		case 'this_month': {
			// Start of current month to now
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			return {
				start: startOfMonth.getTime(),
				end: null // No upper bound (includes future dates in current month)
			};
		}
		case 'last_month': {
			// Start of last month to end of last month
			const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1); // Start of this month = end of last month
			return {
				start: startOfLastMonth.getTime(),
				end: endOfLastMonth.getTime()
			};
		}
		case 'last_6_months': {
			// 6 months ago from today to now
			const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
			return {
				start: sixMonthsAgo.getTime(),
				end: null // No upper bound
			};
		}
		default:
			return { start: 0, end: null }; // No filter
	}
}


/**
 * Get user's verification history with time-based filters
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function getHistory(req, res) {
	try {
		// For simple auth, use a default user_id of 1 if no user is authenticated
		const user_id = req.user?.id || 1;

		const query = /** @type {HistoryQueryParams} */ (req.query);

		// Parse query parameters
		const page = parseInt(query.page || '1', 10);
		const per_page = parseInt(query.per_page || '50', 10);
		const period = query.period;

		// Validate period if provided
		if (period && !['this_month', 'last_month', 'last_6_months'].includes(period)) {
			return res.status(400).json({
				success: false,
				message: 'Invalid period. Must be: this_month, last_month, or last_6_months',
			});
		}

		const db = getDb();
		const offset = (page - 1) * per_page;

		// Build WHERE clause with table prefixes
		const whereClauses = ['v.user_id = ?'];
		/** @type {Array<string | number>} */
		const params = [user_id];

		// Add time filter if period is specified
		if (period) {
			const periodRange = getPeriodTimestampRange(period);
			if (periodRange.start > 0) {
				whereClauses.push('v.created_at >= ?');
				params.push(periodRange.start);
			}
			// Add upper bound filter if specified (for last_month)
			if (periodRange.end !== null) {
				whereClauses.push('v.created_at < ?');
				params.push(periodRange.end);
			}
		}

		const whereClause = whereClauses.join(' AND ');

		// Get total count
		const countStmt = db.prepare(`
            SELECT COUNT(*) as total
            FROM verification_requests v
            WHERE ${whereClause}
        `);
		const countRow = /** @type {{total: number} | undefined} */ (countStmt.get(...params));
		const total = countRow?.total || 0;

		// Get paginated requests with CSV metadata if available
		const stmt = db.prepare(`
            SELECT
                v.verification_request_id,
                v.request_type,
                v.status,
                json_array_length(v.emails) as email_count,
                v.created_at,
                v.updated_at,
                v.completed_at,
                c.csv_upload_id,
                c.list_name,
                c.original_filename,
                c.file_size
            FROM verification_requests v
            LEFT JOIN csv_uploads c ON v.verification_request_id = c.verification_request_id
            WHERE ${whereClause}
            ORDER BY v.created_at DESC
            LIMIT ? OFFSET ?
        `);

		const rows = /** @type {Array<{verification_request_id: string, request_type: string, status: string, email_count: number, created_at: number, updated_at: number, completed_at: number | null, csv_upload_id: string | null, list_name: string | null, original_filename: string | null, file_size: number | null}>} */ (stmt.all(...params, per_page, offset));

		// Add helpful metadata for frontend to know which endpoints to use
		const requestsWithMetadata = rows.map(row => ({
			...row,
			// URLs for accessing status and results
			status_url: `/api/verifier/verification/${row.verification_request_id}/status`,
			results_url: row.status === 'completed'
				? `/api/verifier/verification/${row.verification_request_id}/results`
				: null, // Results only available for completed verifications
			// Download URL for CSV verifications
			download_url: row.csv_upload_id && row.status === 'completed'
				? `/api/verifier/csv/${row.csv_upload_id}/download`
				: null,
		}));

		return res.json({
			success: true,
			data: {
				requests: requestsWithMetadata,
				total: total,
				page: page,
				per_page: per_page,
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Get history error:', errorMessage);

		return res.status(500).json({
			success: false,
			message: 'Failed to retrieve history',
		});
	} finally {
		console.debug('Get history request completed');
	}
}


// Export functions
module.exports = {
	getHistory,
};
