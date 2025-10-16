/**
 * Payment Form component with Razorpay integration
 * Handles secure payment processing for subscriptions
 */

import React from 'react';
import { 
    CreditCard, 
    Shield, 
    Lock, 
    CheckCircle, 
    AlertCircle,
    Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { formatCurrency } from '../../lib/utils';
import type { SubscriptionPlan, PaymentFormData, UserSubscription, BillingInfo, ProrationInfo } from '../../types/subscription';

interface PaymentFormProps {
    plan: SubscriptionPlan;
    currentSubscription?: UserSubscription | null;
    isUpgrade?: boolean;
    isDowngrade?: boolean;
    onPaymentSubmit: (data: PaymentFormData) => Promise<void>;
    onPaymentSuccess: (paymentId: string, orderId: string) => void;
    onPaymentError: (error: string) => void;
    loading?: boolean;
    disabled?: boolean;
    billing?: BillingInfo;
    proration?: ProrationInfo;
}

interface RazorpayResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpayResponse) => void;
    prefill: {
        name: string;
        email: string;
        contact: string;
    };
    theme: {
        color: string;
    };
    modal: {
        ondismiss: () => void;
    };
}

declare global {
    interface Window {
        Razorpay: new (options: RazorpayOptions) => {
            open: () => void;
        };
    }
}


/**
 * Secure payment form with Razorpay integration
 * @param plan - Selected subscription plan
 * @param onPaymentSubmit - Handler for payment form submission
 * @param onPaymentSuccess - Handler for successful payment
 * @param onPaymentError - Handler for payment errors
 * @param loading - Loading state
 * @param disabled - Disabled state
 * @returns PaymentForm JSX element
 */
