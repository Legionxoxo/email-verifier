/**
 * Bulk CSV email verification route functions
 * Handles CSV upload, email detection, and verification
 */

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const multer = require('multer');
const queue = require('../../staging/queue');
const controller = require('../../verifier/controller');
const { getDb } = require('../../../database/connection');
const {
	createVerificationRequest,
	updateVerificationStatus,
	updateVerificationResults,
} = require('./verificationDB');


/**
 * @typedef {Object} CsvUploadRow
 * @property {string} csv_upload_id
 * @property {string | null} verification_request_id
 * @property {number} user_id
 * @property {string | null} list_name
 * @property {string} original_filename
 * @property {string} file_path
 * @property {number} file_size
 * @property {number} has_header
 * @property {string} headers
 * @property {number} row_count
 * @property {number} column_count
 * @property {string} preview_data
 * @property {string | null} selected_email_column
 * @property {number | null} selected_email_column_index
 * @property {string | null} column_scores
 * @property {number | null} detection_confidence
 * @property {string} upload_status
 * @property {number} created_at
 * @property {number} updated_at
 * @property {string | null} results - From JOIN with verification_requests
 */

/**
 * @typedef {import('express').Request & {csvUploadId?: string, originalFilename?: string, file?: {path: string, size: number, originalname: string}}} MulterRequest
 */


// Configure Multer for disk storage
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const uploadDir = path.join(__dirname, '../../../uploads/raw');
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
		}
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		const csvUploadId = `csv-${uuidv4()}`;
		req.csvUploadId = csvUploadId;
		req.originalFilename = file.originalname;
		cb(null, `${csvUploadId}_original.csv`);
	},
});

const upload = multer({
	storage: storage,
	limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
	fileFilter: (req, file, cb) => {
		if (file.mimetype === 'text/csv' && file.originalname.endsWith('.csv')) {
			cb(null, true);
		} else {
			cb(new Error('Only CSV files allowed'), false);
		}
	},
});


