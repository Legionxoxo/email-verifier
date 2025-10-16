/**
 * Cancel Subscription Modal component
 * Modal for subscription cancellation with feedback collection
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    AlertTriangle, 
    Calendar, 
    CreditCard,
    CheckCircle,
    Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { cn } from '../../lib/utils';
import type { UserSubscription, CancelRequest } from '../../types/subscription';

interface CancelSubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    subscription: UserSubscription;
    onConfirmCancel: (request: CancelRequest) => Promise<void>;
    loading?: boolean;
}

const cancellationReasons = [
    { id: 'too-expensive', label: 'Too expensive' },
    { id: 'not-using', label: 'Not using the service enough' },
    { id: 'missing-features', label: 'Missing features I need' },
    { id: 'poor-performance', label: 'Poor performance or reliability' },
    { id: 'switching-service', label: 'Switching to another service' },
    { id: 'temporary-pause', label: 'Temporary break, planning to return' },
    { id: 'other', label: 'Other reason' },
];

/**
 * Modal for subscription cancellation with reason collection
 * @param isOpen - Modal visibility state
 * @param onClose - Handler to close modal
 * @param subscription - User's current subscription
 * @param onConfirmCancel - Handler for cancellation confirmation
 * @param loading - Loading state
 * @returns CancelSubscriptionModal JSX element
 */