export function PaymentForm({
    plan,
    currentSubscription,
    isUpgrade = false,
    isDowngrade = false,
    onPaymentSubmit,
    onPaymentSuccess: _onPaymentSuccess,
    onPaymentError,
    loading = false,
    disabled = false,
    billing,
    proration,
}: PaymentFormProps) {
    try {
        const [selectedMethod] = React.useState<string>('card');
        const [savePaymentMethod] = React.useState<boolean>(false);
        const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
        const [razorpayLoaded, setRazorpayLoaded] = React.useState<boolean>(false);

        // Load Razorpay script (only for new subscriptions, not upgrades)
        React.useEffect(() => {
            // Skip Razorpay loading for upgrades since they don't require payment processing
            if (isUpgrade) {
                setRazorpayLoaded(true);
                return;
            }

            const loadRazorpay = () => {
                try {
                    if (window.Razorpay) {
                        setRazorpayLoaded(true);
                        return;
                    }

                    const script = document.createElement('script');
                    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                    script.async = true;
                    script.onload = () => setRazorpayLoaded(true);
                    script.onerror = () => {
                        console.error('Failed to load Razorpay script');
                        onPaymentError('Payment system unavailable. Please try again later.');
                    };
                    document.head.appendChild(script);

                    return () => {
                        if (script.parentNode) {
                            script.parentNode.removeChild(script);
                        }
                    };
                } catch (error) {
                    console.error('Error loading Razorpay:', error);
                    onPaymentError('Payment system unavailable. Please try again later.');
                }
            };

            loadRazorpay();
        }, [isUpgrade, onPaymentError]);

        const formatAmount = (amount: number): string => {
            try {
                return new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    minimumFractionDigits: 2
                }).format(amount / 100); // Convert paise to rupees
            } catch (error) {
                console.error('Amount formatting error:', error);
                return `₹${(amount / 100).toFixed(2)}`;
            }
        };

        // GST is now inclusive in the plan price - no additional calculation needed

        const handlePaymentSubmit = async (e: React.FormEvent) => {
            try {
                e.preventDefault();
                
                // For upgrades, razorpayLoaded check is not needed
                if (!isUpgrade && !razorpayLoaded) {
                    onPaymentError('Payment system is loading. Please wait a moment and try again.');
                    return;
                }

                if (isProcessing || loading || disabled) {
                    return;
                }

                setIsProcessing(true);

                const paymentData: PaymentFormData = {
                    planCode: plan.plan_code, // Use plan_code as primary identifier
                    paymentMethod: isUpgrade ? 'upgrade' : selectedMethod,
                    savePaymentMethod: isUpgrade ? false : savePaymentMethod,
                    // Include legacy planId for backward compatibility
                    planId: plan.id,
                };

                // For upgrades: calls updateSubscription API directly
                // For new subscriptions: creates payment intent and handles Razorpay checkout
                await onPaymentSubmit(paymentData);

            } catch (error) {
                console.error('Payment submit error:', error);
                setIsProcessing(false);
                onPaymentError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
            }
        };

        const total = plan.price ?? 0; // Price is GST-inclusive

        // For upgrades, show upgrade confirmation instead of payment form
        if (isUpgrade && currentSubscription) {
            return (
                <div className="space-y-6">
                    {/* Upgrade confirmation header */}
                    <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                        <CardContent className="p-6">
                            <div className="text-center space-y-4">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900">
                                        {isDowngrade ? 'Downgrade Your Subscription' : 'Upgrade Your Subscription'}
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {isDowngrade 
                                            ? 'Your subscription will be downgraded immediately'
                                            : 'Your subscription will be upgraded immediately'
                                        }
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Plan comparison */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Plan Comparison</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Current Plan */}
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                    <h4 className="font-medium text-gray-900 mb-2">Current Plan</h4>
                                    <p className="text-lg font-semibold text-gray-700">
                                        {currentSubscription.plan.displayName || currentSubscription.plan.name}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {formatAmount(currentSubscription.plan.price_monthly)} per month
                                    </p>
                                </div>

                                {/* New Plan */}
                                <div className="p-4 border border-green-300 rounded-lg bg-green-50">
                                    <h4 className="font-medium text-gray-900 mb-2">New Plan</h4>
                                    <p className="text-lg font-semibold text-green-700">
                                        {plan.displayName}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {formatAmount(total)} per month
                                    </p>
                                </div>
                            </div>

                            {/* Billing and upgrade information */}
                            <div className="mt-6 space-y-4">
                                {/* Immediate billing information */}
                                {billing?.immediateCharge && (
                                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                        <h5 className="font-medium text-orange-900 mb-2">Immediate Payment Required</h5>
                                        <div className="text-sm text-orange-800 space-y-2">
                                            <p className="font-semibold">
                                                You'll be charged {formatCurrency(billing.chargeAmount)} immediately
                                            </p>
                                            {billing.chargeDescription && (
                                                <p className="text-xs">{billing.chargeDescription}</p>
                                            )}
                                            {proration && (
                                                <div className="mt-2 text-xs space-y-1">
                                                    <p>• Prorated for {proration.daysRemaining} days remaining in current cycle</p>
                                                    <p>• Daily rate: {formatCurrency(proration.dailyRate * 100)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Credit information (only for upgrades - no credits for downgrades per no-refund policy) */}
                                {billing?.creditAmount && billing.creditAmount > 0 && !isDowngrade && (
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <h5 className="font-medium text-green-900 mb-2">Account Credit</h5>
                                        <div className="text-sm text-green-800 space-y-1">
                                            <p>You'll receive {formatCurrency(billing.creditAmount)} as account credit</p>
                                            {billing.creditDescription && (
                                                <p className="text-xs">{billing.creditDescription}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* No-refund policy notice for downgrades */}
                                {isDowngrade && (
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <h5 className="font-medium text-blue-900 mb-2">No-Refund Policy</h5>
                                        <div className="text-sm text-blue-800 space-y-1">
                                            <p>You will continue to have access to your current plan features until your next billing cycle.</p>
                                            <p>No refunds or credits will be issued for the unused portion of your current plan.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Next billing information */}
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <h5 className="font-medium text-blue-900 mb-2">What happens next:</h5>
                                    <ul className="text-sm text-blue-800 space-y-1">
                                        <li>• Your subscription will be {isDowngrade ? 'downgraded' : 'upgraded'} immediately</li>
                                        <li>• {isDowngrade 
                                            ? 'You will retain current plan features until your next billing cycle'
                                            : 'New features will be available right away'
                                        }</li>
                                        {billing?.nextBillingAmount && billing?.nextBillingDate ? (
                                            <li>• Next billing: {formatCurrency(billing.nextBillingAmount)} on {new Date(billing.nextBillingDate).toLocaleDateString()}</li>
                                        ) : (
                                            <li>• Billing changes take effect on your next billing cycle</li>
                                        )}
                                        <li>• You can change plans anytime from your account settings</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Upgrade confirmation button */}
                    <form onSubmit={handlePaymentSubmit}>
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            loading={isProcessing || loading}
                            disabled={disabled}
                            className="text-lg py-4"
                        >
                            {(isProcessing || loading) ? (
                                <>
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    {isDowngrade ? 'Processing Downgrade...' : 'Processing Upgrade...'}
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-5 w-5 mr-2" />
                                    {isDowngrade ? 'Confirm Downgrade' : 'Confirm Upgrade'}
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Upgrade notice */}
                    <div className="text-center space-y-2">
                        <p className="text-xs text-gray-500">
                            {billing?.immediateCharge 
                                ? `Payment of ${formatCurrency(billing.chargeAmount)} will be processed immediately.`
                                : `No payment required. Your subscription will be ${isDowngrade ? 'downgraded' : 'upgraded'} immediately.`
                            }
                        </p>
                        <p className="text-xs text-gray-500">
                            By {isDowngrade ? 'downgrading' : 'upgrading'}, you agree to our Terms of Service and Privacy Policy.
                        </p>
                    </div>
                </div>
            );
        }

        // For new subscriptions, show the standard payment form
        return (
            <div className="space-y-6">
                {/* Plan summary */}
                <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-gray-900">
                                    {plan.displayName} Plan
                                </h3>
                                <p className="text-sm text-gray-600">
                                    {plan.description}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-gray-900">
                                    {formatAmount(total)}
                                </p>
                                <p className="text-sm text-gray-600">
                                    per {plan.interval}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Payment method selection */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <CreditCard className="h-5 w-5" />
                            <span>Secure Card Payment</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 border border-primary-200 rounded-lg bg-primary-50">
                            <div className="flex items-center space-x-3">
                                <CreditCard className="h-5 w-5 text-primary-600" />
                                <div>
                                    <p className="font-medium text-gray-900">
                                        Credit/Debit Card
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        Visa, MasterCard, RuPay, American Express
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-500">
                                Secure payment processing powered by Razorpay
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Billing summary */}
                <Card>
                    <CardHeader>
                        <CardTitle>Billing Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between">
                            <span className="font-semibold text-gray-900">
                                {plan.displayName} Plan ({plan.interval}ly)
                            </span>
                            <span className="font-bold text-lg text-gray-900">
                                {formatAmount(total)}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 text-center">
                            Price includes all applicable taxes (GST)
                        </p>
                    </CardContent>
                </Card>

                {/* Security and billing info */}
                <div className="space-y-4">
                    <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                            <Shield className="h-4 w-4 text-green-500" />
                            <span>Secure Payment</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Lock className="h-4 w-4 text-green-500" />
                            <span>SSL Encrypted</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>PCI Compliant</span>
                        </div>
                    </div>

                    <div className="text-center space-y-2">
                        <p className="text-xs text-gray-500">
                            Your subscription will be automatically renewed every {plan.interval}.
                            You can cancel anytime from your account settings.
                        </p>
                        <p className="text-xs text-gray-500">
                            By proceeding, you agree to our Terms of Service and Privacy Policy.
                        </p>
                    </div>
                </div>

                {/* Submit button */}
                <form onSubmit={handlePaymentSubmit}>
                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        fullWidth
                        loading={isProcessing || loading}
                        disabled={disabled || (!isUpgrade && !razorpayLoaded)}
                        className="text-lg py-4"
                    >
                        {(isProcessing || loading) ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                {isProcessing ? 'Processing Payment...' : 'Loading...'}
                            </>
                        ) : (!isUpgrade && !razorpayLoaded) ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Loading Payment System...
                            </>
                        ) : (
                            <>
                                <Lock className="h-5 w-5 mr-2" />
                                Pay {formatAmount(total)} Securely
                            </>
                        )}
                    </Button>
                </form>

                {/* Error display */}
                {!isUpgrade && !razorpayLoaded && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                            <span className="text-sm text-orange-800">
                                Loading payment system... Please wait.
                            </span>
                        </div>
                    </div>
                )}
            </div>
        );
    } catch (error) {
        console.error('PaymentForm render error:', error);
        return (
            <Card>
                <CardContent className="text-center py-8">
                    <p className="text-error-600 mb-4">
                        Unable to load payment form. Please refresh the page and try again.
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