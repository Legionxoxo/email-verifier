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
    Share2,
    CheckCircle,
    Clock,
    XCircle,
    AlertCircle,
    ArrowLeft
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { toast } from 'react-toastify';

type FilterPeriod = 'this-month' | 'last-month' | 'last-6-months';
type VerificationStatus = 'completed' | 'processing' | 'failed';

interface VerificationExport {
    id: string;
    name: string;
    date: string;
    status: VerificationStatus;
    totalEmails: number;
    validEmails: number;
    downloadUrl?: string;
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
    const [selectedPeriod, setSelectedPeriod] = React.useState<FilterPeriod>('this-month');
    const [searchQuery, setSearchQuery] = React.useState('');

    // Load exports on mount
    React.useEffect(() => {
        loadExports();
    }, []);

    // Filter exports when period or search changes
    React.useEffect(() => {
        filterExports();
    }, [exports, selectedPeriod, searchQuery]);

    const loadExports = async () => {
        try {
            setLoading(true);
            setError('');

            // TODO: Replace with actual API call
            // const response = await verificationApi.getExports();
            // setExports(response);

            // Mock data
            await new Promise(resolve => setTimeout(resolve, 500));
            const mockExports: VerificationExport[] = [
                {
                    id: '1',
                    name: 'emails_to_verify',
                    date: new Date().toISOString(),
                    status: 'completed',
                    totalEmails: 1500,
                    validEmails: 1342
                },
                {
                    id: '2',
                    name: 'client_email_list',
                    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'completed',
                    totalEmails: 850,
                    validEmails: 792
                },
                {
                    id: '3',
                    name: 'marketing_leads',
                    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'processing',
                    totalEmails: 2500,
                    validEmails: 0
                },
                {
                    id: '4',
                    name: 'old_database_cleanup',
                    date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'completed',
                    totalEmails: 5000,
                    validEmails: 4127
                },
                {
                    id: '5',
                    name: 'failed_verification_batch',
                    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'failed',
                    totalEmails: 300,
                    validEmails: 0
                }
            ];

            setExports(mockExports);

        } catch (error) {
            console.error('Failed to load verification history:', error);
            setError(error instanceof Error ? error.message : 'Failed to load verification history');
        } finally {
            setLoading(false);
        }
    };

    const filterExports = () => {
        let filtered = [...exports];

        // Filter by period
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        filtered = filtered.filter(exp => {
            const expDate = new Date(exp.date);
            const expMonth = expDate.getMonth();
            const expYear = expDate.getFullYear();

            switch (selectedPeriod) {
                case 'this-month':
                    return expMonth === currentMonth && expYear === currentYear;
                case 'last-month':
                    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
                    return expMonth === lastMonth && expYear === lastMonthYear;
                case 'last-6-months':
                    const sixMonthsAgo = new Date(now);
                    sixMonthsAgo.setMonth(now.getMonth() - 6);
                    return expDate >= sixMonthsAgo;
                default:
                    return true;
            }
        });

        // Filter by search query
        if (searchQuery.trim()) {
            filtered = filtered.filter(exp =>
                exp.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        setFilteredExports(filtered);
    };

    const handleDownload = async (exportId: string) => {
        try {
            const exp = exports.find(e => e.id === exportId);
            if (!exp) return;

            // TODO: Replace with actual API call
            // const downloadUrl = await verificationApi.downloadExport(exportId);
            // window.open(downloadUrl, '_blank');

            // Mock download
            toast.success(`Downloading ${exp.name}...`);
            console.log('Download export:', exportId);

        } catch (error) {
            console.error('Failed to download export:', error);
            toast.error('Failed to download export');
        }
    };

    const handleShare = async (exportId: string) => {
        try {
            const exp = exports.find(e => e.id === exportId);
            if (!exp) return;

            // TODO: Replace with actual API call
            // const shareUrl = await verificationApi.getShareLink(exportId);
            // navigator.clipboard.writeText(shareUrl);

            // Mock share
            const mockShareUrl = `${window.location.origin}/shared/${exportId}`;
            await navigator.clipboard.writeText(mockShareUrl);
            toast.success('Share link copied to clipboard');

        } catch (error) {
            console.error('Failed to share export:', error);
            toast.error('Failed to create share link');
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
                                        onClick={() => setSelectedPeriod('this-month')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${selectedPeriod === 'this-month'
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        This Month
                                    </button>
                                    <button
                                        onClick={() => setSelectedPeriod('last-month')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${selectedPeriod === 'last-month'
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        Last Month
                                    </button>
                                    <button
                                        onClick={() => setSelectedPeriod('last-6-months')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${selectedPeriod === 'last-6-months'
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
                                                    key={exp.id}
                                                    className="hover:bg-gray-50 transition-colors"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {exp.name}
                                                        </div>
                                                        {exp.status === 'completed' && (
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                {exp.validEmails.toLocaleString()} of{' '}
                                                                {exp.totalEmails.toLocaleString()} valid
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm text-gray-700">
                                                            {formatDate(exp.date)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center space-x-2">
                                                            {getStatusIcon(exp.status)}
                                                            <span className="text-sm font-medium text-gray-900">
                                                                {getStatusText(exp.status)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end space-x-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDownload(exp.id)}
                                                                disabled={exp.status !== 'completed'}
                                                                className="cursor-pointer text-[#4169E1] hover:bg-blue-50"
                                                                title="Download"
                                                            >
                                                                <Download className="h-5 w-5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleShare(exp.id)}
                                                                disabled={exp.status !== 'completed'}
                                                                className="cursor-pointer text-[#4169E1] hover:bg-blue-50"
                                                                title="Share"
                                                            >
                                                                <Share2 className="h-5 w-5" />
                                                            </Button>
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
