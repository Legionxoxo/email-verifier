/**
 * Immediate Cancel Modal component
 * Simple confirmation modal for immediate subscription cancellation
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface ImmediateCancelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    loading?: boolean;
    planName?: string;
    currentPeriodEnd?: string;
}

/**
 * Simple modal for immediate subscription cancellation confirmation
 * @param isOpen - Modal visibility state
 * @param onClose - Handler to close modal
 * @param onConfirm - Handler for immediate cancellation confirmation
 * @param loading - Loading state
 * @param planName - Current plan name
 * @param currentPeriodEnd - Current period end date
 * @returns ImmediateCancelModal JSX element
 */
export function ImmediateCancelModal({
    isOpen,
    onClose,
    onConfirm,
    loading = false,
    planName,
    currentPeriodEnd,
}: ImmediateCancelModalProps) {
    try {
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

        const handleConfirm = async () => {
            try {
                await onConfirm();
                onClose();
            } catch (error) {
                console.error('Immediate cancel confirmation error:', error);
            }
        };

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
                            className="w-full max-w-md"
                        >
                            <Card className="shadow-2xl">
                                <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100">
                                    <CardTitle className="flex items-center space-x-2">
                                        <AlertTriangle className="h-5 w-5 text-red-600" />
                                        <span>Cancel Immediately</span>
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
                                    <div className="space-y-4">
                                        {/* Warning message */}
                                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                            <div className="flex items-start space-x-3">
                                                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                <div className="space-y-2">
                                                    <h4 className="font-medium text-red-900">
                                                        You'll lose access immediately
                                                    </h4>
                                                    <p className="text-sm text-red-800">
                                                        Are you sure you want to cancel your {planName} subscription right now? 
                                                        You'll lose access to all premium features immediately and won't receive 
                                                        a refund for the remaining time until {currentPeriodEnd ? formatDate(currentPeriodEnd) : 'the end of your billing period'}.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Info message */}
                                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <p className="text-sm text-blue-800">
                                                <strong>Alternative:</strong> If you don't need immediate cancellation, 
                                                your subscription is already scheduled to cancel at the end of your billing period, 
                                                allowing you to keep access until then.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>

                                {/* Footer with actions */}
                                <div className="border-t border-gray-100 p-6">
                                    <div className="flex items-center justify-end space-x-3">
                                        <Button
                                            variant="outline"
                                            onClick={onClose}
                                            disabled={loading}
                                        >
                                            No, keep until period end
                                        </Button>
                                        
                                        <Button
                                            variant="primary"
                                            onClick={handleConfirm}
                                            disabled={loading}
                                        >
                                            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Yes, cancel immediately
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    } catch (error) {
        console.error('ImmediateCancelModal render error:', error);
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
                                    Unable to load cancellation dialog. Please try again.
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