/**
 * Upgrade Modal component
 * Modal for upgrading or changing subscription plans with payment integration
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    Check, 
    CreditCard, 
    Zap, 
    Star, 
    Crown, 
    ArrowRight,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { cn } from '../../lib/utils';
import type { SubscriptionPlan, UserSubscription } from '../../types/subscription';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    plans: SubscriptionPlan[];
    currentSubscription?: UserSubscription | null;
    selectedPlanId?: number;
    onSelectPlan: (planId: number) => void;
    onConfirmUpgrade: (planId: number) => Promise<void>;
    loading?: boolean;
}

const planIcons = {
    free: <Zap className="h-5 w-5" />,
    pro: <Star className="h-5 w-5" />,
    plus: <Crown className="h-5 w-5" />,
};

/**
 * Modal for plan upgrades and changes
 * @param isOpen - Modal visibility state
 * @param onClose - Handler to close modal
 * @param plans - Available subscription plans
 * @param currentSubscription - User's current subscription
 * @param selectedPlanId - Currently selected plan ID
 * @param onSelectPlan - Handler for plan selection
 * @param onConfirmUpgrade - Handler for upgrade confirmation
 * @param loading - Loading state
 * @returns UpgradeModal JSX element
 */
export function UpgradeModal({
    isOpen,
    onClose,
    plans,
    currentSubscription,
    selectedPlanId,
    onSelectPlan,
    onConfirmUpgrade,
    loading = false,
}: UpgradeModalProps) {
    try {
        const [step, setStep] = React.useState<'select' | 'confirm'>('select');
        
        // Ensure plans is always an array to prevent TypeError
        const safePlans = Array.isArray(plans) ? plans : [];
        
        const selectedPlan = safePlans.find(plan => plan?.id === selectedPlanId);
        const currentPlan = currentSubscription?.plan;
        const selectedPrice = selectedPlan?.price ?? 0;
        const currentPrice = currentPlan?.price ?? 0;
        const isUpgrade = selectedPlan && currentPlan && selectedPrice > currentPrice;
        const isDowngrade = selectedPlan && currentPlan && selectedPrice < currentPrice;
        const isSamePlan = selectedPlan?.id === currentPlan?.id;

        // Reset step when modal opens/closes
        React.useEffect(() => {
            if (isOpen) {
                setStep('select');
            }
        }, [isOpen]);

        const handlePlanSelect = (planId: number) => {
            try {
                if (!planId || typeof planId !== 'number') {
                    console.error('Invalid plan ID provided:', planId);
                    return;
                }
                onSelectPlan(planId);
                setStep('confirm');
            } catch (error) {
                console.error('Plan selection error:', error);
            }
        };

        const handleConfirm = async () => {
            try {
                if (!selectedPlanId) return;
                await onConfirmUpgrade(selectedPlanId);
                onClose();
            } catch (error) {
                console.error('Upgrade confirmation error:', error);
            }
        };

        // Early return if no plans available
        if (!safePlans.length) {
            return (
                <AnimatePresence>
                    {isOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                            <Card className="max-w-md">
                                <CardContent className="text-center py-8">
                                    <p className="text-gray-600 mb-4">
                                        No subscription plans available at the moment. Please try again later.
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

        const handleBack = () => {
            try {
                setStep('select');
            } catch (error) {
                console.error('Back navigation error:', error);
            }
        };

        const getActionText = (): string => {
            if (!selectedPlan || !currentPlan) return 'Choose Plan';
            if (isUpgrade) return 'Upgrade Now';
            if (isDowngrade) return 'Downgrade';
            return 'Switch Plan';
        };

        const getComparisonText = (): string => {
            if (!selectedPlan || !currentPlan) return '';
            if (isUpgrade) return `Upgrade from ${currentPlan.displayName} to ${selectedPlan.displayName}`;
            if (isDowngrade) return `Downgrade from ${currentPlan.displayName} to ${selectedPlan.displayName}`;
            return `Switch to ${selectedPlan.displayName}`;
        };

        const sortedPlans = [...safePlans].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

        return (
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
                        onClick={onClose}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
                        >
                            <Card className="shadow-2xl">
                                <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100">
                                    <CardTitle className="flex items-center space-x-2">
                                        <CreditCard className="h-5 w-5" />
                                        <span>
                                            {step === 'select' ? 'Choose Your Plan' : 'Confirm Plan Change'}
                                        </span>
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
                                    {step === 'select' && (
                                        <div className="space-y-6">
                                            {/* Current plan info */}
                                            {currentPlan && (
                                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="p-1 bg-blue-100 rounded">
                                                            {planIcons[currentPlan.name as keyof typeof planIcons]}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-blue-900">
                                                                Current Plan: {currentPlan.displayName}
                                                            </p>
                                                            <p className="text-xs text-blue-700">
                                                                ₹{(currentPlan.price ?? 0) === 0 ? '0' : ((currentPlan.price ?? 0) / 100).toFixed(0)} per {currentPlan.interval}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Plan selection */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {sortedPlans.map((plan) => {
                                                    if (!plan || !plan.id) return null;
                                                    const isCurrentPlan = currentPlan?.id === plan.id;
                                                    
                                                    return (
                                                        <motion.div
                                                            key={plan.id}
                                                            whileHover={{ scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                        >
                                                            <Card
                                                                className={cn(
                                                                    'cursor-pointer transition-all duration-200 hover:shadow-md',
                                                                    isCurrentPlan && 'ring-2 ring-blue-500 ring-opacity-30',
                                                                    plan.isPopular && 'ring-2 ring-purple-500 ring-opacity-30'
                                                                )}
                                                                onClick={() => !isCurrentPlan && handlePlanSelect(plan.id)}
                                                            >
                                                                {plan.isPopular && (
                                                                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                                                                        <div className="bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                                                                            Popular
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <CardHeader className="text-center pb-2">
                                                                    <div className="flex items-center justify-center space-x-2 mb-2">
                                                                        <div className={cn(
                                                                            'p-2 rounded-lg',
                                                                            plan.name === 'free' && 'bg-gray-100 text-gray-600',
                                                                            plan.name === 'pro' && 'bg-blue-100 text-blue-600',
                                                                            plan.name === 'plus' && 'bg-purple-100 text-purple-600'
                                                                        )}>
                                                                            {planIcons[plan.name as keyof typeof planIcons]}
                                                                        </div>
                                                                        <h3 className="font-semibold text-gray-900">
                                                                            {plan.displayName}
                                                                        </h3>
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <div className="flex items-baseline justify-center space-x-1">
                                                                            <span className="text-sm text-gray-500">₹</span>
                                                                            <span className="text-2xl font-bold text-gray-900">
                                                                                {plan.price === 0 ? '0' : ((plan.price ?? 0) / 100).toFixed(0)}
                                                                            </span>
                                                                            <span className="text-sm text-gray-500">
                                                                                /{plan.interval}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </CardHeader>

                                                                <CardContent className="space-y-3">
                                                                    <p className="text-xs text-gray-600 text-center">
                                                                        {plan.description}
                                                                    </p>

                                                                    <div className="space-y-2">
                                                                        {Array.isArray(plan.features) ? plan.features.slice(0, 3).map((feature, index) => (
                                                                            <div key={index} className="flex items-start space-x-2">
                                                                                <Check className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                                                                                <span className="text-xs text-gray-700">
                                                                                    {feature || 'Feature not available'}
                                                                                </span>
                                                                            </div>
                                                                        )) : (
                                                                            <div className="flex items-start space-x-2">
                                                                                <Check className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                                                                                <span className="text-xs text-gray-700">
                                                                                    No features listed
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {Array.isArray(plan.features) && plan.features.length > 3 && (
                                                                            <p className="text-xs text-gray-500 text-center">
                                                                                +{plan.features.length - 3} more features
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    {isCurrentPlan && (
                                                                        <div className="text-center">
                                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                                Current Plan
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </CardContent>
                                                            </Card>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {step === 'confirm' && selectedPlan && (
                                        <div className="space-y-6">
                                            {/* Plan comparison */}
                                            <div className="text-center space-y-4">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {getComparisonText()}
                                                </h3>
                                                
                                                <div className="flex items-center justify-center space-x-8">
                                                    {/* Current plan */}
                                                    {currentPlan && (
                                                        <div className="text-center">
                                                            <div className="p-3 bg-gray-100 rounded-lg mb-2">
                                                                {planIcons[currentPlan.name as keyof typeof planIcons]}
                                                            </div>
                                                            <p className="font-medium text-gray-900">
                                                                {currentPlan.displayName}
                                                            </p>
                                                            <p className="text-sm text-gray-600">
                                                                ₹{(currentPlan.price ?? 0) === 0 ? '0' : ((currentPlan.price ?? 0) / 100).toFixed(0)}/{currentPlan.interval}
                                                            </p>
                                                        </div>
                                                    )}

                                                    <ArrowRight className="h-6 w-6 text-gray-400" />

                                                    {/* New plan */}
                                                    <div className="text-center">
                                                        <div className={cn(
                                                            'p-3 rounded-lg mb-2',
                                                            selectedPlan.name === 'free' && 'bg-gray-100',
                                                            selectedPlan.name === 'pro' && 'bg-blue-100',
                                                            selectedPlan.name === 'plus' && 'bg-purple-100'
                                                        )}>
                                                            {planIcons[selectedPlan.name as keyof typeof planIcons]}
                                                        </div>
                                                        <p className="font-medium text-gray-900">
                                                            {selectedPlan.displayName}
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            ₹{(selectedPlan.price ?? 0) === 0 ? '0' : ((selectedPlan.price ?? 0) / 100).toFixed(0)}/{selectedPlan.interval}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Billing information */}
                                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                                <h4 className="font-medium text-gray-900 mb-3">
                                                    Billing Information
                                                </h4>
                                                <div className="space-y-2 text-sm">
                                                    {isUpgrade && (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">
                                                                    New plan price:
                                                                </span>
                                                                <span className="font-medium">
                                                                    ₹{(selectedPlan.price ?? 0) === 0 ? '0' : ((selectedPlan.price ?? 0) / 100).toFixed(0)}/{selectedPlan.interval}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">
                                                                    Prorated amount:
                                                                </span>
                                                                <span className="font-medium">
                                                                    Calculated at checkout
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                    {isDowngrade && (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">
                                                                    New plan price:
                                                                </span>
                                                                <span className="font-medium">
                                                                    ₹{(selectedPlan.price ?? 0) === 0 ? '0' : ((selectedPlan.price ?? 0) / 100).toFixed(0)}/{selectedPlan.interval}
                                                                </span>
                                                            </div>
                                                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mt-3">
                                                                <div className="flex items-start space-x-2">
                                                                    <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                                                    <div className="text-xs text-blue-800">
                                                                        <p className="font-medium mb-1">Downgrade Terms</p>
                                                                        <p>
                                                                            Your plan will change at the end of your current billing period. 
                                                                            Any unused credits will be added to your account.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                    <div className="flex justify-between pt-2 border-t border-gray-200">
                                                        <span className="text-gray-600">
                                                            Effective date:
                                                        </span>
                                                        <span className="font-medium">
                                                            {isUpgrade ? 'Immediate' : 'Next billing cycle'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Feature comparison */}
                                            {/* Feature comparison */}
                                            <div className="space-y-3">
                                                <h4 className="font-medium text-gray-900">
                                                    What you'll get:
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {Array.isArray(selectedPlan.features) ? selectedPlan.features.map((feature, index) => (
                                                        <div key={index} className="flex items-start space-x-2">
                                                            <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                            <span className="text-sm text-gray-700">
                                                                {feature || 'Feature not available'}
                                                            </span>
                                                        </div>
                                                    )) : (
                                                        <div className="flex items-start space-x-2">
                                                            <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                            <span className="text-sm text-gray-700">
                                                                No features listed for this plan
                                                            </span>
                                                        </div>
                                                    )}
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
                                                Back to Plans
                                            </Button>
                                        )}
                                        
                                        <div className="flex items-center space-x-3 ml-auto">
                                            <Button
                                                variant="outline"
                                                onClick={onClose}
                                                disabled={loading}
                                            >
                                                Cancel
                                            </Button>
                                            
                                            {step === 'confirm' && (
                                                <Button
                                                    variant="primary"
                                                    onClick={handleConfirm}
                                                    loading={loading}
                                                    disabled={isSamePlan}
                                                >
                                                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                    {getActionText()}
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
        console.error('UpgradeModal render error:', error);
        return (
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                        <Card className="max-w-md">
                            <CardContent className="text-center py-8">
                                <p className="text-error-600 mb-4">
                                    Unable to load upgrade options. Please try again.
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