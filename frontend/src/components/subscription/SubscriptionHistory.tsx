/**
 * Subscription History component
 * Displays transaction history with filtering and pagination
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
    Calendar, 
    Download, 
    Filter, 
    Search, 
    CheckCircle, 
    XCircle, 
    Clock,
    RefreshCw,
    FileText,
    ChevronDown,
    AlertCircle,
    Ban
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { cn } from '../../lib/utils';
import type { BillingTransaction, TransactionFilters } from '../../types/subscription';

interface SubscriptionHistoryProps {
    transactions: BillingTransaction[];
    totalTransactions: number;
    currentPage: number;
    totalPages: number;
    filters: TransactionFilters;
    onFiltersChange: (filters: TransactionFilters) => void;
    onPageChange: (page: number) => void;
    onDownloadInvoice: (transactionId: string) => void;
    loading?: boolean;
}

const statusConfig = {
    succeeded: {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        label: 'Successful'
    },
    failed: {
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        label: 'Failed'
    },
    pending: {
        icon: Clock,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        label: 'Pending'
    },
    refunded: {
        icon: RefreshCw,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        label: 'Refunded'
    },
    cancelled: {
        icon: Ban,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        label: 'Cancelled'
    }
};

/**
 * Transaction history with filtering and pagination
 * @param transactions - List of billing transactions
 * @param totalTransactions - Total number of transactions
 * @param currentPage - Current page number
 * @param totalPages - Total number of pages
 * @param filters - Current filter settings
 * @param onFiltersChange - Handler for filter changes
 * @param onPageChange - Handler for page changes
 * @param onDownloadInvoice - Handler for invoice download
 * @param loading - Loading state
 * @returns SubscriptionHistory JSX element
 */
