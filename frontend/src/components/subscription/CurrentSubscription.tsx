/**
 * Current Subscription component
 * Displays user's current subscription status, details, and quick actions
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
    Calendar, 
    CreditCard, 
    AlertCircle, 
    CheckCircle, 
    Clock, 
    XCircle,
    TrendingUp
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { cn } from '../../lib/utils';
import { ImmediateCancelModal } from './ImmediateCancelModal';
import type { UserSubscription } from '../../types/subscription';

interface CurrentSubscriptionProps {
    subscription: UserSubscription | null;
    onUpgrade: () => void;
    onCancel: (immediate?: boolean) => void;
    onCompletePayment?: () => void;
    loading?: boolean;
}

const statusConfig = {
    active: {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        label: 'Active',
        description: 'Your subscription is active and up to date'
    },
    created: {
        icon: Clock,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        label: 'Payment Required',
        description: 'Please complete your payment to activate this subscription'
    },
    authenticated: {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        label: 'Active',
        description: 'Your subscription is active and up to date'
    },
    canceled: {
        icon: XCircle,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        label: 'Canceled',
        description: 'Your subscription has been canceled'
    },
    cancelled: {
        icon: XCircle,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        label: 'Canceled',
        description: 'Your subscription has been canceled'
    },
    past_due: {
        icon: AlertCircle,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        label: 'Past Due',
        description: 'Payment is overdue - please update your payment method'
    },
    unpaid: {
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        label: 'Unpaid',
        description: 'Payment failed - subscription will be suspended soon'
    },
    trialing: {
        icon: Clock,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        label: 'Free Trial',
        description: 'You are currently on a free trial'
    },
    expired: {
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        label: 'Expired',
        description: 'This subscription request has expired due to incomplete payment'
    }
};

/**
 * Current subscription status and management component
 * @param subscription - User's current subscription data
 * @param onUpgrade - Handler for upgrade action
 * @param onCancel - Handler for cancellation action
 * @param loading - Loading state
 * @returns CurrentSubscription JSX element
 */
