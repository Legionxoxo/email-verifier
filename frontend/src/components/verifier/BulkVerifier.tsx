/**
 * Bulk Email Verifier Component
 * Multi-step flow for bulk email verification
 * Step 1: File upload and preview
 * Step 2: Column selection
 */

import { useState, useRef } from 'react';
import { Download, X, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { parseCSVFullData, validateCSVFile, type CSVFullDataResult } from '../../lib/csvParser';
import { BulkVerifierStepOne } from './BulkVerifierStepOne';
import { BulkVerifierStepTwo } from './BulkVerifierStepTwo';
import { Button } from '../ui/Button';


// Interface for component props
interface BulkVerifierProps {
    onUpload?: (emails: string[]) => Promise<void>;
    maxFileSizeMB?: number;
    maxRows?: number;
    onStepChange?: (isUploadStep: boolean) => void;
}


// Step types
type VerifierStep = 'upload' | 'preview' | 'column-select';


/**
 * Bulk Email Verifier Component
 * @param props - Component props
 * @returns JSX element
 */
export function BulkVerifier({ onUpload, maxFileSizeMB = 100, maxRows = 50000, onStepChange }: BulkVerifierProps) {
    const [currentStep, setCurrentStep] = useState<VerifierStep>('upload');


    // Helper to change step and notify parent
    const changeStep = (newStep: VerifierStep) => {
        setCurrentStep(newStep);
        if (onStepChange) {
            onStepChange(newStep === 'upload');
        }
    };
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<CSVFullDataResult | null>(null);
    const [listName, setListName] = useState<string>('');
    const [error, setError] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);


    /**
     * Handle file selection and initial parsing
     */
    const handleFileSelect = async (file: File) => {
        try {
            console.log('=== BULK CSV UPLOAD STARTED ===');
            console.log('File selected:', file.name);
            console.log('File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
            console.log('File type:', file.type);

            setIsProcessing(true);
            setError('');

            // Validate file
            console.log('Validating file...');
            const validation = validateCSVFile(file, maxFileSizeMB);
            console.log('Validation result:', validation);

            if (!validation.valid) {
                const errorMsg = validation.error || 'Invalid file';
                setError(errorMsg);
                toast.error(errorMsg);
                return;
            }

            // Parse CSV for full data
            console.log('Parsing CSV file...');
            const result = await parseCSVFullData(file, true);
            console.log('Parse result:', {
                totalRows: result.totalRows,
                headers: result.headers,
                previewCount: result.preview.length
            });

            // Check row limit
            if (result.totalRows > maxRows) {
                console.log('Row limit exceeded:', result.totalRows, '>', maxRows);
                const errorMsg = `File contains ${result.totalRows} rows. Maximum allowed is ${maxRows.toLocaleString()}.`;
                setError(errorMsg);
                toast.error(errorMsg);
                return;
            }

            // Check if no rows found
            if (result.totalRows === 0) {
                setError('No data found in CSV file');
                toast.error('No data found in CSV file');
                return;
            }

            // Set file and parsed data
            setSelectedFile(file);
            setParsedData(result);
            changeStep('preview');

            console.log('=== BULK CSV UPLOAD COMPLETED ===');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to process file';
            console.error('File processing error:', error);
            setError(errorMessage);
            toast.error(errorMessage);
            setSelectedFile(null);
            setParsedData(null);
        } finally {
            setIsProcessing(false);
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
        }
    };


    /**
     * Open file picker
     */
    const openFilePicker = () => {
        try {
            if (fileInputRef.current) {
                fileInputRef.current.click();
            }
        } catch (error) {
            console.error('File picker error:', error);
        }
    };


    /**
     * Clear selected file and reset to upload step
     */
    const clearFile = () => {
        try {
            setSelectedFile(null);
            setParsedData(null);
            setListName('');
            setError('');
            changeStep('upload');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            console.error('Clear file error:', error);
        }
    };


    /**
     * Handle header checkbox change - re-parse CSV with new setting
     */
    const handleHeaderCheckboxChange = async (header: boolean) => {
        try {
            if (!selectedFile) return;

            setIsProcessing(true);

            // Re-parse with new header setting
            const result = await parseCSVFullData(selectedFile, header);
            setParsedData(result);

            setIsProcessing(false);
        } catch (error) {
            console.error('Header checkbox change error:', error);
            toast.error('Failed to update preview');
            setIsProcessing(false);
        }
    };


    /**
     * Handle step one completion (preview -> column select)
     */
    const handleStepOneNext = async (name: string) => {
        try {
            setListName(name);
            changeStep('column-select');
        } catch (error) {
            console.error('Step one next error:', error);
            toast.error('Failed to proceed to next step');
        }
    };


    /**
     * Handle step two completion (verify emails)
     */
    const handleStepTwoVerify = async (emails: string[], selectedColumn: string) => {
        try {
            console.log('Verifying emails:', {
                listName,
                selectedColumn,
                emailCount: emails.length
            });

            toast.success(`${emails.length} email(s) ready for verification`);

            // Call upload handler if provided
            if (onUpload) {
                console.log('Calling onUpload callback with emails array (length:', emails.length, ')');
                await onUpload(emails);
                console.log('onUpload callback completed');
            } else {
                console.log('No onUpload callback provided');
            }

            // Reset to upload step after successful verification
            clearFile();

        } catch (error) {
            console.error('Verification error:', error);
            toast.error('Failed to verify emails');
        }
    };


    /**
     * Handle back navigation
     */
    const handleBack = () => {
        try {
            if (currentStep === 'column-select') {
                changeStep('preview');
            } else if (currentStep === 'preview') {
                clearFile();
            }
        } catch (error) {
            console.error('Back navigation error:', error);
        }
    };


    /**
     * Render upload step
     */
    const renderUploadStep = () => {
        return (
            <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Heading */}
                <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-center text-[#2F327D] mb-6">
                    Or make a <span className="text-[#4169E1]">bulk</span> email verification
                </h2>

                {/* Upload Card */}
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

                    {/* Content */}
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
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2 cursor-pointer"
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
                                    <p className="text-gray-500 text-xs">
                                        {isDragging ? 'Drop CSV here' : 'Select CSV file'}
                                    </p>
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
    };


    /**
     * Render preview step
     */
    const renderPreviewStep = () => {
        if (!selectedFile || !parsedData) return null;

        return (
            <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Back button - returns to upload step */}
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBack}
                        className="flex items-center space-x-1 cursor-pointer"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Upload</span>
                    </Button>
                </div>

                <BulkVerifierStepOne
                    file={selectedFile}
                    parsedData={parsedData}
                    onNext={handleStepOneNext}
                    onSelectDifferentFile={clearFile}
                    onHeaderCheckboxChange={handleHeaderCheckboxChange}
                    onOpenFilePicker={openFilePicker}
                />
            </div>
        );
    };


    /**
     * Render column select step
     */
    const renderColumnSelectStep = () => {
        if (!parsedData) return null;

        return (
            <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Back button - returns to preview step */}
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBack}
                        className="flex items-center space-x-1 cursor-pointer"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Preview</span>
                    </Button>
                </div>

                <BulkVerifierStepTwo
                    parsedData={parsedData}
                    onVerify={handleStepTwoVerify}
                />
            </div>
        );
    };


    // Render current step
    switch (currentStep) {
        case 'preview':
            return renderPreviewStep();
        case 'column-select':
            return renderColumnSelectStep();
        default:
            return renderUploadStep();
    }
}
