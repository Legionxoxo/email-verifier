/**
 * Verification History Page
 * Shows all email verification requests in a table format
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Download,
    CheckCircle,
    Clock,
    XCircle,
    AlertCircle,
    ArrowLeft,
    FileText
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { TableSkeleton } from '../components/ui/Skeleton';
import { toast } from 'react-toastify';
import { verificationApi, type VerificationHistoryItem } from '../lib/api';

type FilterPeriod = 'this_month' | 'last_month' | 'last_6_months';
type VerificationStatus = 'completed' | 'processing' | 'failed' | 'pending';

interface VerificationExport extends VerificationHistoryItem {
    name: string;
    validEmails: number;
    date: string;
}

/**
 * Verification history page
 * @returns HistoryPage JSX element
 */
export function HistoryPage() {
    const navigate = useNavigate();

    // State management
    const [exports, setExports] = React.useState<VerificationExport[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [error, setError] = React.useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = React.useState<FilterPeriod>('this_month');
    const [currentPage, setCurrentPage] = React.useState(1);
    const [hasMore, setHasMore] = React.useState(true);
    const [total, setTotal] = React.useState(0);
    const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

    const loadExports = React.useCallback(async (page: number, isReset: boolean) => {
        try {
            if (isReset) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }
            setError('');

            // Call API with filters
            const response = await verificationApi.getHistory({
                page: page,
                per_page: 20,
                period: selectedPeriod
            });

            // Map API response to local format
            const mappedExports: VerificationExport[] = response.requests.map((item) => ({
                ...item,
                name: item.request_type === 'csv'
                    ? (item.list_name || item.original_filename || `CSV Upload ${item.email_count} emails`)
                    : item.request_type === 'api'
                    ? `API Verification`
                    : `Single Email Verification`,
                validEmails: 0, // Will be calculated from results if available
                date: new Date(item.created_at).toISOString()
            }));

            // Update state
            setTotal(response.total);

            if (isReset) {
                setExports(mappedExports);
            } else {
                setExports(prev => [...prev, ...mappedExports]);
            }

            // Check if there are more pages
            const totalPages = Math.ceil(response.total / response.per_page);
            setHasMore(page < totalPages);

        } catch (error) {
            console.error('Failed to load verification history:', error);
            setError(error instanceof Error ? error.message : 'Failed to load verification history');
            if (isReset) {
                setExports([]);
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [selectedPeriod]);

    // Reset and load exports when period changes
    React.useEffect(() => {
        setCurrentPage(1);
        setExports([]);
        setHasMore(true);
        loadExports(1, true);
    }, [selectedPeriod, loadExports]);

    // Load more exports when page changes
    React.useEffect(() => {
        if (currentPage > 1) {
            loadExports(currentPage, false);
        }
    }, [currentPage, loadExports]);


    const handleDownload = async (verificationRequestId: string) => {
        let url: string | null = null;
        let linkElement: HTMLAnchorElement | null = null;

        try {
            // Set loading state immediately to prevent multiple clicks
            setDownloadingId(verificationRequestId);

            const exp = exports.find(e => e.verification_request_id === verificationRequestId);
            if (!exp || exp.request_type !== 'csv') {
                toast.error('Only CSV verifications can be downloaded');
                return;
            }

            // Use csv_upload_id from history item if available
            if (!exp.csv_upload_id) {
                toast.error('CSV upload ID not found');
                return;
            }

            toast.info(`Downloading ${exp.name}...`);

            // Download CSV results
            const blob = await verificationApi.downloadCSVResults(exp.csv_upload_id);

            // Create download link using list_name if available
            const downloadFilename = exp.list_name
                ? `${exp.list_name}.csv`
                : (exp.original_filename || `results_${verificationRequestId}.csv`);

            url = window.URL.createObjectURL(blob);
            linkElement = document.createElement('a');
            linkElement.href = url;
            linkElement.download = downloadFilename;
            document.body.appendChild(linkElement);
            linkElement.click();

            toast.success('Download started successfully');

        } catch (error) {
            console.error('Failed to download export:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to download export');
        } finally {
            // Clean up resources
            if (url) {
                window.URL.revokeObjectURL(url);
            }
            if (linkElement && document.body.contains(linkElement)) {
                document.body.removeChild(linkElement);
            }
            // Reset loading state
            setDownloadingId(null);
        }
    };


    const handleViewDetails = (verificationRequestId: string) => {
        try {
            // Find the export to check its status
            const exp = exports.find(e => e.verification_request_id === verificationRequestId);

            // If completed, go directly to results page
            // Otherwise, go to progress page for polling
            if (exp?.status === 'completed') {
                navigate(`/results/${verificationRequestId}`);
            } else {
                navigate(`/verify/${verificationRequestId}`);
            }
        } catch (error) {
            console.error('View details navigation error:', error);
            toast.error('Failed to navigate to details page');
        } finally {
            // No cleanup needed
        }
    };

    const handleBackNavigation = () => {
        try {
            navigate('/dashboard');
        } catch (error) {
            console.error('Back navigation error:', error);
            window.history.back();
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Check if it's today
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        }

        // Check if it's yesterday
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }

        // Otherwise return formatted date
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    };

    const getStatusIcon = (status: VerificationStatus) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-5 w-5 text-green-600" />;
            case 'processing':
                return <Clock className="h-5 w-5 text-blue-600" />;
            case 'pending':
                return <Clock className="h-5 w-5 text-yellow-600" />;
            case 'failed':
                return <XCircle className="h-5 w-5 text-red-600" />;
        }
    };

    const getStatusText = (status: VerificationStatus) => {
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        try {
            const target = e.currentTarget;

            // Prevent division by zero
            if (target.scrollHeight === 0) return;

            const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;

            // Load more when scrolled 80% down
            if (scrollPercentage > 0.8 && hasMore && !loadingMore && !loading) {
                setCurrentPage(prev => prev + 1);
            }
        } catch (error) {
            console.error('Scroll handler error:', error);
        } finally {
            // No cleanup needed
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with Back Button */}
                <div className="mb-8">
                    <div className="flex flex-col items-start space-y-4 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleBackNavigation}
                            className="flex items-center space-x-1 cursor-pointer"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span>Back</span>
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Verification History
                            </h1>
                            <p className="text-gray-600 mt-1">
                                View and download your email verification exports
                            </p>
                        </div>
                    </div>
                </div>

                {/* Error display */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6"
                    >
                        <Card className="border-red-200 bg-red-50">
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <AlertCircle className="h-5 w-5 text-red-600" />
                                    <span className="text-sm text-red-800">{error}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setError('')}
                                        className="ml-auto cursor-pointer"
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Filters */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <Card>
                        <CardContent className="p-0">
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setSelectedPeriod('this_month')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${selectedPeriod === 'this_month'
                                        ? 'bg-gray-100 text-gray-900'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    This Month
                                </button>
                                <button
                                    onClick={() => setSelectedPeriod('last_month')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${selectedPeriod === 'last_month'
                                        ? 'bg-gray-100 text-gray-900'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    Last Month
                                </button>
                                <button
                                    onClick={() => setSelectedPeriod('last_6_months')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${selectedPeriod === 'last_6_months'
                                        ? 'bg-gray-100 text-gray-900'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    Last 6 months
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Exports Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card padding="none">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                                                    Export Name
                                                </th>
                                                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                                                    Dated
                                                </th>
                                                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                                                    Status
                                                </th>
                                                <th className="px-6 py-4 text-right text-sm font-medium text-gray-700">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                        </tbody>
                                    </table>
                                    <TableSkeleton rows={5} columns={4} />
                                </div>
                            ) : exports.length === 0 ? (
                                <div className="text-center py-12">
                                    <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                                        No verification exports found
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Start verifying emails to see your history here
                                    </p>
                                </div>
                            ) : (
                                <div
                                    className="overflow-x-auto max-h-[600px] overflow-y-auto"
                                    onScroll={handleScroll}
                                >
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                                                    Export Name
                                                </th>
                                                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                                                    Dated
                                                </th>
                                                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                                                    Status
                                                </th>
                                                <th className="px-6 py-4 text-right text-sm font-medium text-gray-700">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {exports.map((exp) => (
                                                <tr
                                                    key={exp.verification_request_id}
                                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                    onClick={() => handleViewDetails(exp.verification_request_id)}
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center space-x-2">
                                                            {exp.request_type === 'csv' ? (
                                                                <FileText className="h-5 w-5 text-blue-600" />
                                                            ) : (
                                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                                            )}
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {exp.name}
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    {exp.email_count.toLocaleString()} email{exp.email_count !== 1 ? 's' : ''}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm text-gray-700">
                                                            {formatDate(exp.date)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center space-x-2">
                                                            {getStatusIcon(exp.status as VerificationStatus)}
                                                            <span className="text-sm font-medium text-gray-900">
                                                                {getStatusText(exp.status as VerificationStatus)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end space-x-2">
                                                            {exp.request_type === 'csv' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDownload(exp.verification_request_id);
                                                                    }}
                                                                    disabled={exp.status !== 'completed' || downloadingId === exp.verification_request_id}
                                                                    loading={downloadingId === exp.verification_request_id}
                                                                    className="cursor-pointer text-[#4169E1] hover:bg-blue-50"
                                                                    title="Download"
                                                                >
                                                                    <Download className="h-5 w-5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Loading More Indicator */}
                                    {loadingMore && (
                                        <div className="text-center py-4 border-t border-gray-200">
                                            <div className="animate-spin rounded-full h-6 w-6 border-4 border-primary-500 border-t-transparent mx-auto mb-2" />
                                            <p className="text-sm text-gray-600">Loading more...</p>
                                        </div>
                                    )}

                                    {/* End of List Indicator */}
                                    {!hasMore && exports.length > 0 && (
                                        <div className="text-center py-4 border-t border-gray-200">
                                            <p className="text-sm text-gray-500">
                                                Showing all {total} verification{total !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
