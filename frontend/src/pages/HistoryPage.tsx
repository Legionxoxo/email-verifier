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
    const [filteredExports, setFilteredExports] = React.useState<VerificationExport[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = React.useState<FilterPeriod>('this_month');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [currentPage] = React.useState(1);

    // Load exports when period changes
    React.useEffect(() => {
        loadExports();
    }, [selectedPeriod, currentPage]);

    // Filter exports when search changes
    React.useEffect(() => {
        filterExports();
    }, [exports, searchQuery]);

    const loadExports = async () => {
        try {
            setLoading(true);
            setError('');

            // Call API with filters
            const response = await verificationApi.getHistory({
                page: currentPage,
                per_page: 50,
                period: selectedPeriod
            });

            console.log('History response:', response);

            // Map API response to local format
            const mappedExports: VerificationExport[] = response.requests.map((item) => ({
                ...item,
                name: item.request_type === 'csv' ? `CSV Upload ${item.email_count} emails` : `Single Email Verification`,
                validEmails: 0, // Will be calculated from results if available
                date: new Date(item.created_at).toISOString()
            }));

            setExports(mappedExports);

        } catch (error) {
            console.error('Failed to load verification history:', error);
            setError(error instanceof Error ? error.message : 'Failed to load verification history');
            setExports([]);
        } finally {
            setLoading(false);
        }
    };

    const filterExports = () => {
        let filtered = [...exports];

        // Period filtering is handled by API, only filter by search query here
        if (searchQuery.trim()) {
            filtered = filtered.filter(exp =>
                exp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                exp.verification_request_id.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        setFilteredExports(filtered);
    };

    const handleDownload = async (verificationRequestId: string) => {
        try {
            const exp = exports.find(e => e.verification_request_id === verificationRequestId);
            if (!exp || exp.request_type !== 'csv') {
                toast.error('Only CSV verifications can be downloaded');
                return;
            }

            // Get verification details to find csv_upload_id
            const details = await verificationApi.getVerificationDetails(verificationRequestId);
            if (!details.csv_details) {
                toast.error('CSV details not found');
                return;
            }

            toast.info(`Downloading ${exp.name}...`);

            // Download CSV results
            const blob = await verificationApi.downloadCSVResults(details.csv_details.csv_upload_id);

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = details.csv_details.original_filename || `results_${verificationRequestId}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success('Download started successfully');

        } catch (error) {
            console.error('Failed to download export:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to download export');
        }
    };


    const handleViewDetails = (verificationRequestId: string) => {
        navigate(`/verify/${verificationRequestId}`);
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

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with Back Button */}
                <div className="mb-8">
                    <div className="flex items-center space-x-4">
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

                {/* Filters and Search */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <Card>
                        <CardContent className="p-0">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                {/* Period Filter Tabs */}
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

                                {/* Search */}
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm
                                                 focus:outline-none focus:border-[#4169E1] transition-colors bg-white"
                                    />
                                </div>
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
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mx-auto mb-4" />
                                    <p className="text-gray-600">Loading verification history...</p>
                                </div>
                            ) : filteredExports.length === 0 ? (
                                <div className="text-center py-12">
                                    <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                                        No verification exports found
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        {searchQuery
                                            ? 'Try adjusting your search or filter'
                                            : 'Start verifying emails to see your history here'}
                                    </p>
                                </div>
                            ) : (
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
                                            {filteredExports.map((exp) => (
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
                                                                    disabled={exp.status !== 'completed'}
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
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
