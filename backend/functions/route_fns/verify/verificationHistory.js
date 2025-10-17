/**
 * Verification history route functions
 * Handles retrieving verification history for users
 */

const { getDb } = require('../../../database/connection');


/**
 * @typedef {Object} HistoryQueryParams
 * @property {string} [page] - Page number
 * @property {string} [per_page] - Items per page
 * @property {string} [period] - Time period filter (this_month, last_month, last_6_months)
 */


/**
 * Calculate timestamp for period filter
 * @param {string} period - Time period
 * @returns {number} Timestamp in milliseconds
 */
function getPeriodTimestamp(period) {
	const now = new Date();

	switch (period) {
		case 'this_month': {
			// Start of current month
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			return startOfMonth.getTime();
		}
		case 'last_month': {
			// Start of last month
			const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			return startOfLastMonth.getTime();
		}
		case 'last_6_months': {
			// 6 months ago from today
			const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
			return sixMonthsAgo.getTime();
		}
		default:
			return 0; // No filter
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
		const user_id = req.user?.id;

		if (!user_id) {
			return res.status(401).json({
				success: false,
				message: 'Authentication required',
			});
		}

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

		// Build WHERE clause
		const whereClauses = ['user_id = ?'];
		/** @type {Array<string | number>} */
		const params = [user_id];

		// Add time filter if period is specified
		if (period) {
			const periodTimestamp = getPeriodTimestamp(period);
			if (periodTimestamp > 0) {
				whereClauses.push('created_at >= ?');
				params.push(periodTimestamp);
			}
		}

		const whereClause = whereClauses.join(' AND ');

		// Get total count
		const countStmt = db.prepare(`
            SELECT COUNT(*) as total
            FROM verification_requests
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
                c.original_filename,
                c.file_size
            FROM verification_requests v
            LEFT JOIN csv_uploads c ON v.verification_request_id = c.verification_request_id
            WHERE ${whereClause}
            ORDER BY v.created_at DESC
            LIMIT ? OFFSET ?
        `);

		const rows = stmt.all(...params, per_page, offset);

		return res.json({
			success: true,
			data: {
				requests: rows,
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
