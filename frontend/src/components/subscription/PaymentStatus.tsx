/**
 * Payment Status component
 * Displays payment success/failure status with appropriate actions
 */

import { motion } from 'framer-motion';
import { 
    CheckCircle, 
    XCircle, 
    Clock, 
    AlertTriangle,
    Download,
    ArrowRight,
    RefreshCw,
    Home,
    CreditCard
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { cn } from '../../lib/utils';
import type { SubscriptionPlan, BillingTransaction } from '../../types/subscription';

interface PaymentStatusProps {
    status: 'success' | 'failed' | 'pending' | 'processing';
    plan?: SubscriptionPlan;
    transaction?: BillingTransaction;
    paymentId?: string;
    orderId?: string;
    amount?: number;
    currency?: string;
    errorMessage?: string;
    isPolling?: boolean;
    onRetryPayment?: () => void;
    onDownloadInvoice?: () => void;
    onGoToDashboard?: () => void;
    onGoToBilling?: () => void;
    onClose?: () => void;
}

const statusConfig = {
    success: {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-200',
        title: 'Payment Successful!',
        description: 'Your subscription has been activated successfully.'
    },
    failed: {
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-200',
        title: 'Payment Failed',
        description: 'We couldn\'t process your payment. Please try again.'
    },
    pending: {
        icon: Clock,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        borderColor: 'border-orange-200',
        title: 'Payment Pending',
        description: 'Your payment is being processed. This may take a few minutes.'
    },
    processing: {
        icon: RefreshCw,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-200',
        title: 'Processing Payment',
        description: 'Please wait while we process your payment...'
    }
};

/**
 * Payment status display component
 * @param status - Payment status (success, failed, pending, processing)
 * @param plan - Subscription plan details
 * @param transaction - Transaction details
 * @param paymentId - Payment ID from gateway
 * @param orderId - Order ID
 * @param amount - Payment amount
 * @param currency - Payment currency
 * @param errorMessage - Error message for failed payments
 * @param onRetryPayment - Handler to retry payment
 * @param onDownloadInvoice - Handler to download invoice
 * @param onGoToDashboard - Handler to navigate to dashboard
 * @param onGoToBilling - Handler to navigate to billing
 * @param onClose - Handler to close status
 * @returns PaymentStatus JSX element
 */
export function PaymentStatus({
    status,
    plan,
    transaction,
    paymentId,
    orderId,
    amount,
    currency = 'INR',
    errorMessage,
    isPolling = false,
    onRetryPayment,
    onDownloadInvoice,
    onGoToDashboard,
    onGoToBilling,
    onClose,
}: PaymentStatusProps) {
    try {
        const config = statusConfig[status];
        const StatusIcon = config.icon;

        const formatAmount = (amt: number, curr: string): string => {
            try {
                return new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: curr.toUpperCase(),
                    minimumFractionDigits: 2
                }).format(amt / 100); // Convert paise to rupees
            } catch (error) {
                console.error('Amount formatting error:', error);
                return `${curr.toUpperCase()} ${(amt / 100).toFixed(2)}`;
            }
        };

        const formatDate = (dateString: string): string => {
            try {
                return new Date(dateString).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (error) {
                console.error('Date formatting error:', error);
                return dateString;
            }
        };

        const displayAmount = amount || transaction?.amount || plan?.price || 0;
        const displayCurrency = currency || transaction?.currency || 'INR';


        return (
            <div className="flex justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="w-full max-w-md"
                >
                    <Card className={cn('shadow-lg', config.borderColor, 'border-2')}>
                        <CardHeader className="text-center pb-4">
                            <div 
                                className={cn('w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4', config.bgColor)}
                                role="img"
                                aria-label={`Payment status: ${status}`}
                            >
                                <StatusIcon className={cn('h-8 w-8', config.color)} aria-hidden="true" />
                            </div>
                            <CardTitle className="text-xl text-gray-900" id="payment-status-title">
                                {config.title}
                            </CardTitle>
                            <p className="text-sm text-gray-600 mt-2" aria-describedby="payment-status-title">
                                {config.description}
                            </p>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {/* Payment details */}
                            <div className="space-y-4">
                                {plan && (
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <h4 className="font-medium text-gray-900 mb-2">
                                            Subscription Plan
                                        </h4>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">
                                                {plan.displayName} Plan
                                            </span>
                                            <span className="font-semibold text-gray-900">
                                                {formatAmount(displayAmount, displayCurrency)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Transaction details */}
                                {(paymentId || orderId || transaction) && (
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">
                                            Transaction Details
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            {(paymentId || transaction?.id) && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Payment ID:</span>
                                                    <span className="font-mono text-gray-900">
                                                        {paymentId || transaction?.id}
                                                    </span>
                                                </div>
                                            )}
                                            {orderId && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Order ID:</span>
                                                    <span className="font-mono text-gray-900">
                                                        {orderId}
                                                    </span>
                                                </div>
                                            )}
                                            {transaction?.createdAt && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Date:</span>
                                                    <span className="text-gray-900">
                                                        {formatDate(transaction.createdAt)}
                                                    </span>
                                                </div>
                                            )}
                                            {transaction?.paymentMethod && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Method:</span>
                                                    <span className="text-gray-900">
                                                        {transaction.paymentMethod}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Error message */}
                                {status === 'failed' && errorMessage && (
                                    <div 
                                        className="p-3 bg-red-50 border border-red-200 rounded-lg"
                                        role="alert"
                                        aria-live="assertive"
                                    >
                                        <div className="flex items-start space-x-2">
                                            <AlertTriangle 
                                                className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" 
                                                aria-hidden="true"
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-red-800">
                                                    Payment Error
                                                </p>
                                                <p className="text-sm text-red-700 mt-1">
                                                    {errorMessage}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Success message details */}
                                {status === 'success' && (
                                    <div 
                                        className="p-3 bg-green-50 border border-green-200 rounded-lg"
                                        role="status"
                                        aria-live="polite"
                                    >
                                        <div className="flex items-start space-x-2">
                                            <CheckCircle 
                                                className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" 
                                                aria-hidden="true"
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-green-800">
                                                    Subscription Activated
                                                </p>
                                                <p className="text-sm text-green-700 mt-1">
                                                    You now have access to all {plan?.displayName || 'premium'} features. 
                                                    A confirmation email has been sent to your inbox.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Pending message details */}
                                {status === 'pending' && (
                                    <div 
                                        className="p-3 bg-orange-50 border border-orange-200 rounded-lg"
                                        role="status"
                                        aria-live="polite"
                                    >
                                        <div className="flex items-start space-x-2">
                                            <Clock 
                                                className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" 
                                                aria-hidden="true"
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-orange-800">
                                                    Payment Processing
                                                </p>
                                                <p className="text-sm text-orange-700 mt-1">
                                                    Your payment is being verified. You'll receive an email confirmation once it's complete.
                                                    This usually takes 2-5 minutes.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Processing animation with polling progress */}
                                {status === 'processing' && (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-start space-x-3">
                                                <LoadingSpinner 
                                                    size="md" 
                                                    color="primary" 
                                                    className="flex-shrink-0 mt-0.5" 
                                                />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-blue-800">
                                                        Payment Processing
                                                    </p>
                                                    <p className="text-sm text-blue-700 mt-1">
                                                        {isPolling ? 'Verifying your payment...' : 'Processing your payment...'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Processing instructions */}
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500" role="status" aria-live="polite">
                                                Please do not close this window or navigate away while we verify your payment.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action buttons */}
                            <div className="space-y-3">
                                {status === 'success' && (
                                    <>
                                        {onDownloadInvoice && (
                                            <Button
                                                variant="outline"
                                                fullWidth
                                                onClick={onDownloadInvoice}
                                                className="flex items-center justify-center space-x-2"
                                            >
                                                <Download className="h-4 w-4" />
                                                <span>Download Invoice</span>
                                            </Button>
                                        )}
                                        
                                        {onGoToDashboard && (
                                            <Button
                                                variant="primary"
                                                fullWidth
                                                onClick={onGoToDashboard}
                                                className="flex items-center justify-center space-x-2"
                                            >
                                                <Home className="h-4 w-4" />
                                                <span>Go to Dashboard</span>
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </>
                                )}

                                {status === 'failed' && (
                                    <>
                                        {onRetryPayment && (
                                            <Button
                                                variant="primary"
                                                fullWidth
                                                onClick={onRetryPayment}
                                                className="flex items-center justify-center space-x-2"
                                            >
                                                <CreditCard className="h-4 w-4" />
                                                <span>Try Again</span>
                                            </Button>
                                        )}
                                        
                                        {onClose && (
                                            <Button
                                                variant="outline"
                                                fullWidth
                                                onClick={onClose}
                                            >
                                                Back to Plans
                                            </Button>
                                        )}
                                    </>
                                )}

                                {status === 'pending' && (
                                    <>
                                        {onGoToBilling && (
                                            <Button
                                                variant="outline"
                                                fullWidth
                                                onClick={onGoToBilling}
                                                className="flex items-center justify-center space-x-2"
                                            >
                                                <CreditCard className="h-4 w-4" />
                                                <span>View Billing History</span>
                                            </Button>
                                        )}
                                        
                                        {onClose && (
                                            <Button
                                                variant="ghost"
                                                fullWidth
                                                onClick={onClose}
                                            >
                                                Close
                                            </Button>
                                        )}
                                    </>
                                )}

                            </div>

                            {/* Additional info */}
                            {(status === 'success' || status === 'pending') && (
                                <div className="text-center pt-4 border-t border-gray-100">
                                    <p className="text-xs text-gray-500">
                                        Need help? Contact our support team at support@yourapp.com
                                    </p>
                                </div>
                            )}

                            {status === 'failed' && (
                                <div className="text-center pt-4 border-t border-gray-100 space-y-2">
                                    <p className="text-xs text-gray-500">
                                        Having trouble? Here are some common solutions:
                                    </p>
                                    <ul className="text-xs text-gray-500 space-y-1">
                                        <li>• Check your card details and try again</li>
                                        <li>• Ensure you have sufficient balance</li>
                                        <li>• Try a different payment method</li>
                                        <li>• Contact your bank if the issue persists</li>
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        );
    } catch (error) {
        console.error('PaymentStatus render error:', error);
        return (
            <div className="flex justify-center p-4">
                <Card className="max-w-md">
                    <CardContent className="text-center py-8">
                        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Something went wrong
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Unable to display payment status. Please check your billing history or contact support.
                        </p>
                        <div className="space-y-2">
                            {onGoToBilling && (
                                <Button onClick={onGoToBilling} variant="primary" fullWidth>
                                    View Billing History
                                </Button>
                            )}
                            <Button
                                onClick={() => window.location.reload()}
                                variant="outline"
                                fullWidth
                            >
                                Refresh Page
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }
}