export function CancelSubscriptionModal({
    isOpen,
    onClose,
    subscription,
    onConfirmCancel,
    loading = false,
}: CancelSubscriptionModalProps) {
    try {
        const [step, setStep] = React.useState<'reason' | 'confirm'>('reason');
        const [selectedReason, setSelectedReason] = React.useState<string>('');
        const [feedback, setFeedback] = React.useState<string>('');
        const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = React.useState<boolean>(true);

        // Reset form when modal opens
        React.useEffect(() => {
            if (isOpen) {
                setStep('reason');
                setSelectedReason('');
                setFeedback('');
                setCancelAtPeriodEnd(true);
            }
        }, [isOpen]);

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

        const handleReasonSubmit = () => {
            try {
                if (!selectedReason) return;
                setStep('confirm');
            } catch (error) {
                console.error('Reason submit error:', error);
            }
        };

        const handleConfirmCancel = async () => {
            try {
                const request: CancelRequest = {
                    reason: selectedReason,
                    feedback: feedback.trim() || undefined,
                    cancelAtPeriodEnd,
                };
                
                await onConfirmCancel(request);
                onClose();
            } catch (error) {
                console.error('Cancel confirmation error:', error);
            }
        };

        const handleBack = () => {
            try {
                setStep('reason');
            } catch (error) {
                console.error('Back navigation error:', error);
            }
        };

        const getDaysRemaining = (): number => {
            try {
                const endDate = new Date(subscription.currentPeriodEnd);
                const today = new Date();
                const diffTime = endDate.getTime() - today.getTime();
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            } catch (error) {
                console.error('Days calculation error:', error);
                return 0;
            }
        };

        const daysRemaining = getDaysRemaining();

        return (
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                        onClick={onClose}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
                        >
                            <Card className="shadow-2xl">
                                <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100">
                                    <CardTitle className="flex items-center space-x-2">
                                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                                        <span>Cancel Subscription</span>
                                    </CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onClose}
                                        disabled={loading}
                                        className="h-8 w-8 p-0"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </CardHeader>

                                <CardContent className="p-6">
                                    {step === 'reason' && (
                                        <div className="space-y-6">
                                            {/* Current subscription info */}
                                            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                                <div className="flex items-center space-x-3">
                                                    <CreditCard className="h-5 w-5 text-orange-600" />
                                                    <div>
                                                        <p className="font-medium text-orange-900">
                                                            {subscription.plan.displayName} Plan
                                                        </p>
                                                        <p className="text-sm text-orange-700">
                                                            ₹{Math.round(subscription.plan.price_monthly / 100)} per month
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Cancellation reason */}
                                            <div className="space-y-4">
                                                <div>
                                                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                                                        Help us improve
                                                    </h3>
                                                    <p className="text-sm text-gray-600 mb-4">
                                                        We'd love to know why you're canceling. Your feedback helps us improve our service.
                                                    </p>
                                                </div>

                                                <div className="space-y-2">
                                                    {cancellationReasons.map((reason) => (
                                                        <label
                                                            key={reason.id}
                                                            className={cn(
                                                                'flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50',
                                                                selectedReason === reason.id 
                                                                    ? 'border-primary-500 bg-primary-50' 
                                                                    : 'border-gray-200'
                                                            )}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="cancelReason"
                                                                value={reason.id}
                                                                checked={selectedReason === reason.id}
                                                                onChange={(e) => setSelectedReason(e.target.value)}
                                                                className="text-primary-600"
                                                            />
                                                            <span className="text-sm text-gray-700">
                                                                {reason.label}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Additional feedback */}
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    Additional feedback (optional)
                                                </label>
                                                <textarea
                                                    value={feedback}
                                                    onChange={(e) => setFeedback(e.target.value)}
                                                    placeholder="Tell us more about your experience or what we could do better..."
                                                    rows={3}
                                                    className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                                    maxLength={500}
                                                />
                                                <p className="text-xs text-gray-500">
                                                    {feedback.length}/500 characters
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {step === 'confirm' && (
                                        <div className="space-y-6">
                                            {/* Confirmation warning */}
                                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                                <div className="flex items-start space-x-3">
                                                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                    <div className="space-y-2">
                                                        <h4 className="font-medium text-red-900">
                                                            You're about to cancel your subscription
                                                        </h4>
                                                        <p className="text-sm text-red-800">
                                                            This action cannot be undone. You'll lose access to premium features.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Cancellation options */}
                                            <div className="space-y-4">
                                                <h4 className="font-medium text-gray-900">
                                                    When should we cancel your subscription?
                                                </h4>

                                                <div className="space-y-3">
                                                    <label className={cn(
                                                        'flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50',
                                                        cancelAtPeriodEnd 
                                                            ? 'border-primary-500 bg-primary-50' 
                                                            : 'border-gray-200'
                                                    )}>
                                                        <input
                                                            type="radio"
                                                            name="cancelTiming"
                                                            checked={cancelAtPeriodEnd}
                                                            onChange={() => setCancelAtPeriodEnd(true)}
                                                            className="mt-0.5 text-primary-600"
                                                        />
                                                        <div className="space-y-1">
                                                            <div className="flex items-center space-x-2">
                                                                <Calendar className="h-4 w-4 text-gray-500" />
                                                                <span className="font-medium text-gray-900">
                                                                    At period end ({formatDate(subscription.currentPeriodEnd)})
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-600">
                                                                Keep access until {formatDate(subscription.currentPeriodEnd)} 
                                                                ({daysRemaining} days remaining). You won't be charged again.
                                                            </p>
                                                        </div>
                                                    </label>

                                                    <label className={cn(
                                                        'flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50',
                                                        !cancelAtPeriodEnd 
                                                            ? 'border-primary-500 bg-primary-50' 
                                                            : 'border-gray-200'
                                                    )}>
                                                        <input
                                                            type="radio"
                                                            name="cancelTiming"
                                                            checked={!cancelAtPeriodEnd}
                                                            onChange={() => setCancelAtPeriodEnd(false)}
                                                            className="mt-0.5 text-primary-600"
                                                        />
                                                        <div className="space-y-1">
                                                            <div className="flex items-center space-x-2">
                                                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                                                                <span className="font-medium text-gray-900">
                                                                    Cancel immediately
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-600">
                                                                Lose access immediately. No refund will be provided for the remaining period.
                                                            </p>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Summary of selected reason */}
                                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                                <h5 className="font-medium text-gray-900 mb-2">
                                                    Cancellation reason:
                                                </h5>
                                                <p className="text-sm text-gray-700">
                                                    {cancellationReasons.find(r => r.id === selectedReason)?.label}
                                                </p>
                                                {feedback && (
                                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                                        <p className="text-sm text-gray-600 italic">
                                                            "{feedback}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* What happens next */}
                                            <div className="space-y-3">
                                                <h5 className="font-medium text-gray-900">
                                                    What happens next:
                                                </h5>
                                                <div className="space-y-2">
                                                    <div className="flex items-start space-x-2">
                                                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                        <span className="text-sm text-gray-700">
                                                            You'll receive a confirmation email
                                                        </span>
                                                    </div>
                                                    <div className="flex items-start space-x-2">
                                                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                        <span className="text-sm text-gray-700">
                                                            {cancelAtPeriodEnd 
                                                                ? `Access continues until ${formatDate(subscription.currentPeriodEnd)}`
                                                                : 'Access ends immediately'
                                                            }
                                                        </span>
                                                    </div>
                                                    <div className="flex items-start space-x-2">
                                                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                        <span className="text-sm text-gray-700">
                                                            You can reactivate anytime from your account
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>

                                {/* Footer with actions */}
                                <div className="border-t border-gray-100 p-6">
                                    <div className="flex items-center justify-between">
                                        {step === 'confirm' && (
                                            <Button
                                                variant="ghost"
                                                onClick={handleBack}
                                                disabled={loading}
                                            >
                                                Back
                                            </Button>
                                        )}
                                        
                                        <div className="flex items-center space-x-3 ml-auto">
                                            <Button
                                                variant="outline"
                                                onClick={onClose}
                                                disabled={loading}
                                            >
                                                Keep Subscription
                                            </Button>
                                            
                                            {step === 'reason' && (
                                                <Button
                                                    variant="primary"
                                                    onClick={handleReasonSubmit}
                                                    disabled={!selectedReason}
                                                >
                                                    Continue
                                                </Button>
                                            )}

                                            {step === 'confirm' && (
                                                <Button
                                                    variant="primary"
                                                    onClick={handleConfirmCancel}
                                                    loading={loading}
                                                >
                                                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                    Cancel Subscription
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    } catch (error) {
        console.error('CancelSubscriptionModal render error:', error);
        return (
            <AnimatePresence>
                {isOpen && (
                    <div 
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                    >
                        <Card className="max-w-md">
                            <CardContent className="text-center py-8">
                                <p className="text-red-600 mb-4">
                                    Unable to load cancellation form. Please try again.
                                </p>
                                <Button onClick={onClose} variant="outline">
                                    Close
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </AnimatePresence>
        );
    }
}