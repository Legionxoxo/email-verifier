/**
 * Bulk Verifier Step Two Component
 * Column selection for email verification
 */

import { useState, useEffect } from 'react';
import { Mail, Info } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import type { CSVFullDataResult } from '../../lib/csvParser';
import { extractEmailsFromColumn } from '../../lib/csvParser';


// Interface for component props
interface BulkVerifierStepTwoProps {
    parsedData: CSVFullDataResult;
    onVerify: (emails: string[], selectedColumn: string) => void;
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
    const [selectedColumn, setSelectedColumn] = useState<string>(
        parsedData.detectedEmailColumn || parsedData.headers[0] || ''
    );
    const [emailStats, setEmailStats] = useState<{
        uniqueCount: number;
        errors: number;
        duplicates: number;
        creditsRequired: number;
    }>({
        uniqueCount: 0,
        errors: 0,
        duplicates: 0,
        creditsRequired: 0
    });


    // Calculate email stats when column selection changes
    useEffect(() => {
        try {
            if (selectedColumn) {
                const { emails, errors, duplicateCount } = extractEmailsFromColumn(
                    parsedData.rows,
                    selectedColumn
                );

                setEmailStats({
                    uniqueCount: emails.length,
                    errors,
                    duplicates: duplicateCount,
                    creditsRequired: emails.length
                });
            }
        } catch (error) {
            console.error('Email stats calculation error:', error);
        }
    }, [selectedColumn, parsedData.rows]);


    const handleVerifyEmails = () => {
        try {
            if (!selectedColumn) {
                return;
            }

            const { emails } = extractEmailsFromColumn(parsedData.rows, selectedColumn);
            onVerify(emails, selectedColumn);
        } catch (error) {
            console.error('Verify emails error:', error);
        }
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

                    {/* Table with column selection */}
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-blue-50">
                                <tr>
                                    {parsedData.headers.map((header) => (
                                        <th
                                            key={header}
                                            onClick={() => setSelectedColumn(header)}
                                            className={`
                                                px-4 py-3 text-left text-sm font-semibold cursor-pointer
                                                transition-all duration-300
                                                ${selectedColumn === header
                                                    ? 'bg-green-600 text-white'
                                                    : 'text-[#2F327D] hover:bg-green-100'
                                                }
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
                                                onClick={() => setSelectedColumn(header)}
                                                className={`
                                                    px-4 py-3 text-sm whitespace-nowrap cursor-pointer
                                                    transition-all duration-300
                                                    ${selectedColumn === header
                                                        ? 'bg-green-50 text-gray-900 font-medium'
                                                        : 'text-gray-700'
                                                    }
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
                    *This file contains <span className="font-semibold text-green-600">{emailStats.uniqueCount}</span> unique and valid syntax emails.
                </p>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end">
                <Button
                    variant="primary"
                    onClick={handleVerifyEmails}
                    disabled={isVerifying || !selectedColumn || emailStats.uniqueCount === 0}
                    className="cursor-pointer"
                >
                    {isVerifying ? 'Verifying...' : 'Verify emails'}
                </Button>
            </div>
        </div>
    );
}