export function CurrentSubscription({
    subscription,
    onUpgrade,
    onCancel,
    onCompletePayment,
    loading = false,
}: CurrentSubscriptionProps) {
    const [showImmediateCancelModal, setShowImmediateCancelModal] = React.useState(false);
    const [immediateCancelLoading, setImmediateCancelLoading] = React.useState(false);

    try {
        // Handle completely invalid subscription objects
        if (!subscription || typeof subscription !== 'object') {
            return (
                <Card>
                    <CardContent className="text-center py-8">
                        <div className="space-y-4">
                            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                                <CreditCard className="h-8 w-8 text-gray-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-medium text-gray-900">
                                    No Active Subscription
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Start with a free plan or choose a paid plan to unlock premium features.
                                </p>
                            </div>
                            <Button onClick={onUpgrade} className="mt-4">
                                Choose a Plan
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            );
        }

        // Get status config with fallback for unknown status values
        const subscriptionStatus = subscription.status || 'unknown';
        const status = statusConfig[subscriptionStatus as keyof typeof statusConfig] || {
            icon: AlertCircle,
            color: 'text-gray-600',
            bgColor: 'bg-gray-100',
            label: 'Unknown Status',
            description: `Subscription status '${subscriptionStatus}' is not recognized`
        };
        const StatusIcon = status.icon;
        // Add null/undefined checks for subscription properties
        const planPrice = subscription.plan?.price ?? 0;
        const isFreePlan = planPrice === 0;
        const isCanceled = subscriptionStatus === 'canceled' || subscriptionStatus === 'cancelled';
        const isCreated = subscriptionStatus === 'created';
        const isExpired = subscriptionStatus === 'expired';
        const requiresPayment = isCreated && !isFreePlan;
        const willCancelAtPeriodEnd = Boolean(subscription.cancelAtPeriodEnd);
        

        const formatDate = (dateString: string): string => {
            try {
                return new Date(dateString).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } catch (error) {
                console.error('Date formatting error:', error);
                return dateString;
            }
        };

        const getDaysUntilRenewal = (): number => {
            try {
                if (!subscription.currentPeriodEnd) return 0;
                const endDate = new Date(subscription.currentPeriodEnd);
                const today = new Date();
                const diffTime = endDate.getTime() - today.getTime();
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            } catch (error) {
                console.error('Days calculation error:', error);
                return 0;
            }
        };

        const daysUntilRenewal = getDaysUntilRenewal();

        const handleImmediateCancel = async () => {
            try {
                setImmediateCancelLoading(true);
                await onCancel(true);
            } catch (error) {
                console.error('Immediate cancellation error:', error);
            } finally {
                setImmediateCancelLoading(false);
            }
        };

        const handleShowImmediateCancelModal = () => {
            try {
                setShowImmediateCancelModal(true);
            } catch (error) {
                console.error('Show immediate cancel modal error:', error);
            }
        };

        const handleCloseImmediateCancelModal = () => {
            try {
                setShowImmediateCancelModal(false);
            } catch (error) {
                console.error('Close immediate cancel modal error:', error);
            }
        };

        return (
            <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                {/* Main subscription card */}
                <Card variant="elevated">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center space-x-3">
                                <div className={cn('p-2 rounded-lg', status.bgColor)}>
                                    <StatusIcon className={cn('h-5 w-5', status.color)} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {subscription.plan?.displayName || 'Unknown Plan'} Plan
                                    </h2>
                                    <p className="text-sm text-gray-600 font-normal">
                                        {status.description}
                                    </p>
                                </div>
                            </CardTitle>
                            <div className={cn(
                                'px-3 py-1 rounded-full text-xs font-medium',
                                status.bgColor,
                                status.color
                            )}>
                                {status.label}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Subscription details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Pricing info */}
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                                        Current Plan
                                    </h4>
                                    <div className="flex items-baseline space-x-2">
                                        <span className="text-2xl font-bold text-gray-900">
                                            ₹{planPrice === 0 ? '0' : (planPrice / 100).toFixed(0)}
                                        </span>
                                        {!isFreePlan && (
                                            <span className="text-sm text-gray-600">
                                                per {subscription.plan?.interval || 'month'}
                                            </span>
                                        )}
                                    </div>
                                    {isFreePlan && (
                                        <p className="text-sm text-gray-600 mt-1">
                                            Free plan with limited features
                                        </p>
                                    )}
                                </div>

                                {/* Billing period */}
                                {!isFreePlan && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                                            Billing Period
                                        </h4>
                                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                                            <Calendar className="h-4 w-4" />
                                            <span>
                                                {subscription.currentPeriodStart && subscription.currentPeriodEnd ? (
                                                    `${formatDate(subscription.currentPeriodStart)} - ${formatDate(subscription.currentPeriodEnd)}`
                                                ) : (
                                                    'Billing period not available'
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Renewal info */}
                            <div className="space-y-4">
                                {!isFreePlan && !isCanceled && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                                            Next Renewal
                                        </h4>
                                        <div className="space-y-1">
                                            <p className="text-sm text-gray-900 font-medium">
                                                {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'Not available'}
                                            </p>
                                            <p className="text-xs text-gray-600">
                                                {daysUntilRenewal > 0 ? (
                                                    `${daysUntilRenewal} days remaining`
                                                ) : daysUntilRenewal === 0 ? (
                                                    'Renews today'
                                                ) : (
                                                    `${Math.abs(daysUntilRenewal)} days overdue`
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {willCancelAtPeriodEnd && !isCanceled && (
                                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                            <AlertCircle className="h-4 w-4 text-orange-600" />
                                            <span className="text-sm font-medium text-orange-800">
                                                Cancels on {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'Unknown date'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-orange-700 mt-1">
                                            Your subscription will end at the end of the current billing period.{' '}
                                            <button
                                                onClick={handleShowImmediateCancelModal}
                                                disabled={loading || immediateCancelLoading}
                                                className="text-orange-800 underline hover:text-orange-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Cancel now
                                            </button>
                                        </p>
                                    </div>
                                )}

                                {isCanceled && subscription.canceledAt && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                                            Canceled On
                                        </h4>
                                        <p className="text-sm text-gray-600">
                                            {formatDate(subscription.canceledAt)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payment Required Notice */}
                        {requiresPayment && (
                            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                <div className="flex items-start space-x-3">
                                    <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-orange-800">
                                            Payment Required
                                        </h4>
                                        <p className="text-sm text-orange-700">
                                            Your subscription is waiting for payment. Complete the payment within 20 minutes to activate your plan, or it will be automatically cancelled.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
                            {requiresPayment && onCompletePayment && (
                                <>
                                    <Button
                                        variant="primary"
                                        onClick={onCompletePayment}
                                        disabled={loading}
                                        className="flex items-center space-x-2"
                                    >
                                        <CreditCard className="h-4 w-4" />
                                        <span>Complete Payment</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => onCancel(true)}
                                        disabled={loading}
                                        className="flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <XCircle className="h-4 w-4" />
                                        <span>Cancel Request</span>
                                    </Button>
                                </>
                            )}

                            {!requiresPayment && !isCanceled && !isExpired && (
                                <>
                                    {!isFreePlan && (
                                        <Button
                                            variant="primary"
                                            onClick={onUpgrade}
                                            disabled={loading}
                                            className="flex items-center space-x-2"
                                        >
                                            <TrendingUp className="h-4 w-4" />
                                            <span>Upgrade Plan</span>
                                        </Button>
                                    )}
                                    
                                    {isFreePlan && (
                                        <Button
                                            variant="primary"
                                            onClick={onUpgrade}
                                            disabled={loading}
                                            className="flex items-center space-x-2"
                                        >
                                            <TrendingUp className="h-4 w-4" />
                                            <span>Upgrade to Pro</span>
                                        </Button>
                                    )}



                                    {!isFreePlan && !willCancelAtPeriodEnd && (
                                        <Button
                                            variant="ghost"
                                            onClick={() => onCancel()}
                                            disabled={loading}
                                            className="flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <XCircle className="h-4 w-4" />
                                            <span>Cancel Subscription</span>
                                        </Button>
                                    )}
                                </>
                            )}

                            {(isCanceled || isExpired) && (
                                <Button
                                    variant="primary"
                                    onClick={onUpgrade}
                                    disabled={loading}
                                    className="flex items-center space-x-2"
                                >
                                    <TrendingUp className="h-4 w-4" />
                                    <span>{isExpired ? 'Start New Subscription' : 'Reactivate Subscription'}</span>
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Additional warnings or notifications */}
                {subscription.status === 'past_due' && (
                    <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-orange-800">
                                        Payment Overdue
                                    </h4>
                                    <p className="text-sm text-orange-700">
                                        Your last payment failed. Please update your payment method to avoid service interruption.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {subscription.status === 'unpaid' && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-red-800">
                                        Subscription Suspended
                                    </h4>
                                    <p className="text-sm text-red-700">
                                        Your subscription has been suspended due to failed payment. Update your payment method to restore access.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </motion.div>

            {/* Immediate Cancel Modal */}
            <ImmediateCancelModal
                isOpen={showImmediateCancelModal}
                onClose={handleCloseImmediateCancelModal}
                onConfirm={handleImmediateCancel}
                loading={immediateCancelLoading}
                planName={subscription?.plan?.displayName}
                currentPeriodEnd={subscription?.currentPeriodEnd}
            />
        </>
        );
    } catch (error) {
        console.error('CurrentSubscription render error:', error);
        return (
            <Card>
                <CardContent className="text-center py-8">
                    <p className="text-error-600 mb-4">
                        Unable to load subscription information. Please refresh the page.
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