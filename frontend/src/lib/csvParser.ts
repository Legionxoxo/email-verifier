/**
 * CSV Parser Utility
 * Handles parsing CSV files to extract email addresses
 */

import Papa from 'papaparse';


// Interface for parsed email with metadata
interface ParsedEmail {
    email: string;
    row: number;
}


// Interface for CSV parse result
interface CSVParseResult {
    emails: string[];
    errors: string[];
    preview: ParsedEmail[];
    totalCount: number;
    duplicateCount: number;
}


// Interface for full CSV data result
export interface CSVFullDataResult {
    headers: string[];
    rows: Record<string, string>[];
    preview: Record<string, string>[];
    totalRows: number;
    detectedEmailColumn: string | null;
    detectionConfidence?: number;
}


/**
 * Parse CSV file and extract email addresses
 * @param file - CSV file to parse
 * @returns Promise with parsed result
 */
export async function parseEmailCSV(file: File): Promise<CSVParseResult> {
    try {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        const emails: string[] = [];
                        const errors: string[] = [];
                        const preview: ParsedEmail[] = [];
                        const emailSet = new Set<string>();

                        // Try to find email column
                        const headers = results.meta.fields || [];
                        const emailColumn = findEmailColumn(headers);

                        if (!emailColumn) {
                            reject(new Error('No email column found. Expected column named: email, Email, EMAIL, email_address, etc.'));
                            return;
                        }

                        // Extract emails
                        results.data.forEach((row: any, index: number) => {
                            const email = row[emailColumn]?.trim();

                            if (email) {
                                // Basic email validation
                                if (isValidEmailFormat(email)) {
                                    emailSet.add(email.toLowerCase());
                                    emails.push(email.toLowerCase());

                                    // Store first 10 for preview
                                    if (preview.length < 10) {
                                        preview.push({ email: email.toLowerCase(), row: index + 2 }); // +2 for header and 0-index
                                    }
                                } else {
                                    errors.push(`Row ${index + 2}: Invalid email format - ${email}`);
                                }
                            }
                        });

                        const uniqueEmails = Array.from(emailSet);
                        const duplicateCount = emails.length - uniqueEmails.length;

                        resolve({
                            emails: uniqueEmails,
                            errors,
                            preview,
                            totalCount: uniqueEmails.length,
                            duplicateCount
                        });

                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        reject(new Error(`Failed to process CSV data: ${errorMessage}`));
                    } finally {
                        console.debug('CSV parsing process completed');
                    }
                },
                error: (error) => {
                    reject(new Error(`CSV parsing failed: ${error.message}`));
                }
            });
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`CSV parsing error: ${errorMessage}`);
    } finally {
        console.debug('CSV parse function completed');
    }
}


/**
 * Find email column in CSV headers
 * @param headers - Array of column headers
 * @returns Email column name or null
 */
function findEmailColumn(headers: string[]): string | null {
    try {
        const emailPatterns = [
            'email',
            'email_address',
            'emailaddress',
            'e-mail',
            'e_mail',
            'mail',
            'contact',
            'email address',
            'contact_email'
        ];

        const found = headers.find(header =>
            emailPatterns.includes(header.toLowerCase().trim())
        );

        // Fallback to first column if no email column found
        return found || (headers.length > 0 ? headers[0] : null);

    } catch (error) {
        console.error('Error finding email column:', error);
        return null;
    } finally {
        console.debug('Email column search completed');
    }
}


/**
 * Validate email format using regex
 * @param email - Email address to validate
 * @returns True if valid format
 */
function isValidEmailFormat(email: string): boolean {
    try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);

    } catch (error) {
        console.error('Email validation error:', error);
        return false;
    } finally {
        console.debug('Email validation completed');
    }
}


/**
 * Parse CSV file and return full data with headers
 * Used for bulk verifier multi-step flow
 * @param file - CSV file to parse
 * @param hasHeader - Whether the CSV file has a header row
 * @returns Promise with full CSV data
 */
export async function parseCSVFullData(file: File, hasHeader: boolean = true): Promise<CSVFullDataResult> {
    try {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: hasHeader,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        let headers: string[];
                        let rows: Record<string, string>[];

                        if (hasHeader) {
                            // Use actual headers from CSV
                            headers = results.meta.fields || [];
                            rows = results.data as Record<string, string>[];
                        } else {
                            // Generate column headers (Column 1, Column 2, etc.)
                            const firstRow = results.data[0] as any;
                            const columnCount = firstRow ? Object.keys(firstRow).length : 0;

                            headers = Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);

                            // Transform rows to use generated column names
                            rows = (results.data as any[]).map(row => {
                                const transformedRow: Record<string, string> = {};
                                const rowValues = Object.values(row);
                                headers.forEach((header, index) => {
                                    transformedRow[header] = String(rowValues[index] || '');
                                });
                                return transformedRow;
                            });
                        }

                        const preview = rows.slice(0, 5); // First 5 rows for preview
                        const detectedEmailColumn = findEmailColumn(headers);

                        resolve({
                            headers,
                            rows,
                            preview,
                            totalRows: rows.length,
                            detectedEmailColumn
                        });

                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        reject(new Error(`Failed to process CSV data: ${errorMessage}`));
                    }
                },
                error: (error) => {
                    reject(new Error(`CSV parsing failed: ${error.message}`));
                }
            });
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`CSV parsing error: ${errorMessage}`);
    }
}


/**
 * Extract emails from parsed CSV data based on selected column
 * @param rows - Parsed CSV rows
 * @param emailColumn - Column name containing emails
 * @returns Array of unique, valid emails and error count
 */
export function extractEmailsFromColumn(
    rows: Record<string, string>[],
    emailColumn: string
): { emails: string[]; errors: number; duplicateCount: number } {
    try {
        const emailSet = new Set<string>();
        let errors = 0;
        let totalEmails = 0;

        rows.forEach((row) => {
            const email = row[emailColumn]?.trim();

            if (email) {
                totalEmails++;
                if (isValidEmailFormat(email)) {
                    emailSet.add(email.toLowerCase());
                } else {
                    errors++;
                }
            }
        });

        const uniqueEmails = Array.from(emailSet);
        const duplicateCount = totalEmails - uniqueEmails.length;

        return {
            emails: uniqueEmails,
            errors,
            duplicateCount
        };

    } catch (error) {
        console.error('Email extraction error:', error);
        return { emails: [], errors: 0, duplicateCount: 0 };
    }
}


/**
 * Validate file before parsing
 * @param file - File to validate
 * @param maxSizeMB - Maximum file size in MB
 * @returns Validation result
 */
export function validateCSVFile(file: File, maxSizeMB: number = 100): { valid: boolean; error?: string } {
    try {
        // Check file type
        const validTypes = ['.csv', 'text/csv', 'application/vnd.ms-excel'];
        const isValidType = validTypes.some(type =>
            file.type === type || file.name.toLowerCase().endsWith('.csv')
        );

        if (!isValidType) {
            return { valid: false, error: 'Please upload a CSV file' };
        }

        // Check file size
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
        }

        // Check if file is empty
        if (file.size === 0) {
            return { valid: false, error: 'File is empty' };
        }

        return { valid: true };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { valid: false, error: `File validation failed: ${errorMessage}` };
    } finally {
        console.debug('File validation completed');
    }
}
