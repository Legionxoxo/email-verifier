/**
 * Results List Component
 * Displays list of verified emails with their status
 */

import { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, HelpCircle, List } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import type { EmailVerificationResult } from '../../pages/VerificationResultsPage';
import { toast } from 'react-toastify';
import { verificationApi } from '../../lib/api';


// Interface for component props
interface ResultsListProps {
    results: EmailVerificationResult[];
    totalCount: number;
    csvUploadId?: string; // Optional CSV upload ID for backend download
    listName?: string | null; // Optional list name for download filename
    originalFilename?: string; // Optional original filename as fallback
}


/**
 * Get icon and color for status
 */
function getStatusIcon(status: string) {
    switch (status) {
        case 'valid':
            return {
                icon: CheckCircle2,
                color: 'text-green-600',
                bgColor: 'bg-green-50'
            };
        case 'invalid':
            return {
                icon: XCircle,
                color: 'text-red-600',
                bgColor: 'bg-red-50'
            };
        case 'catch-all':
            return {
                icon: AlertCircle,
                color: 'text-orange-600',
                bgColor: 'bg-orange-50'
            };
        case 'unknown':
            return {
                icon: HelpCircle,
                color: 'text-gray-600',
                bgColor: 'bg-gray-50'
            };
        default:
            return {
                icon: HelpCircle,
                color: 'text-gray-600',
                bgColor: 'bg-gray-50'
            };
    }
}


/**
 * Results List Component
 */
export function ResultsList({ results, totalCount, csvUploadId, listName, originalFilename }: ResultsListProps) {
    const [isDownloading, setIsDownloading] = useState(false);

    /**
     * Download results as CSV from backend
     * Backend generates enriched CSV with original data + verification results
     */
    const handleDownloadCSV = async () => {
        let url: string | null = null;
        let linkElement: HTMLAnchorElement | null = null;

        try {
            // Set loading state immediately to prevent multiple clicks
            setIsDownloading(true);

            if (!csvUploadId) {
                toast.error('No CSV upload ID available for download');
                return;
            }

            toast.info('Downloading results...');

            // Use backend API to download enriched CSV
            const blob = await verificationApi.downloadCSVResults(csvUploadId);

            // Determine filename - prefer list_name, fallback to original_filename
            const downloadFilename = listName
                ? `${listName}.csv`
                : (originalFilename || `results_${csvUploadId}.csv`);

            // Create download link
            url = URL.createObjectURL(blob);
            linkElement = document.createElement('a');
            linkElement.href = url;
            linkElement.download = downloadFilename;
            linkElement.style.visibility = 'hidden';

            document.body.appendChild(linkElement);
            linkElement.click();

            toast.success('Download started successfully');

        } catch (error) {
            console.error('CSV download error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to download CSV');
        } finally {
            // Clean up resources
            if (url) {
                URL.revokeObjectURL(url);
            }
            if (linkElement && document.body.contains(linkElement)) {
                document.body.removeChild(linkElement);
            }
            // Reset loading state
            setIsDownloading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                        <List className="h-5 w-5 text-[#2F327D]" />
                        <span>Results <span className="text-gray-500 font-normal">({totalCount} Emails Verified)</span></span>
                    </CardTitle>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleDownloadCSV}
                        disabled={isDownloading}
                        loading={isDownloading}
                        className="cursor-pointer"
                    >
                        Download CSV
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {/* Results list with scroll */}
                <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-2">
                    {results.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-400">No results to display</p>
                        </div>
                    ) : (
                        results.map((result, index) => {
                            const { icon: Icon, color, bgColor } = getStatusIcon(result.status);

                            return (
                                <div
                                    key={index}
                                    className={`flex items-start space-x-3 p-3 rounded-lg border border-gray-200 ${bgColor} transition-all duration-200 hover:shadow-sm`}
                                >
                                    {/* Status Icon */}
                                    <div className="flex-shrink-0 mt-0.5">
                                        <Icon className={`h-5 w-5 ${color}`} />
                                    </div>

                                    {/* Email and Reason */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 break-all">
                                            {result.email}
                                        </p>
                                        <p className="text-xs text-gray-600 mt-1">
                                            {result.reason}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
