/**
 * Bulk Email Verifier Component
 * Multi-step flow for bulk email verification
 * Step 1: File upload and preview
 * Step 2: Column selection
 */

import { useState, useRef } from 'react';
import { Download, X, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { parseCSVFullData, validateCSVFile, type CSVFullDataResult } from '../../lib/csvParser';
import { verificationApi } from '../../lib/api';
import { BulkVerifierStepOne } from './BulkVerifierStepOne';
import { Button } from '../ui/Button';


// LocalStorage key for CSV data
const CSV_DATA_KEY = 'bulk_csv_verification_data';


// Interface for component props
interface BulkVerifierProps {
    maxFileSizeMB?: number;
    onStepChange?: (isUploadStep: boolean) => void;
}


// Step types (removed column-select as it's now a separate page)
type VerifierStep = 'upload' | 'preview';


/**
 * Bulk Email Verifier Component
 * @param props - Component props
 * @returns JSX element
 */
export function BulkVerifier({ maxFileSizeMB = 100, onStepChange }: BulkVerifierProps) {
    const navigate = useNavigate();
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
    const [error, setError] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // API-related state
    const [hasHeader, setHasHeader] = useState<boolean>(true);


    /**
     * Handle file selection and local parsing (no backend call yet)
     */
    const handleFileSelect = async (file: File) => {
        try {
            setIsProcessing(true);
            setError('');

            // Validate file locally first
            const validation = validateCSVFile(file, maxFileSizeMB);

            if (!validation.valid) {
                const errorMsg = validation.error || 'Invalid file';
                setError(errorMsg);
                toast.error(errorMsg);
                return;
            }

            // Parse CSV locally for preview only (first 10 rows - lightweight, no memory issues)
            const result = await parseCSVFullData(file, true); // Default to has_header = true

            // Set file and parsed data - move to preview step
            // Full CSV file will be uploaded to backend for validation and processing
            setSelectedFile(file);
            setParsedData(result);
            changeStep('preview');

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
            setError('');
            setHasHeader(true);
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
            setHasHeader(header);

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
     * Handle step one completion (preview -> upload to backend with detection)
     * Uploads CSV file with list_name and has_header, receives detection results
     */
    const handleStepOneNext = async (listName: string) => {
        try {
            if (!selectedFile) {
                throw new Error('No file selected');
            }

            setIsProcessing(true);
            setError(''); // Clear any previous errors

            // Create FormData with file, list_name, and has_header
            const formData = new FormData();
            formData.append('csvFile', selectedFile);
            formData.append('list_name', listName);
            formData.append('has_header', hasHeader.toString());

            // Upload to backend - now includes detection in one call
            const uploadResponse = await verificationApi.uploadCSV(formData);

            // Update parsed data with detection results
            if (parsedData) {
                parsedData.detectedEmailColumn = uploadResponse.detected_column;
                parsedData.detectionConfidence = uploadResponse.confidence;
                setParsedData({ ...parsedData });
            }

            // Store only essential CSV data in localStorage (not the full rows to avoid quota issues)
            // The full CSV is already uploaded to backend via csvUploadId
            const csvDataToStore = {
                csvUploadId: uploadResponse.csv_upload_id,
                parsedData: {
                    headers: parsedData?.headers || [],
                    preview: parsedData?.preview || [],
                    totalRows: parsedData?.totalRows || 0,
                    detectedEmailColumn: uploadResponse.detected_column,
                    detectionConfidence: uploadResponse.confidence,
                    // Explicitly exclude rows array to avoid localStorage quota exceeded error
                    rows: []
                },
                timestamp: Date.now()
            };
            localStorage.setItem(CSV_DATA_KEY, JSON.stringify(csvDataToStore));

            // Navigate to the separate CSV verification page
            navigate('/dashboard/csv');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to upload CSV';
            console.error('CSV upload error:', error);
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };




    /**
     * Handle back navigation (only from preview to upload now)
     */
    const handleBack = () => {
        try {
            if (currentStep === 'preview') {
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
                        ) : isProcessing && selectedFile ? (
                            /* Enhanced Loading State */
                            <div className="space-y-4 px-4">
                                {/* Animated Spinner */}
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto" />

                                {/* Loading Text */}
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-blue-600">
                                        Uploading File...
                                    </p>
                                    <p className="text-xs text-gray-700 font-medium break-all">
                                        {selectedFile.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>

                                {/* Progress Indicator */}
                                <div className="w-full max-w-[200px] mx-auto">
                                    <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 animate-[shimmer_1.5s_infinite] w-full" />
                                    </div>
                                </div>
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
                                        Import
                                    </h3>
                                    <p className="text-gray-500 text-xs">
                                        {isDragging ? 'Drop CSV here' : 'Select CSV file'}
                                    </p>
                                </div>

                                {/* File Info */}
                                <p className="text-[10px] text-gray-400 font-medium mt-1">
                                    Max {maxFileSizeMB}MB
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
                    onHeaderCheckboxChange={handleHeaderCheckboxChange}
                    onCancel={clearFile}
                    error={error}
                    isProcessing={isProcessing}
                />
            </div>
        );
    };


    // Render current step (only upload and preview now, column-select is a separate page)
    switch (currentStep) {
        case 'preview':
            return renderPreviewStep();
        default:
            return renderUploadStep();
    }
}