export function SubscriptionHistory({
    transactions,
    totalTransactions,
    currentPage,
    totalPages,
    filters,
    onFiltersChange,
    onPageChange,
    onDownloadInvoice,
    loading = false,
}: SubscriptionHistoryProps) {
    try {
        const [showFilters, setShowFilters] = React.useState(false);
        const [searchTerm, setSearchTerm] = React.useState('');

        const formatDate = (dateString: string): string => {
            try {
                return new Date(dateString).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (error) {
                console.error('Date formatting error:', error);
                return dateString;
            }
        };

        const formatAmount = (amount: number, currency: string): string => {
            try {
                return new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: currency.toUpperCase(),
                    minimumFractionDigits: 2
                }).format(amount / 100); // Assuming amount is in smallest currency unit
            } catch (error) {
                console.error('Amount formatting error:', error);
                return `${currency.toUpperCase()} ${amount}`;
            }
        };

        const handleStatusFilter = (status: BillingTransaction['status'] | undefined) => {
            try {
                onFiltersChange({
                    ...filters,
                    status,
                    page: 1 // Reset to first page when filtering
                });
            } catch (error) {
                console.error('Status filter error:', error);
            }
        };

        const handleDateRangeFilter = (dateFrom?: string, dateTo?: string) => {
            try {
                onFiltersChange({
                    ...filters,
                    dateFrom,
                    dateTo,
                    page: 1
                });
            } catch (error) {
                console.error('Date filter error:', error);
            }
        };

        const filteredTransactions = React.useMemo(() => {
            try {
                // Filter transactions based on search term
                
                if (!searchTerm) return transactions;
                
                return transactions.filter(transaction =>
                    transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    transaction.id.toLowerCase().includes(searchTerm.toLowerCase())
                );
            } catch (error) {
                console.error('Transaction filtering error:', error);
                return transactions;
            }
        }, [transactions, searchTerm]);

        if (loading && transactions.length === 0) {
            return (
                <Card>
                    <CardContent className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent mx-auto mb-4" />
                        <p className="text-gray-600">Loading transaction history...</p>
                    </CardContent>
                </Card>
            );
        }

        return (
            <div className="space-y-6">
                {/* Header with filters */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                            <CardTitle className="flex items-center space-x-2">
                                <FileText className="h-5 w-5" />
                                <span>Transaction History</span>
                                {totalTransactions > 0 && (
                                    <span className="text-sm font-normal text-gray-500">
                                        ({totalTransactions} total)
                                    </span>
                                )}
                            </CardTitle>
                            
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="flex items-center space-x-2 min-h-[44px] cursor-pointer"
                                >
                                    <Filter className="h-4 w-4" />
                                    <span>Filters</span>
                                    <ChevronDown className={cn(
                                        'h-4 w-4 transition-transform',
                                        showFilters && 'rotate-180'
                                    )} />
                                </Button>
                            </div>
                        </div>

                        {/* Search and filters */}
                        <motion.div
                            initial={false}
                            animate={{ height: showFilters ? 'auto' : 0, opacity: showFilters ? 1 : 0 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-4 space-y-4">
                                {/* Search */}
                                <div className="max-w-md">
                                    <Input
                                        placeholder="Search transactions..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        startIcon={<Search className="h-4 w-4" />}
                                        fullWidth
                                    />
                                </div>

                                {/* Status filters */}
                                <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Filter by Status</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant={filters.status === undefined ? 'primary' : 'outline'}
                                            size="sm"
                                            onClick={() => handleStatusFilter(undefined)}
                                            className="min-h-[44px] cursor-pointer px-4"
                                        >
                                            All Status
                                        </Button>
                                        {Object.entries(statusConfig).map(([status, config]) => (
                                            <Button
                                                key={status}
                                                variant={filters.status === status ? 'primary' : 'outline'}
                                                size="sm"
                                                onClick={() => handleStatusFilter(status as BillingTransaction['status'])}
                                                className="flex items-center space-x-1 min-h-[44px] cursor-pointer px-4"
                                            >
                                                <config.icon className="h-3 w-3" />
                                                <span>{config.label}</span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Date range filters */}
                                <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Filter by Date</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDateRangeFilter()}
                                            className="min-h-[44px] cursor-pointer px-4"
                                        >
                                            All Time
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                const now = new Date();
                                                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                                                handleDateRangeFilter(lastMonth.toISOString().split('T')[0]);
                                            }}
                                            className="min-h-[44px] cursor-pointer px-4"
                                        >
                                            Last Month
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                const now = new Date();
                                                const lastThreeMonths = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                                                handleDateRangeFilter(lastThreeMonths.toISOString().split('T')[0]);
                                            }}
                                            className="min-h-[44px] cursor-pointer px-4"
                                        >
                                            Last 3 Months
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </CardHeader>
                </Card>

                {/* Transactions list */}
                <Card>
                    <CardContent className="p-0">
                        {filteredTransactions.length === 0 ? (
                            <div className="text-center py-8 space-y-4">
                                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                                    <FileText className="h-8 w-8 text-gray-400" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-medium text-gray-900">
                                        No Transactions Found
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        {searchTerm || filters.status ? 
                                            'No transactions match your current filters.' :
                                            'You haven\'t made any payments yet.'
                                        }
                                    </p>
                                </div>
                                {(searchTerm || filters.status) && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSearchTerm('');
                                            onFiltersChange({ page: 1 });
                                        }}
                                        className="min-h-[44px] cursor-pointer"
                                    >
                                        Clear Filters
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredTransactions.map((transaction, index) => {
                                    const status = statusConfig[transaction.status] || {
                                        icon: AlertCircle,
                                        color: 'text-gray-600',
                                        bgColor: 'bg-gray-100',
                                        label: 'Unknown'
                                    };
                                    const StatusIcon = status.icon;

                                    return (
                                        <motion.div
                                            key={transaction.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="p-4 sm:p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                                        >
                                            {/* Mobile Layout: Stacked vertically */}
                                            <div className="sm:hidden space-y-4">
                                                {/* Top row: Status and Amount */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <div className={cn('p-2 rounded-full', status.bgColor)}>
                                                            <StatusIcon className={cn('h-4 w-4', status.color)} />
                                                        </div>
                                                        <span className={cn(
                                                            'px-2 py-1 rounded-full text-xs font-medium',
                                                            status.bgColor,
                                                            status.color
                                                        )}>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                    
                                                    {transaction.status !== 'cancelled' && (
                                                        <div className="text-right">
                                                            <p className="font-semibold text-gray-900 text-lg">
                                                                {formatAmount(transaction.amount, transaction.currency)}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Transaction title */}
                                                <div>
                                                    <h4 className="font-medium text-gray-900 text-base leading-tight">
                                                        {transaction.description}
                                                    </h4>
                                                </div>

                                                {/* Transaction details - each on separate line */}
                                                <div className="space-y-2 text-sm text-gray-600">
                                                    <div className="flex items-center space-x-2">
                                                        <Calendar className="h-3 w-3 flex-shrink-0" />
                                                        <span>{formatDate(transaction.createdAt)}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center space-x-2">
                                                        <div className="h-3 w-3 flex-shrink-0" />
                                                        <span>Payment: {transaction.paymentMethod}</span>
                                                    </div>
                                                    
                                                    {transaction.status !== 'cancelled' && (
                                                        <div className="flex items-center space-x-2">
                                                            <div className="h-3 w-3 flex-shrink-0" />
                                                            <span>Transaction ID: {transaction.id.slice(-8)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Failure reason */}
                                                {transaction.failureReason && (
                                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                        <p className="text-sm text-red-600">
                                                            {transaction.failureReason}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Actions - full width button on mobile */}
                                                {transaction.invoiceUrl && transaction.status === 'succeeded' && (
                                                    <div className="pt-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => onDownloadInvoice(transaction.id)}
                                                            className="w-full flex items-center justify-center space-x-2 min-h-[44px] cursor-pointer"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                            <span>Download Invoice</span>
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Desktop Layout: Original horizontal layout */}
                                            <div className="hidden sm:flex items-center justify-between">
                                                <div className="flex items-center space-x-4">
                                                    {/* Status icon */}
                                                    <div className={cn('p-2 rounded-full', status.bgColor)}>
                                                        <StatusIcon className={cn('h-4 w-4', status.color)} />
                                                    </div>

                                                    {/* Transaction details */}
                                                    <div className="space-y-1">
                                                        <div className="flex items-center space-x-3">
                                                            <h4 className="font-medium text-gray-900">
                                                                {transaction.description}
                                                            </h4>
                                                            <span className={cn(
                                                                'px-2 py-1 rounded-full text-xs font-medium',
                                                                status.bgColor,
                                                                status.color
                                                            )}>
                                                                {status.label}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                                                            <span className="flex items-center space-x-1">
                                                                <Calendar className="h-3 w-3" />
                                                                <span>{formatDate(transaction.createdAt)}</span>
                                                            </span>
                                                            <span>•</span>
                                                            <span>{transaction.paymentMethod}</span>
                                                            {transaction.status !== 'cancelled' && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>ID: {transaction.id.slice(-8)}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        {transaction.failureReason && (
                                                            <p className="text-sm text-red-600">
                                                                {transaction.failureReason}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-4">
                                                    {/* Amount - Hide for cancelled transactions */}
                                                    {transaction.status !== 'cancelled' && (
                                                        <div className="text-right">
                                                            <p className="font-semibold text-gray-900">
                                                                {formatAmount(transaction.amount, transaction.currency)}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Actions */}
                                                    {transaction.invoiceUrl && transaction.status === 'succeeded' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => onDownloadInvoice(transaction.id)}
                                                            className="flex items-center space-x-1 cursor-pointer"
                                                        >
                                                            <Download className="h-3 w-3" />
                                                            <span>Invoice</span>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pagination */}
                {totalPages > 1 && (
                    <Card>
                        <CardContent className="p-4">
                            {/* Mobile layout: Stacked */}
                            <div className="sm:hidden space-y-4">
                                <div className="text-center">
                                    <p className="text-sm text-gray-600">
                                        Page {currentPage} of {totalPages}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {totalTransactions} total transactions
                                    </p>
                                </div>
                                
                                <div className="flex items-center justify-between space-x-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => onPageChange(currentPage - 1)}
                                        disabled={currentPage === 1 || loading}
                                        className="flex-1 min-h-[44px] cursor-pointer"
                                    >
                                        Previous
                                    </Button>
                                    
                                    <div className="flex items-center space-x-2">
                                        {/* Show fewer page numbers on mobile */}
                                        {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                                            let pageNum = i + 1;
                                            if (totalPages > 3) {
                                                if (currentPage > 2) {
                                                    pageNum = currentPage - 1 + i;
                                                }
                                                if (currentPage > totalPages - 1) {
                                                    pageNum = totalPages - 2 + i;
                                                }
                                            }
                                            
                                            if (pageNum > totalPages) return null;
                                            
                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={currentPage === pageNum ? 'primary' : 'ghost'}
                                                    size="sm"
                                                    onClick={() => onPageChange(pageNum)}
                                                    disabled={loading}
                                                    className="min-w-[44px] h-[44px] cursor-pointer"
                                                >
                                                    {pageNum}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    
                                    <Button
                                        variant="outline"
                                        onClick={() => onPageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages || loading}
                                        className="flex-1 min-h-[44px] cursor-pointer"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>

                            {/* Desktop layout: Original */}
                            <div className="hidden sm:flex items-center justify-between">
                                <p className="text-sm text-gray-600">
                                    Showing {((currentPage - 1) * (filters.limit || 10)) + 1} to{' '}
                                    {Math.min(currentPage * (filters.limit || 10), totalTransactions)} of{' '}
                                    {totalTransactions} transactions
                                </p>
                                
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onPageChange(currentPage - 1)}
                                        disabled={currentPage === 1 || loading}
                                        className="cursor-pointer"
                                    >
                                        Previous
                                    </Button>
                                    
                                    {/* Page numbers */}
                                    <div className="flex items-center space-x-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum = i + 1;
                                            if (totalPages > 5) {
                                                if (currentPage > 3) {
                                                    pageNum = currentPage - 2 + i;
                                                }
                                                if (currentPage > totalPages - 2) {
                                                    pageNum = totalPages - 4 + i;
                                                }
                                            }
                                            
                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={currentPage === pageNum ? 'primary' : 'ghost'}
                                                    size="sm"
                                                    onClick={() => onPageChange(pageNum)}
                                                    disabled={loading}
                                                    className="w-8 h-8 p-0 cursor-pointer"
                                                >
                                                    {pageNum}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onPageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages || loading}
                                        className="cursor-pointer"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    } catch (error) {
        console.error('SubscriptionHistory render error:', error);
        return (
            <Card>
                <CardContent className="text-center py-8">
                    <p className="text-error-600 mb-4">
                        Unable to load transaction history. Please refresh the page.
                    </p>
                    <Button
                        onClick={() => window.location.reload()}
                        variant="outline"
                    >
                        Refresh Page
                    </Button>
                </CardContent>
            </Card>
        );
    }
}