/**
 * Upload and parse CSV file
 * Stores file on disk and extracts metadata
 *
 * @param {MulterRequest} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function uploadCSV(req, res) {
	try {
		const csvUploadId = req.csvUploadId;
		const filePath = req.file?.path;
		const originalFilename = req.originalFilename;
		const user_id = req.user?.id;

		if (!user_id) {
			return res.status(401).json({
				success: false,
				message: 'Authentication required',
			});
		}

		// Get has_header and list_name from request body
		const hasHeader = req.body.has_header !== undefined
			? (req.body.has_header === true || req.body.has_header === 'true' || req.body.has_header === '1')
			: true;
		const listName = req.body.list_name || null;

		let rowIndex = 0;
		let totalRows = 0;
		let columnCount = 0;
		/** @type {string[]} */
		let headers = [];
		/** @type {Record<string, string>[]} */
		const preview = [];

		// Stream parse to get preview and count
		const stream = fs.createReadStream(filePath);

		await new Promise((resolve, reject) => {
			Papa.parse(stream, {
				header: false, // Manual parsing to avoid dot issues
				step: (results) => {
					const row = /** @type {string[]} */ (results.data);

					// First row handling
					if (rowIndex === 0) {
						columnCount = row.length;

						if (columnCount > 100) {
							reject(new Error('Too many columns (max 100)'));
							return;
						}

						if (hasHeader) {
							// First row is header
							headers = row;
						} else {
							// No header - generate column names
							headers = row.map((_, i) => `Column ${i + 1}`);
							// First row is data - add to preview
							if (preview.length < 5) {
								/** @type {Record<string, string>} */
								const previewObj = {};
								headers.forEach((h, i) => (previewObj[h] = row[i]));
								preview.push(previewObj);
							}
						}
					} else {
						// Data rows
						totalRows++;

						if (totalRows >= 100000) {
							reject(new Error('Too many rows (max 100,000)'));
							return;
						}

						// Collect preview rows (skip first if it's header)
						if (preview.length < 5) {
							/** @type {Record<string, string>} */
							const previewObj = {};
							headers.forEach((h, i) => (previewObj[h] = row[i]));
							preview.push(previewObj);
						}
					}

					rowIndex++;
				},
				complete: resolve,
				error: reject,
			});
		});

		// Adjust row count based on hasHeader
		const dataRowCount = hasHeader ? totalRows : totalRows + 1;

		// Insert metadata into database
		const db = getDb();
		const now = Date.now();

		const stmt = db.prepare(`
            INSERT INTO csv_uploads
            (csv_upload_id, user_id, list_name, original_filename, file_path, file_size,
             has_header, headers, preview_data, row_count, column_count, upload_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

		stmt.run(
			csvUploadId,
			user_id,
			listName,
			originalFilename,
			filePath,
			req.file.size,
			hasHeader ? 1 : 0,
			JSON.stringify(headers),
			JSON.stringify(preview),
			dataRowCount,
			columnCount,
			'uploaded',
			now,
			now
		);

		return res.json({
			success: true,
			data: {
				csv_upload_id: csvUploadId,
				original_filename: originalFilename,
				has_header: hasHeader,
				preview: preview,
				headers: headers,
				row_count: dataRowCount,
				column_count: columnCount,
				file_size: req.file.size,
				upload_status: 'uploaded',
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('CSV upload error:', errorMessage);

		// Clean up uploaded file on error
		if (req.file && req.file.path && fs.existsSync(req.file.path)) {
			fs.unlinkSync(req.file.path);
		}

		return res.status(400).json({
			success: false,
			message: errorMessage || 'CSV upload failed',
		});
	} finally {
		console.debug('CSV upload process completed');
	}
}


/**
 * Detect email column in CSV using scoring algorithm
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function detectEmailColumn(req, res) {
	try {
		const { csv_upload_id, list_name, has_header } = req.body;
		const user_id = req.user?.id;

		if (!csv_upload_id) {
			return res.status(400).json({
				success: false,
				message: 'CSV upload ID is required',
			});
		}

		// Get CSV upload from database
		const db = getDb();
		const upload = /** @type {CsvUploadRow | undefined} */ (
			db.prepare('SELECT * FROM csv_uploads WHERE csv_upload_id = ? AND user_id = ?').get(csv_upload_id, user_id)
		);

		if (!upload) {
			return res.status(404).json({
				success: false,
				message: 'CSV upload not found',
			});
		}

		const filePath = upload.file_path;
		// Use hasHeader from request body if provided, otherwise use database value
		const hasHeader = has_header !== undefined ? (has_header === true || has_header === 'true') : (upload.has_header === 1);
		let headers = JSON.parse(upload.headers);

		// If user changed has_header to false, we need to physically modify the CSV file to add generic headers
		const previousHasHeader = upload.has_header === 1;
		const headerChanged = hasHeader !== previousHasHeader;

		if (headerChanged && !hasHeader) {
			// Need to add generic headers to the actual CSV file
			const tempPath = `${filePath}.temp`;
			const writeStream = fs.createWriteStream(tempPath);
			const readStream = fs.createReadStream(filePath);

			// Generate new generic headers based on column count
			headers = headers.map((_, i) => `column${i + 1}`);

			let firstRow = true;
			await new Promise((resolve, reject) => {
				Papa.parse(readStream, {
					header: false,
					step: (results) => {
						const row = /** @type {string[]} */ (results.data);

						if (firstRow) {
							// Add header row at the beginning
							writeStream.write(Papa.unparse([headers]) + '\n');
							firstRow = false;
						}

						// Write the data row
						writeStream.write(Papa.unparse([row]) + '\n');
					},
					complete: () => {
						writeStream.end();
						resolve();
					},
					error: reject,
				});
			});

			// Replace original file
			fs.unlinkSync(filePath);
			fs.renameSync(tempPath, filePath);
		}

		const columnScores = new Map();
		const emailRegex =
			/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
		let totalRows = 0;
		let rowIndex = 0;

		const stream = fs.createReadStream(filePath);

		await new Promise((resolve, reject) => {
			Papa.parse(stream, {
				header: false, // Manual parsing to avoid dot issues
				step: (results) => {
					const row = /** @type {string[]} */ (results.data);

					// Skip header row - file now ALWAYS has headers after potential modification
					if (rowIndex === 0) {
						rowIndex++;
						return;
					}

					totalRows++;

					// Score each column
					row.forEach((value, columnIndex) => {
						const columnName = headers[columnIndex];

						if (!columnScores.has(columnName)) {
							columnScores.set(columnName, 0);
						}

						if (value && emailRegex.test(value.trim())) {
							columnScores.set(columnName, columnScores.get(columnName) + 1);
						}
					});

					rowIndex++;
				},
				complete: resolve,
				error: reject,
			});
		});

		// Find best column
		let bestColumn = null;
		let bestScore = 0;
		let bestColumnIndex = -1;

		for (let i = 0; i < headers.length; i++) {
			const column = headers[i];
			const score = columnScores.get(column) || 0;
			if (score > bestScore) {
				bestScore = score;
				bestColumn = column;
				bestColumnIndex = i;
			}
		}

		const confidence = totalRows > 0 ? (bestScore / totalRows) * 100 : 0;

		// Update database with list_name, has_header, headers, and detection results
		const now = Date.now();
		const updateStmt = db.prepare(`
            UPDATE csv_uploads
            SET list_name = ?,
                has_header = ?,
                headers = ?,
                selected_email_column = ?,
                selected_email_column_index = ?,
                column_scores = ?,
                detection_confidence = ?,
                upload_status = ?,
                updated_at = ?
            WHERE csv_upload_id = ?
        `);

		updateStmt.run(
			list_name || null,
			1, // After modification, CSV always has headers now (either original or generic)
			JSON.stringify(headers),
			bestColumn,
			bestColumnIndex,
			JSON.stringify(Object.fromEntries(columnScores)),
			confidence,
			'ready',
			now,
			csv_upload_id
		);

		return res.json({
			success: true,
			data: {
				csv_upload_id: csv_upload_id,
				detected_column: bestColumn,
				detected_column_index: bestColumnIndex,
				confidence: parseFloat(confidence.toFixed(2)),
				column_scores: Object.fromEntries(columnScores),
				upload_status: 'ready',
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Email detection error:', errorMessage);

		return res.status(500).json({
			success: false,
			message: 'Email detection failed',
		});
	} finally {
		console.debug('Email detection process completed');
	}
}


/**
 * Extract emails and submit for verification
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function submitCSVVerification(req, res) {
	try {
		const { csv_upload_id, email_column_index } = req.body;
		const user_id = req.user?.id;

		if (!csv_upload_id || email_column_index === undefined) {
			return res.status(400).json({
				success: false,
				message: 'CSV upload ID and email column index are required',
			});
		}

		// Get CSV upload from database
		const db = getDb();
		const upload = /** @type {CsvUploadRow | undefined} */ (
			db.prepare('SELECT * FROM csv_uploads WHERE csv_upload_id = ? AND user_id = ?').get(csv_upload_id, user_id)
		);

		if (!upload) {
			return res.status(404).json({
				success: false,
				message: 'CSV upload not found',
			});
		}

		const filePath = upload.file_path;
		const hasHeader = upload.has_header === 1;
		const headers = JSON.parse(upload.headers);
		const selectedColumn = headers[email_column_index];

		// Update selected column in database (user might have changed it from auto-detected)
		const columnUpdateTime = Date.now();
		const updateColumnStmt = db.prepare(`
            UPDATE csv_uploads
            SET selected_email_column = ?,
                selected_email_column_index = ?,
                updated_at = ?
            WHERE csv_upload_id = ?
        `);

		updateColumnStmt.run(selectedColumn, email_column_index, columnUpdateTime, csv_upload_id);

		const stream = fs.createReadStream(filePath);

		let rowIndex = 0;
		/** @type {string[]} */
		const emails = [];

		// Stream parse and extract emails
		await new Promise((resolve, reject) => {
			Papa.parse(stream, {
				header: false, // Manual parsing to avoid dot issues
				step: (results) => {
					const row = /** @type {string[]} */ (results.data);

					// Skip header row if hasHeader is true
					if (rowIndex === 0 && hasHeader) {
						rowIndex++;
						return;
					}

					// Extract email from selected column
					const email = row[email_column_index];

					if (email && email.trim()) {
						emails.push(email.trim());
					}

					rowIndex++;
				},
				complete: resolve,
				error: reject,
			});
		});

		// Generate verification request ID
		const verification_request_id = `csv-${uuidv4()}`;

		// Create verification request
		const createResult = await createVerificationRequest({
			verification_request_id,
			user_id,
			request_type: 'csv',
			emails: emails,
		});

		if (!createResult.success) {
			return res.status(500).json({
				success: false,
				message: 'Failed to create verification request',
			});
		}

		// Link CSV upload to verification request
		const linkUpdateTime = Date.now();
		const linkStmt = db.prepare(`
            UPDATE csv_uploads
            SET verification_request_id = ?,
                upload_status = ?,
                updated_at = ?
            WHERE csv_upload_id = ?
        `);

		linkStmt.run(verification_request_id, 'submitted', linkUpdateTime, csv_upload_id);

		// Add to verification queue
		const queueResult = await queue.add({
			request_id: verification_request_id,
			emails: emails,
			response_url: '', // Empty - we'll poll for results
		});

		if (!queueResult.success) {
			return res.status(500).json({
				success: false,
				message: 'Failed to add request to verification queue',
			});
		}

		// Update status to processing
		await updateVerificationStatus(verification_request_id, 'processing');

		return res.json({
			success: true,
			message: 'CSV verification started',
			data: {
				csv_upload_id: csv_upload_id,
				verification_request_id: verification_request_id,
				upload_status: 'submitted',
				verification_status: 'processing',
				total_emails: emails.length,
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('CSV verification submission error:', errorMessage);

		return res.status(500).json({
			success: false,
			message: 'CSV verification submission failed',
		});
	} finally {
		console.debug('CSV verification submission process completed');
	}
}


/**
 * Download CSV with verification results
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function downloadCSVResults(req, res) {
	try {
		const { csv_upload_id } = req.params;
		const user_id = req.user?.id;

		if (!csv_upload_id) {
			return res.status(400).json({
				success: false,
				message: 'CSV upload ID is required',
			});
		}

		// Get CSV upload and verification request
		const db = getDb();
		const upload = /** @type {CsvUploadRow | undefined} */ (
			db
				.prepare(
					`
            SELECT c.*, v.results
            FROM csv_uploads c
            LEFT JOIN verification_requests v ON c.verification_request_id = v.verification_request_id
            WHERE c.csv_upload_id = ? AND c.user_id = ?
        `
				)
				.get(csv_upload_id, user_id)
		);

		if (!upload) {
			return res.status(404).json({
				success: false,
				message: 'CSV upload not found',
			});
		}

		if (!upload.verification_request_id) {
			return res.status(400).json({
				success: false,
				message: 'CSV has not been submitted for verification',
			});
		}

		// Parse results
		const resultsArray = upload.results ? JSON.parse(upload.results) : [];

		if (resultsArray.length === 0) {
			return res.status(400).json({
				success: false,
				message: 'Verification not yet completed or no results available',
			});
		}

		// Create email → result Map for O(1) lookup
		const resultsMap = new Map(resultsArray.map(r => [r.email, r]));

		const hasHeader = upload.has_header === 1;
		const emailColumnIndex = upload.selected_email_column_index;

		// Check if results have already been added to the CSV
		const headers = JSON.parse(upload.headers);
		const hasStatusColumns = headers.includes('status') && headers.includes('status_reason');

		// If status columns already exist, just download the file
		if (hasStatusColumns) {
			const downloadFilename = upload.list_name
				? `${upload.list_name}.csv`
				: upload.original_filename;

			res.setHeader('Content-Type', 'text/csv');
			res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);

			const fileStream = fs.createReadStream(upload.file_path);
			fileStream.pipe(res);
			return;
		}

		// Otherwise, modify the original CSV file to add status columns
		const tempPath = `${upload.file_path}.temp`;
		const writeStream = fs.createWriteStream(tempPath);
		const readStream = fs.createReadStream(upload.file_path);

		let rowIndex = 0;

		// Stream original CSV and append status columns
		await new Promise((resolve, reject) => {
			Papa.parse(readStream, {
				header: false, // Manual parsing
				step: (results) => {
					const row = /** @type {string[]} */ (results.data);

					if (rowIndex === 0 && hasHeader) {
						// First row is header - append status column headers
						row.push('status', 'status_reason');
					} else {
						// Data row - get email from selected column
						const email = row[emailColumnIndex];

						// Lookup result for this email
						const result = resultsMap.get(email) || {
							status: '',
							message: '',
						};

						// Append status columns
						row.push(result.status, result.message);
					}

					// Write row to output CSV
					writeStream.write(Papa.unparse([row]) + '\n');
					rowIndex++;
				},
				complete: () => {
					writeStream.end();
					resolve();
				},
				error: reject,
			});
		});

		// Replace original file with modified file
		fs.unlinkSync(upload.file_path);
		fs.renameSync(tempPath, upload.file_path);

		// Update headers in database
		headers.push('status', 'status_reason');
		const updateHeadersStmt = db.prepare(`
			UPDATE csv_uploads
			SET headers = ?, updated_at = ?
			WHERE csv_upload_id = ?
		`);
		updateHeadersStmt.run(JSON.stringify(headers), Date.now(), csv_upload_id);

		// Download response - use list_name if available, otherwise original_filename
		const downloadFilename = upload.list_name
			? `${upload.list_name}.csv`
			: upload.original_filename;

		res.setHeader('Content-Type', 'text/csv');
		res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);

		const fileStream = fs.createReadStream(upload.file_path);
		fileStream.pipe(res);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('CSV download error:', errorMessage);

		return res.status(500).json({
			success: false,
			message: 'CSV download failed',
		});
	} finally {
		console.debug('CSV download process completed');
	}
}


// Export functions and multer upload middleware
module.exports = {
	upload,
	uploadCSV,
	detectEmailColumn,
	submitCSVVerification,
	downloadCSVResults,
};
