/**
 * Bulk Verifier Step Two Component
 * Column selection for email verification
 */

import { useState, useEffect, useRef } from 'react';
import { Mail, Info, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import type { CSVFullDataResult } from '../../lib/csvParser';


// Interface for component props
interface BulkVerifierStepTwoProps {
    parsedData: CSVFullDataResult;
    onVerify: (selectedColumn: string) => void;
    isVerifying?: boolean;
}


/**
 * Bulk Verifier Step Two Component
 * @param props - Component props
 * @returns JSX element
 */
export function BulkVerifierStepTwo({
    parsedData,
    onVerify,
    isVerifying = false
}: BulkVerifierStepTwoProps) {
    // Normalize column name for comparison (handle space vs underscore mismatch)
    const normalizeColumnName = (name: string | null): string => {
        if (!name) return '';
        // Replace underscores with spaces and normalize whitespace
        return name.replace(/_/g, ' ').trim();
    };

    // Find the actual header that matches the detected column
    const detectedColumnRaw = parsedData.detectedEmailColumn;
    const normalizedDetected = normalizeColumnName(detectedColumnRaw);
    const detectedColumn = parsedData.headers.find(h => normalizeColumnName(h) === normalizedDetected) || null;

    const [selectedColumn, setSelectedColumn] = useState<string>(
        detectedColumn || parsedData.headers[0] || ''
    );
    const [userHasSelected, setUserHasSelected] = useState<boolean>(false);

    // Ref for the detected column to scroll into view
    const detectedColumnRef = useRef<HTMLTableCellElement>(null);


    // Auto-scroll to detected column on mount
    useEffect(() => {
        if (detectedColumnRef.current && detectedColumn) {
            detectedColumnRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }, [detectedColumn]);


    // Email stats calculation removed - backend handles email extraction and validation
    // since the CSV is already uploaded and stored on the server


    const handleColumnSelect = (header: string) => {
        // Step 1: Clear previous selection first (force re-render to remove old highlight)
        setSelectedColumn('');

        // Step 2: Then set new selection after 100ms delay
        setTimeout(() => {
            setSelectedColumn(header);
            setUserHasSelected(true);
        }, 100);
    };


    const handleVerifyEmails = () => {
        try {
            if (!selectedColumn) {
                return;
            }

            // Backend will extract emails from the uploaded CSV using the selected column
            // No need to extract emails on frontend since file is already uploaded
            onVerify(selectedColumn);
        } catch (error) {
            console.error('Verify emails error:', error);
        }
    };


    // Get header background color based on confidence and selection
    const getHeaderBgColor = (header: string): string => {
        const isSelected = selectedColumn === header;
        const isDetected = detectedColumn === header;
        const confidence = parsedData.detectionConfidence || 0;

        // User manually selected this column - dark green (highest priority)
        if (userHasSelected && isSelected) {
            return 'bg-green-700 text-white';
        }

        // Auto-detected column showing before user selection (confidence-based colors)
        // Only show if detectedColumn exists
        if (!userHasSelected && isDetected && detectedColumn) {
            if (confidence >= 80) {
                return 'bg-green-500 text-white';
            } else if (confidence >= 50) {
                return 'bg-orange-400 text-white';
            } else {
                return 'bg-red-400 text-white';
            }
        }

        // Default state - no highlighting
        return 'text-[#2F327D] hover:bg-green-100';
    };


    // Get cell background color based on confidence and selection
    const getCellBgColor = (header: string): string => {
        const isSelected = selectedColumn === header;
        const isDetected = detectedColumn === header;
        const confidence = parsedData.detectionConfidence || 0;

        // User manually selected this column - dark green tint (highest priority)
        if (userHasSelected && isSelected) {
            return 'bg-green-100 text-gray-900 font-medium';
        }

        // Auto-detected column showing before user selection (confidence-based colors)
        // Only show if detectedColumn exists
        if (!userHasSelected && isDetected && detectedColumn) {
            if (confidence >= 80) {
                return 'bg-green-50 text-gray-900 font-medium';
            } else if (confidence >= 50) {
                return 'bg-orange-50 text-gray-900 font-medium';
            } else {
                return 'bg-red-50 text-gray-900 font-medium';
            }
        }

        // Default state - no highlighting
        return 'text-gray-700';
    };


    return (
        <div className="space-y-6">
            {/* Header section */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center space-x-2 text-[#2F327D] mb-4">
                        <Mail className="h-5 w-5" />
                        <h3 className="font-semibold">Select the column with Emails</h3>
                    </div>

                    {/* Detection confidence warning */}
                    {parsedData.detectionConfidence !== undefined && parsedData.detectionConfidence < 80 && (
                        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start space-x-2">
                            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-orange-800">
                                    {parsedData.detectionConfidence >= 50
                                        ? 'Moderate confidence in email detection'
                                        : 'Low confidence in email detection'}
                                </p>
                                <p className="text-xs text-orange-700 mt-1">
                                    We detected "{detectedColumn}" as the email column with {parsedData.detectionConfidence.toFixed(0)}% confidence.
                                    Please verify the selection below or choose a different column.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Table with column selection */}
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-blue-50">
                                <tr>
                                    {parsedData.headers.map((header) => (
                                        <th
                                            key={header}
                                            ref={header === detectedColumn ? detectedColumnRef : null}
                                            onClick={() => handleColumnSelect(header)}
                                            className={`
                                                px-4 py-3 text-left text-sm font-semibold cursor-pointer
                                                ${getHeaderBgColor(header)}
                                            `}
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {parsedData.preview.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="hover:bg-gray-50">
                                        {parsedData.headers.map((header) => (
                                            <td
                                                key={header}
                                                className={`
                                                    px-4 py-3 text-sm whitespace-nowrap
                                                    ${getCellBgColor(header)}
                                                `}
                                            >
                                                {row[header] || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Stats section */}
            <div className="flex items-center space-x-2 text-sm text-gray-700">
                <Info className="h-4 w-4 text-blue-500" />
                <p>
                    *Select the column with most unique and valid syntax emails.
                </p>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end">
                <Button
                    variant="primary"
                    onClick={handleVerifyEmails}
                    disabled={isVerifying || !selectedColumn}
                    className="cursor-pointer"
                >
                    {isVerifying ? 'Verifying...' : 'Verify emails'}
                </Button>
            </div>
        </div>
    );
}
