/**
 * CSV Parsing Safety Tests
 * Tests header sanitization, cell value handling, and malformed CSV detection
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// ============================================================
// Copy functions from bulkCSVVerification.js for testing
// ============================================================

function sanitizeHeader(header) {
	if (!header || typeof header !== 'string') {
		return 'unnamed_column';
	}

	let sanitized = header
		.trim()
		.replace(/\./g, '_')
		.replace(/\[/g, '_')
		.replace(/\]/g, '_')
		.replace(/[^\w\s-]/g, '_')
		.replace(/\s+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+/g, '');

	if (/^\d/.test(sanitized)) {
		sanitized = 'col_' + sanitized;
	}

	if (!sanitized) {
		return 'unnamed_column';
	}

	return sanitized;
}

function validateParseResults(results, rowIndex) {
	if (results.errors && results.errors.length > 0) {
		const error = results.errors[0];
		throw new Error(`CSV parsing error at row ${rowIndex}: ${error.message || 'Unknown error'}`);
	}

	if (results.meta && results.meta.aborted) {
		throw new Error(`CSV parsing was aborted at row ${rowIndex}`);
	}
}


// ============================================================
// Test Suites
// ============================================================

describe('CSV Parsing Safety Tests', () => {

	describe('Header Sanitization', () => {
		test('should sanitize dots in headers', () => {
			expect(sanitizeHeader('user.email')).toBe('user_email');
			expect(sanitizeHeader('data.user.name')).toBe('data_user_name');
			expect(sanitizeHeader('.hidden')).toBe('hidden');
		});

		test('should sanitize brackets in headers', () => {
			expect(sanitizeHeader('data[0]')).toBe('data_0_');
			expect(sanitizeHeader('array[index]')).toBe('array_index_');
		});

		test('should sanitize special characters', () => {
			expect(sanitizeHeader('First Name!')).toBe('First_Name_');
			expect(sanitizeHeader('col@special')).toBe('col_special');
			expect(sanitizeHeader('user:role')).toBe('user_role');
		});

		test('should handle headers starting with numbers', () => {
			expect(sanitizeHeader('123column')).toBe('col_123column');
			expect(sanitizeHeader('99bottles')).toBe('col_99bottles');
		});

		test('should replace spaces with underscores', () => {
			expect(sanitizeHeader('First Name')).toBe('First_Name');
			expect(sanitizeHeader('email address')).toBe('email_address');
		});

		test('should remove consecutive underscores', () => {
			expect(sanitizeHeader('user___email')).toBe('user_email');
			expect(sanitizeHeader('data__value')).toBe('data_value');
		});

		test('should handle empty or invalid headers', () => {
			expect(sanitizeHeader('')).toBe('unnamed_column');
			expect(sanitizeHeader(null)).toBe('unnamed_column');
			expect(sanitizeHeader(undefined)).toBe('unnamed_column');
			expect(sanitizeHeader('!!!')).toBe('unnamed_column');
		});
	});


	describe('Edge Case CSV Files', () => {
		test('should parse CSV with problematic headers', (done) => {
			const filePath = path.join(__dirname, 'fixtures', 'test-edge-cases.csv');
			const stream = fs.createReadStream(filePath);

			let headers = [];
			let rows = [];
			let rowIndex = 0;

			Papa.parse(stream, {
				header: false,
				skipEmptyLines: true,
				step: (results) => {
					try {
						validateParseResults(results, rowIndex);
						const row = results.data;

						if (rowIndex === 0) {
							// Sanitize headers
							headers = row.map(h => sanitizeHeader(h));
							console.log('Original headers:', row);
							console.log('Sanitized headers:', headers);
						} else {
							const rowObj = {};
							headers.forEach((h, i) => {
								rowObj[h] = row[i] || '';
							});
							rows.push(rowObj);
						}

						rowIndex++;
					} catch (error) {
						done(error);
					}
				},
				complete: () => {
					try {
						// Verify headers are sanitized
						expect(headers).toContain('user_email');
						expect(headers).toContain('user_name');
						expect(headers).toContain('data_0_');
						expect(headers).toContain('col_123column');
						expect(headers).toContain('First_Name_');

						// Verify we can access object properties without errors
						expect(rows.length).toBeGreaterThan(0);
						expect(rows[0].user_email).toBe('test@example.com');
						expect(rows[0].user_name).toBe('John Smith');

						// Verify comma in cell value is preserved
						expect(rows[0].data_0_).toBe('Value with, comma');

						// Verify newline in cell value is preserved
						expect(rows[1].user_name).toContain('\n');
						expect(rows[1].data_0_).toContain('\n');

						// Verify escaped quotes are handled
						expect(rows[2].user_name).toBe('Bob "The Builder" Johnson');

						console.log('✅ All edge cases parsed correctly!');
						console.log('Sample row:', JSON.stringify(rows[0], null, 2));

						done();
					} catch (error) {
						done(error);
					}
				},
				error: (error) => {
					done(new Error(`Parse error: ${error.message}`));
				}
			});
		});


		test('should parse CSV with special character headers', (done) => {
			const filePath = path.join(__dirname, 'fixtures', 'test-special-headers.csv');
			const stream = fs.createReadStream(filePath);

			let headers = [];
			let rows = [];
			let rowIndex = 0;

			Papa.parse(stream, {
				header: false,
				skipEmptyLines: true,
				step: (results) => {
					const row = results.data;

					if (rowIndex === 0) {
						headers = row.map(h => sanitizeHeader(h));
						console.log('Special headers sanitized:', headers);
					} else {
						const rowObj = {};
						headers.forEach((h, i) => {
							rowObj[h] = row[i] || '';
						});
						rows.push(rowObj);
					}

					rowIndex++;
				},
				complete: () => {
					try {
						// All headers should be sanitized
						expect(headers).toContain('hidden');
						expect(headers).toContain('col_special');
						expect(headers).toContain('user_role');
						expect(headers).toContain('data-value');
						expect(headers).toContain('email_address');

						// Should be able to access properties
						expect(rows[0].hidden).toBe('value1');
						expect(rows[0].col_special).toBe('value2');
						expect(rows[0].email_address).toBe('test@example.com');

						console.log('✅ Special headers handled correctly!');
						done();
					} catch (error) {
						done(error);
					}
				},
				error: done
			});
		});


		test('should skip empty rows', (done) => {
			const filePath = path.join(__dirname, 'fixtures', 'test-empty-rows.csv');
			const stream = fs.createReadStream(filePath);

			let headers = [];
			let rows = [];
			let rowIndex = 0;

			Papa.parse(stream, {
				header: false,
				skipEmptyLines: true,
				step: (results) => {
					const row = results.data;

					// Skip completely empty rows
					if (!row || row.length === 0 || row.every(cell => !cell || !cell.trim())) {
						return;
					}

					if (rowIndex === 0) {
						headers = row.map(h => sanitizeHeader(h));
					} else {
						const rowObj = {};
						headers.forEach((h, i) => {
							rowObj[h] = row[i] || '';
						});
						rows.push(rowObj);
					}

					rowIndex++;
				},
				complete: () => {
					try {
						// Should only have 2 data rows (empty rows skipped)
						expect(rows.length).toBe(2);
						expect(rows[0].email).toBe('test@example.com');
						expect(rows[1].email).toBe('user@test.com');

						console.log('✅ Empty rows skipped correctly!');
						console.log('Row count:', rows.length);
						done();
					} catch (error) {
						done(error);
					}
				},
				error: done
			});
		});
	});


	describe('Object Key Safety', () => {
		test('should create safe object keys from headers', () => {
			const problematicHeaders = [
				'user.email',
				'data[0]',
				'123column',
				'First Name!',
				'.hidden',
				'col@special'
			];

			const sanitized = problematicHeaders.map(h => sanitizeHeader(h));
			const testObj = {};

			// All sanitized headers should work as object keys without errors
			sanitized.forEach((header, i) => {
				expect(() => {
					testObj[header] = `value${i}`;
				}).not.toThrow();
			});

			// Should be able to access all properties
			sanitized.forEach((header) => {
				expect(testObj[header]).toBeDefined();
			});

			// Should be able to JSON.stringify without errors
			expect(() => {
				JSON.stringify(testObj);
			}).not.toThrow();

			console.log('✅ All object keys are safe!');
			console.log('Test object:', testObj);
		});
	});
});
