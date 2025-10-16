/**
 * Subscription Plans component with Notion-inspired pricing cards
 * Displays all available subscription plans with features and pricing
 */

import { motion } from 'framer-motion';
import { Check, Star, Zap, Crown } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { cn } from '../../lib/utils';
import type { SubscriptionPlan, UserSubscription } from '../../types/subscription';

interface SubscriptionPlansProps {
    plans: SubscriptionPlan[];
    currentSubscription?: UserSubscription | null;
    onSelectPlan: (planId: number) => void;
    loading?: boolean;
    disabled?: boolean;
}

const planIcons = {
    free: <Zap className="h-5 w-5" />,
    pro: <Star className="h-5 w-5" />,
    plus: <Crown className="h-5 w-5" />,
};

/**
 * Subscription plans pricing component
 * @param plans - Available subscription plans
 * @param currentSubscription - User's current subscription
 * @param onSelectPlan - Handler for plan selection
 * @param loading - Loading state
 * @param disabled - Disabled state
 * @returns SubscriptionPlans JSX element
 */
export function SubscriptionPlans({
    plans,
    currentSubscription,
    onSelectPlan,
    loading = false,
    disabled = false,
}: SubscriptionPlansProps) {
    try {
        const sortedPlans = [...plans].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        
        const isCurrentPlan = (plan: SubscriptionPlan): boolean => {
            if (!currentSubscription || currentSubscription.status !== 'active') {
                return false;
            }
            
            // Compare by plan_code first (preferred), then fall back to planId
            if (currentSubscription.planCode && plan.plan_code) {
                return currentSubscription.planCode === plan.plan_code;
            }
            
            // Legacy comparison by ID
            return currentSubscription.planId === plan.id;
        };

        const getButtonText = (plan: SubscriptionPlan): string => {
            if (isCurrentPlan(plan)) {
                return 'Current Plan';
            }
            if (plan.price === 0) {
                return 'Get Started';
            }
            if (currentSubscription && (currentSubscription.plan.price ?? 0) < (plan.price ?? 0)) {
                return 'Upgrade';
            }
            if (currentSubscription && (currentSubscription.plan.price ?? 0) > (plan.price ?? 0)) {
                return 'Downgrade';
            }
            return 'Choose Plan';
        };

        const getButtonVariant = (plan: SubscriptionPlan): 'primary' | 'secondary' | 'outline' => {
            if (isCurrentPlan(plan)) {
                return 'outline';
            }
            if (plan.isPopular) {
                return 'primary';
            }
            return 'outline';
        };

        return (
            <div className="space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-semibold text-gray-900">
                        Choose Your Plan
                    </h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                        Select the perfect plan for your needs. Upgrade or downgrade at any time.
                    </p>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {sortedPlans.map((plan, index) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="relative"
                        >
                            {/* Popular badge */}
                            {plan.isPopular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                                        Most Popular
                                    </div>
                                </div>
                            )}

                            <Card
                                variant={plan.isPopular ? 'elevated' : 'bordered'}
                                className={cn(
                                    'relative h-full transition-all duration-300 hover:shadow-lg',
                                    plan.isPopular && 'ring-2 ring-blue-500 ring-opacity-20',
                                    isCurrentPlan(plan) && 'ring-2 ring-green-500 ring-opacity-30'
                                )}
                            >
                                <CardHeader className="text-center">
                                    {/* Plan icon and name */}
                                    <div className="flex items-center justify-center space-x-2 mb-2">
                                        <div className={cn(
                                            'p-2 rounded-lg',
                                            plan.name === 'free' && 'bg-gray-100 text-gray-600',
                                            plan.name === 'pro' && 'bg-blue-100 text-blue-600',
                                            plan.name === 'plus' && 'bg-purple-100 text-purple-600'
                                        )}>
                                            {planIcons[plan.name as keyof typeof planIcons] || <Zap className="h-5 w-5" />}
                                        </div>
                                        <h3 className="text-xl font-semibold text-gray-900">
                                            {plan.displayName}
                                        </h3>
                                    </div>

                                    {/* Price */}
                                    <div className="space-y-1">
                                        <div className="flex items-baseline justify-center space-x-1">
                                            <span className="text-sm text-gray-500">₹</span>
                                            <span className="text-4xl font-bold text-gray-900">
                                                {plan.price === 0 ? '0' : ((plan.price ?? 0) / 100).toFixed(0)}
                                            </span>
                                            <span className="text-sm text-gray-500">
                                                /{plan.interval}
                                            </span>
                                        </div>
                                        {(plan.price ?? 0) > 0 && (
                                            <p className="text-xs text-gray-500">
                                                Billed {plan.interval}ly
                                            </p>
                                        )}
                                    </div>

                                    {/* Description */}
                                    <p className="text-sm text-gray-600 mt-2">
                                        {plan.description}
                                    </p>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    {/* Features */}
                                    <div className="space-y-3">
                                        {plan.features.map((feature, featureIndex) => (
                                            <div key={featureIndex} className="flex items-start space-x-3">
                                                <div className="flex-shrink-0 mt-0.5">
                                                    <Check className="h-4 w-4 text-green-500" />
                                                </div>
                                                <span className="text-sm text-gray-700">
                                                    {feature}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Plan limits */}
                                    {(plan.maxUsers || plan.maxProjects || plan.storage) && (
                                        <div className="pt-4 border-t border-gray-100 space-y-2">
                                            {plan.maxUsers && (
                                                <div className="flex justify-between text-xs text-gray-600">
                                                    <span>Users:</span>
                                                    <span className="font-medium">
                                                        {plan.maxUsers === -1 ? 'Unlimited' : plan.maxUsers}
                                                    </span>
                                                </div>
                                            )}
                                            {plan.maxProjects && (
                                                <div className="flex justify-between text-xs text-gray-600">
                                                    <span>Projects:</span>
                                                    <span className="font-medium">
                                                        {plan.maxProjects === -1 ? 'Unlimited' : plan.maxProjects}
                                                    </span>
                                                </div>
                                            )}
                                            {plan.storage && (
                                                <div className="flex justify-between text-xs text-gray-600">
                                                    <span>Storage:</span>
                                                    <span className="font-medium">{plan.storage}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Action button or current plan indicator */}
                                    <div className="pt-4">
                                        {isCurrentPlan(plan) ? (
                                            <div className="text-center">
                                                <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-800 w-full justify-center">
                                                    <Check className="h-4 w-4 mr-2" />
                                                    Current Plan
                                                </span>
                                            </div>
                                        ) : plan.price === 0 ? (
                                            // Free plan - no button needed since users can cancel to get to free
                                            <div className="text-center">
                                                <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 w-full justify-center">
                                                    Free Plan
                                                </span>
                                            </div>
                                        ) : (
                                            <Button
                                                variant={getButtonVariant(plan)}
                                                fullWidth
                                                onClick={() => onSelectPlan(plan.id)}
                                                disabled={disabled || loading}
                                                loading={loading}
                                            >
                                                {getButtonText(plan)}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Additional info */}
                <div className="text-center space-y-2 max-w-2xl mx-auto">
                    <p className="text-sm text-gray-600">
                        All plans include 14-day free trial • No setup fees • Cancel anytime
                    </p>
                    <p className="text-xs text-gray-500">
                        Prices are in Indian Rupees (INR) and exclude applicable taxes.
                    </p>
                </div>
            </div>
        );
    } catch (error) {
        console.error('SubscriptionPlans render error:', error);
        return (
            <div className="text-center space-y-4 p-8">
                <p className="text-error-600">
                    Unable to load subscription plans. Please refresh the page and try again.
                </p>
                <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                >
                    Refresh Page
                </Button>
            </div>
        );
    }
}