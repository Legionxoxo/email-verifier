/**
 * Bulk Email Verifier Component
 * Allows users to upload CSV files for bulk email verification
 */

import { useState, useRef } from 'react';
import { Download, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { parseEmailCSV, validateCSVFile } from '../../lib/csvParser';


// Interface for component props
interface BulkVerifierProps {
    onUpload?: (emails: string[]) => Promise<void>;
    maxFileSizeMB?: number;
    maxRows?: number;
}


/**
 * Bulk Email Verifier Component
 * @param props - Component props
 * @returns JSX element
 */
export function BulkVerifier({ onUpload, maxFileSizeMB = 100, maxRows = 50000 }: BulkVerifierProps) {
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [emailCount, setEmailCount] = useState<number>(0);
    const [error, setError] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);


    /**
     * Handle file selection
     */
    const handleFileSelect = async (file: File) => {
        try {
            console.log('=== BULK CSV UPLOAD STARTED ===');
            console.log('File selected:', file.name);
            console.log('File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
            console.log('File type:', file.type);

            setIsProcessing(true);
            setError(''); // Clear previous errors

            // Validate file
            console.log('Validating file...');
            const validation = validateCSVFile(file, maxFileSizeMB);
            console.log('Validation result:', validation);

            if (!validation.valid) {
                const errorMsg = validation.error || 'Invalid file';
                setError(errorMsg);
                return;
            }

            // Parse CSV
            console.log('Parsing CSV file...');
            const result = await parseEmailCSV(file);
            console.log('Parse result:', {
                totalCount: result.totalCount,
                duplicateCount: result.duplicateCount,
                errorsCount: result.errors.length,
                previewCount: result.preview.length
            });
            console.log('First 10 emails preview:', result.preview);
            console.log('All parsed emails:', result.emails);

            // Check row limit
            if (result.totalCount > maxRows) {
                console.log('Row limit exceeded:', result.totalCount, '>', maxRows);
                const errorMsg = `File contains ${result.totalCount} emails. Maximum allowed is ${maxRows.toLocaleString()}.`;
                setError(errorMsg);
                return;
            }

            // Check if no valid emails found
            if (result.totalCount === 0) {
                setError('No valid emails found in CSV file');
                return;
            }

            // Set file and email count
            setSelectedFile(file);
            setEmailCount(result.totalCount);

            // Show success toast
            toast.success(`Successfully loaded ${result.totalCount} email(s) from CSV`);

            // Show warnings in toast if any
            if (result.errors.length > 0) {
                console.log('Parsing errors:', result.errors);
                toast.warning(`Found ${result.errors.length} invalid email(s) in CSV`);
            }

            if (result.duplicateCount > 0) {
                console.log('Duplicates removed:', result.duplicateCount);
                toast.info(`Removed ${result.duplicateCount} duplicate email(s)`);
            }

            // Call upload handler if provided
            if (onUpload) {
                console.log('Calling onUpload callback with emails array (length:', result.emails.length, ')');
                await onUpload(result.emails);
                console.log('onUpload callback completed');
            } else {
                console.log('No onUpload callback provided');
            }

            console.log('=== BULK CSV UPLOAD COMPLETED ===');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to process file';
            console.error('File processing error:', error);
            setError(errorMessage);
            setSelectedFile(null);
            setEmailCount(0);
        } finally {
            setIsProcessing(false);
            console.debug('File processing completed');
        }
    };


    /**
     * Handle drag over
     */
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        try {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
        } catch (error) {
            console.error('Drag over error:', error);
        } finally {
            console.debug('Drag over handled');
        }
    };


    /**
     * Handle drag leave
     */
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        try {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
        } catch (error) {
            console.error('Drag leave error:', error);
        } finally {
            console.debug('Drag leave handled');
        }
    };


    /**
     * Handle file drop
     */
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        try {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }

        } catch (error) {
            console.error('Drop error:', error);
            toast.error('Failed to process dropped file');
        } finally {
            console.debug('Drop handled');
        }
    };


    /**
     * Handle file input change
     */
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const files = e.target.files;
            if (files && files.length > 0) {
                handleFileSelect(files[0]);
            }
        } catch (error) {
            console.error('File input change error:', error);
            toast.error('Failed to process selected file');
        } finally {
            console.debug('File input change handled');
        }
    };


    /**
     * Open file picker
     */
    const openFilePicker = () => {
        try {
            fileInputRef.current?.click();
        } catch (error) {
            console.error('File picker error:', error);
        } finally {
            console.debug('File picker opened');
        }
    };


    /**
     * Clear selected file
     */
    const clearFile = () => {
        try {
            setSelectedFile(null);
            setEmailCount(0);
            setError(''); // Clear error
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            console.error('Clear file error:', error);
        } finally {
            console.debug('File cleared');
        }
    };


    return (
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Heading */}
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-center text-[#2F327D] mb-6">
                Or make a <span className="text-[#4169E1]">bulk</span> email verification
            </h2>

            {/* Upload Card - Smaller Square */}
            <div
                className={`relative bg-[#EFF6FF] rounded-2xl p-6
                           aspect-square max-w-xs mx-auto
                           border-2 border-dashed transition-all duration-300 cursor-pointer
                           ${error ? 'border-red-400 bg-red-50' : isDragging ? 'border-[#4169E1] bg-blue-100 scale-[1.01]' : 'border-[#BFDBFE] hover:border-[#93C5FD]'}
                           ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={!isProcessing ? openFilePicker : undefined}
            >
                {/* Hidden File Input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,application/vnd.ms-excel"
                    onChange={handleFileInputChange}
                    className="hidden"
                    disabled={isProcessing}
                />

                {/* Content - Compact */}
                <div className="flex flex-col items-center justify-center text-center space-y-2 h-full">
                    {/* Show Error State */}
                    {error ? (
                        <div className="space-y-2 px-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                                <X className="w-6 h-6 text-red-500" strokeWidth={2.5} />
                            </div>
                            <p className="text-sm font-semibold text-red-600">Upload Failed</p>
                            <p className="text-xs text-red-500 break-words">{error}</p>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setError('');
                                    openFilePicker();
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Download Icon */}
                            <div className={`w-12 h-12 rounded-full bg-[#93C5FD] flex items-center justify-center
                                           transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
                                <Download className="w-6 h-6 text-white" strokeWidth={2.5} />
                            </div>

                            {/* Import Text */}
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-gray-600">
                                    {isProcessing ? 'Processing...' : 'Import'}
                                </h3>

                                {selectedFile ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-center gap-2 text-gray-700">
                                            <span className="font-medium text-xs truncate max-w-[150px]">{selectedFile.name}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    clearFile();
                                                }}
                                                className="p-1.5 hover:bg-red-100 rounded-full transition-colors group flex-shrink-0"
                                                aria-label="Remove file"
                                                title="Remove file"
                                            >
                                                <X className="w-4 h-4 text-red-500 group-hover:text-red-600" strokeWidth={2.5} />
                                            </button>
                                        </div>
                                        <p className="text-green-600 font-medium text-xs">
                                            {emailCount.toLocaleString()} emails
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-1">
                                            Click to replace
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-xs">
                                        {isDragging ? 'Drop CSV here' : 'Select CSV file'}
                                    </p>
                                )}
                            </div>

                            {/* File Info */}
                            <p className="text-[10px] text-gray-400 font-medium mt-1">
                                Max {maxRows.toLocaleString()} rows ({maxFileSizeMB}MB)
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
