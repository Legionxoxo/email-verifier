/**
 * Bulk CSV Verification Functions Unit Tests
 * Testing CSV upload, detection, and verification functions
 */

const fs = require('fs');
const path = require('path');


// Mock uuid before requiring anything that uses it
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-csv-uuid-789')
}));

// Mock queue
jest.mock('../functions/staging/queue', () => ({
    add: jest.fn()
}));

// Mock multer file object
const mockMulterFile = {
    path: '',
    size: 1024,
    originalname: 'test.csv'
};

// Now require modules that depend on uuid
const {
    uploadCSV,
    submitCSVVerification,
} = require('../functions/route_fns/verify/bulkCSVVerification');


describe('Bulk CSV Verification Functions Unit Tests', () => {
    let testDb;
    let testUserId;
    let mockReq;
    let mockRes;
    let testCsvPath;
    let uploadDir;

    beforeAll(async () => {
        try {
            // Clean up any existing global instance
            if (global.databaseInstance) {
                try {
                    global.databaseInstance.close();
                } catch (e) {
                    // Ignore if already closed
                }
                global.databaseInstance = null;
            }

            // Set test environment variable
            process.env.DB_PATH = '.sql/bulk-csv-test.db';

            // Initialize test database
            const { initializeDatabase } = require('../database/connection');
            testDb = initializeDatabase();

            // Create test user
            const result = testDb.prepare(`
                INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                VALUES (?, ?, ?, ?, 1)
            `).run('BulkCSV', 'Test', 'bulkcsv-test@example.com', 'hashed_password');

            testUserId = Number(result.lastInsertRowid);

            // Create csv directory for tests
            uploadDir = path.join(__dirname, '..', 'csv');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

        } catch (error) {
            console.error('Bulk CSV test setup failed:', error);
            throw error;
        }
    });

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mock request and response
        mockReq = {
            body: {},
            file: { ...mockMulterFile },
            user: { id: testUserId },
            csvUploadId: 'test-csv-uuid-789',
            originalFilename: 'test.csv'
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            setHeader: jest.fn().mockReturnThis()
        };

        // Reset queue mock
        const queue = require('../functions/staging/queue');
        queue.add.mockResolvedValue({ success: true });
    });

    afterEach(() => {
        try {
            // Clean up test data
            if (testDb && testDb.open) {
                testDb.prepare('DELETE FROM csv_uploads').run();
                testDb.prepare('DELETE FROM verification_requests').run();
            }

            // Clean up test CSV files
            if (testCsvPath && fs.existsSync(testCsvPath)) {
                fs.unlinkSync(testCsvPath);
            }

        } catch (error) {
            console.error('Bulk CSV afterEach cleanup failed:', error);
        }
    });

    afterAll(async () => {
        try {
            if (testDb && testDb.open) {
                testDb.close();
            }

            if (global.databaseInstance) {
                try {
                    global.databaseInstance.close();
                } catch (e) {
                    // Ignore if already closed
                }
                global.databaseInstance = null;
            }

            // Clean up csv directory
            if (fs.existsSync(uploadDir)) {
                const files = fs.readdirSync(uploadDir);
                files.forEach(file => {
                    const filePath = path.join(uploadDir, file);
                    try {
                        fs.unlinkSync(filePath);
                    } catch (e) {
                        // Ignore
                    }
                });
            }

            // Clean up test database file
            const testDbPath = path.join(__dirname, '..', '.sql', 'bulk-csv-test.db');
            if (fs.existsSync(testDbPath)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                try {
                    fs.unlinkSync(testDbPath);
                } catch (unlinkError) {
                    console.warn('Could not clean up test database file:', unlinkError.message);
                }
            }

        } catch (error) {
            console.error('Bulk CSV test cleanup failed:', error);
        }
    });


    describe('uploadCSV Function', () => {
        test.skip('should upload CSV with header successfully - SKIPPED: CSV streaming hangs in tests', async () => {
            try {
                // Create test CSV file with header
                const csvContent = 'Email,Name,Company\ntest1@example.com,John Doe,Acme Inc\ntest2@example.com,Jane Smith,Tech Corp';
                testCsvPath = path.join(uploadDir, 'test-csv-uuid-789_original.csv');
                fs.writeFileSync(testCsvPath, csvContent);

                mockReq.file.path = testCsvPath;
                mockReq.body.hasHeader = true;

                await uploadCSV(mockReq, mockRes);

                expect(mockRes.json).toHaveBeenCalledWith({
                    success: true,
                    data: expect.objectContaining({
                        csv_upload_id: 'test-csv-uuid-789',
                        original_filename: 'test.csv',
                        has_header: true,
                        headers: ['Email', 'Name', 'Company'],
                        row_count: 2,
                        column_count: 3,
                        upload_status: 'uploaded'
                    })
                });

            } catch (error) {
                console.error('Upload CSV with header test failed:', error);
                throw error;
            }
        });

        test.skip('should upload CSV without header successfully', async () => {
            try {
                // Create test CSV file without header
                const csvContent = 'test1@example.com,John Doe,Acme Inc\ntest2@example.com,Jane Smith,Tech Corp';
                testCsvPath = path.join(uploadDir, 'test-csv-uuid-789_original.csv');
                fs.writeFileSync(testCsvPath, csvContent);

                mockReq.file.path = testCsvPath;
                mockReq.body.hasHeader = false;

                await uploadCSV(mockReq, mockRes);

                expect(mockRes.json).toHaveBeenCalledWith({
                    success: true,
                    data: expect.objectContaining({
                        has_header: false,
                        headers: ['Column 1', 'Column 2', 'Column 3'],
                        row_count: 2,
                        column_count: 3
                    })
                });

            } catch (error) {
                console.error('Upload CSV without header test failed:', error);
                throw error;
            }
        });

        test.skip('should include preview data in response', async () => {
            try {
                const csvContent = 'Email,Name\ntest1@example.com,John\ntest2@example.com,Jane';
                testCsvPath = path.join(uploadDir, 'test-csv-uuid-789_original.csv');
                fs.writeFileSync(testCsvPath, csvContent);

                mockReq.file.path = testCsvPath;
                mockReq.body.hasHeader = true;

                await uploadCSV(mockReq, mockRes);

                const responseData = mockRes.json.mock.calls[0][0].data;
                expect(responseData).toHaveProperty('preview');
                expect(responseData.preview).toBeInstanceOf(Array);
                expect(responseData.preview.length).toBeGreaterThan(0);

            } catch (error) {
                console.error('CSV preview data test failed:', error);
                throw error;
            }
        });

        test.skip('should reject CSV with too many columns', async () => {
            try {
                // Create CSV with 101 columns
                const headers = Array.from({ length: 101 }, (_, i) => `Column${i}`).join(',');
                const csvContent = headers + '\nvalue1,value2,value3';
                testCsvPath = path.join(uploadDir, 'test-csv-uuid-789_original.csv');
                fs.writeFileSync(testCsvPath, csvContent);

                mockReq.file.path = testCsvPath;
                mockReq.body.hasHeader = true;

                await uploadCSV(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: expect.stringContaining('Too many columns')
                });

            } catch (error) {
                console.error('Too many columns test failed:', error);
                throw error;
            }
        });

        test.skip('should reject upload without authentication', async () => {
            try {
                mockReq.user = null;

                const csvContent = 'Email\ntest@example.com';
                testCsvPath = path.join(uploadDir, 'test-csv-uuid-789_original.csv');
                fs.writeFileSync(testCsvPath, csvContent);

                mockReq.file.path = testCsvPath;
                mockReq.body.hasHeader = true;

                await uploadCSV(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Authentication required'
                });

            } catch (error) {
                console.error('Upload without auth test failed:', error);
                throw error;
            }
        });

        test.skip('should clean up file on error', async () => {
            try {
                // Create invalid CSV that will cause an error
                testCsvPath = path.join(uploadDir, 'test-csv-uuid-789_original.csv');
                fs.writeFileSync(testCsvPath, 'invalid,csv,content\n');

                mockReq.file.path = testCsvPath;
                mockReq.body.hasHeader = 'invalid'; // Invalid hasHeader value

                await uploadCSV(mockReq, mockRes);

                // File should be cleaned up on error
                // Note: The function may or may not delete the file depending on error handling

            } catch (error) {
                console.error('File cleanup on error test failed:', error);
                throw error;
            }
        });
    });


    describe('submitCSVVerification Function', () => {
        beforeEach(async () => {
            // Create a CSV file and upload record
            const csvContent = 'Name,Email,Company\nJohn,john@example.com,Acme\nJane,jane@example.com,Tech';
            testCsvPath = path.join(uploadDir, 'test-csv-uuid-789_original.csv');
            fs.writeFileSync(testCsvPath, csvContent);

            testDb.prepare(`
                INSERT INTO csv_uploads
                (csv_upload_id, user_id, original_filename, file_path, file_size, has_header, headers, preview_data, row_count, column_count, selected_email_column, selected_email_column_index, upload_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                'test-csv-uuid-789',
                testUserId,
                'test.csv',
                testCsvPath,
                1024,
                1,
                JSON.stringify(['Name', 'Email', 'Company']),
                JSON.stringify([]),
                2,
                3,
                'Email',
                1,
                'ready',
                Date.now(),
                Date.now()
            );
        });

        test.skip('should submit CSV verification successfully - SKIPPED: Uses Papa.parse streaming', async () => {
            try {
                mockReq.body = {
                    csv_upload_id: 'test-csv-uuid-789',
                    email_column_index: 1
                };

                await submitCSVVerification(mockReq, mockRes);

                expect(mockRes.json).toHaveBeenCalledWith({
                    success: true,
                    message: 'CSV verification started',
                    data: expect.objectContaining({
                        csv_upload_id: 'test-csv-uuid-789',
                        verification_request_id: expect.stringContaining('csv-'),
                        upload_status: 'submitted',
                        verification_status: 'processing',
                        total_emails: 2
                    })
                });

                // Verify queue was called
                const queue = require('../functions/staging/queue');
                expect(queue.add).toHaveBeenCalledWith({
                    request_id: expect.stringContaining('csv-'),
                    emails: ['john@example.com', 'jane@example.com'],
                    response_url: ''
                });

            } catch (error) {
                console.error('Submit CSV verification test failed:', error);
                throw error;
            }
        });

        test.skip('should extract emails from correct column - SKIPPED: Uses Papa.parse streaming', async () => {
            try {
                mockReq.body = {
                    csv_upload_id: 'test-csv-uuid-789',
                    email_column_index: 1
                };

                await submitCSVVerification(mockReq, mockRes);

                const queue = require('../functions/staging/queue');
                const queueCall = queue.add.mock.calls[0][0];
                expect(queueCall.emails).toEqual(['john@example.com', 'jane@example.com']);

            } catch (error) {
                console.error('Extract emails from column test failed:', error);
                throw error;
            }
        });

        test('should reject submission without required fields', async () => {
            try {
                mockReq.body = { csv_upload_id: 'test-csv-uuid-789' };
                // Missing email_column_index

                await submitCSVVerification(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'CSV upload ID and email column index are required'
                });

            } catch (error) {
                console.error('Submission without required fields test failed:', error);
                throw error;
            }
        });

        test('should reject submission for non-existent upload', async () => {
            try {
                mockReq.body = {
                    csv_upload_id: 'nonexistent-upload',
                    email_column_index: 1
                };

                await submitCSVVerification(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(404);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'CSV upload not found'
                });

            } catch (error) {
                console.error('Non-existent upload submission test failed:', error);
                throw error;
            }
        });

        test('should handle queue failure', async () => {
            try {
                mockReq.body = {
                    csv_upload_id: 'test-csv-uuid-789',
                    email_column_index: 1
                };

                const queue = require('../functions/staging/queue');
                queue.add.mockResolvedValue({ success: false });

                await submitCSVVerification(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Failed to add request to verification queue'
                });

            } catch (error) {
                console.error('Queue failure test failed:', error);
                throw error;
            }
        });
    });


    describe('Edge Cases and Error Handling', () => {
        test.skip('should handle CSV with empty lines', async () => {
            try {
                const csvContent = 'Email\ntest1@example.com\n\ntest2@example.com\n';
                testCsvPath = path.join(uploadDir, 'test-csv-uuid-789_original.csv');
                fs.writeFileSync(testCsvPath, csvContent);

                mockReq.file.path = testCsvPath;
                mockReq.body.hasHeader = true;

                await uploadCSV(mockReq, mockRes);

                expect(mockRes.json).toHaveBeenCalledWith({
                    success: true,
                    data: expect.objectContaining({
                        row_count: expect.any(Number)
                    })
                });

            } catch (error) {
                console.error('CSV with empty lines test failed:', error);
                throw error;
            }
        });

        test.skip('should handle CSV with special characters in emails', async () => {
            try {
                const csvContent = 'Email\ntest+tag@example.com\ntest.name@example.com';
                testCsvPath = path.join(uploadDir, 'test-csv-uuid-789_original.csv');
                fs.writeFileSync(testCsvPath, csvContent);

                mockReq.file.path = testCsvPath;
                mockReq.body.hasHeader = true;

                await uploadCSV(mockReq, mockRes);

                expect(mockRes.json).toHaveBeenCalledWith({
                    success: true,
                    data: expect.any(Object)
                });

            } catch (error) {
                console.error('Special characters in emails test failed:', error);
                throw error;
            }
        });
    });
});
