/**
 * Unified Billing & Subscription Page
 * Comprehensive billing and subscription management
 * Consolidates all billing and subscription functionality in one place
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
    AlertCircle, 
    ArrowLeft,
    // CreditCard, // Commented out - used in payment methods (currently disabled)
    FileText,
    // Plus // Commented out - used in payment methods (currently disabled)
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { SubscriptionPlans } from '../components/subscription/SubscriptionPlans';
import { CurrentSubscription } from '../components/subscription/CurrentSubscription';
import { SubscriptionHistory } from '../components/subscription/SubscriptionHistory';
import { CancelSubscriptionModal } from '../components/subscription/CancelSubscriptionModal';
import { CreditBalance } from '../components/subscription/CreditBalance';
import { formatErrorMessage } from '../lib/utils';
import { subscriptionApi } from '../lib/api';
import type { 
    SubscriptionPlan, 
    UserSubscription, 
    AccountCredit,
    BillingTransaction,
    // PaymentMethod, // Commented out - used in payment methods (currently disabled)
    CancelRequest,
    TransactionFilters
} from '../types/subscription';

type ViewMode = 'billing' | 'plans' | 'history' | 'credits'; // 'methods' removed - not needed currently

/**
 * Unified billing and subscription management page
 * @returns BillingPage JSX element
 */
export function BillingPage() {
    try {
        // URL parameters for deep linking
        const [searchParams] = useSearchParams();
        const navigate = useNavigate();
        const viewParam = searchParams.get('view') as ViewMode;
        
        // State management
        const initialView = viewParam && ['billing', 'plans', 'history', 'credits'].includes(viewParam) 
            ? viewParam 
            : 'billing';
        const [currentView, setCurrentView] = React.useState<ViewMode>(initialView);
        const [loading, setLoading] = React.useState(false);
        const [error, setError] = React.useState<string>('');
        
        // Subscription data
        const [plans, setPlans] = React.useState<SubscriptionPlan[]>([]);
        const [currentSubscription, setCurrentSubscription] = React.useState<UserSubscription | null>(null);
        const [credits, setCredits] = React.useState<AccountCredit[]>([]);
        const [totalCreditBalance, setTotalCreditBalance] = React.useState(0);
        
        // Billing data
        const [transactions, setTransactions] = React.useState<BillingTransaction[]>([]);
        const [totalTransactions, setTotalTransactions] = React.useState(0);
        const [currentPage, setCurrentPage] = React.useState(1);
        const [totalPages, setTotalPages] = React.useState(1);
        // Set initial limit based on the current view: 20 for history, 3 for others
        const [filters, setFilters] = React.useState<TransactionFilters>({ 
            page: 1, 
            limit: initialView === 'history' ? 20 : 3 
        });
        // const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]); // Commented out - used in payment methods (currently disabled)
        
        // Modal states
        const [showCancelModal, setShowCancelModal] = React.useState(false);

        // Load initial data
        React.useEffect(() => {
            loadSubscriptionData();
        }, []);

        // Load transactions when filters change
        React.useEffect(() => {
            loadTransactions();
        }, [filters]);

        const loadSubscriptionData = async () => {
            try {
                setLoading(true);
                setError('');

                // Load data in parallel for better performance
                const [plansData, subscriptionData, creditsData] = await Promise.allSettled([
                    subscriptionApi.getPlans(),
                    subscriptionApi.getCurrentSubscription(),
                    subscriptionApi.getCredits()
                ]);

                // Payment methods initialization commented out - feature currently disabled
                // setPaymentMethods([]);

                // Handle plans data with array validation
                if (plansData.status === 'fulfilled') {
                    // API now returns SubscriptionPlan[] directly after transformation
                    const plansValue = Array.isArray(plansData.value) ? plansData.value : [];
                    setPlans(plansValue);
                } else {
                    console.error('Failed to load plans:', plansData.reason);
                    setPlans([]); // Ensure plans is always an array
                }

                // Handle subscription data (can be null if no subscription)
                if (subscriptionData.status === 'fulfilled') {
                    setCurrentSubscription(subscriptionData.value);
                } else {
                    console.error('Failed to load subscription:', subscriptionData.reason);
                    setCurrentSubscription(null);
                }

                // Handle credits data
                if (creditsData.status === 'fulfilled') {
                    setCredits(creditsData.value.credits);
                    setTotalCreditBalance(creditsData.value.totalBalance);
                } else {
                    console.error('Failed to load credits:', creditsData.reason);
                    setCredits([]);
                    setTotalCreditBalance(0);
                }

                // Load transactions with current filters
                await loadTransactions();

            } catch (error) {
                console.error('Failed to load subscription data:', error);
                setError(formatErrorMessage(error));
            } finally {
                setLoading(false);
            }
        };

        const loadTransactions = async () => {
            try {
                setLoading(true);
                
                // Load transactions with current filters
                const transactionsData = await subscriptionApi.getTransactions(filters);
                
                // Successfully loaded transactions
                
                setTransactions(transactionsData.transactions);
                setTotalTransactions(transactionsData.total);
                setCurrentPage(transactionsData.page);
                setTotalPages(Math.ceil(transactionsData.total / (transactionsData.limit || 10)));

            } catch (error) {
                console.error('Failed to load transactions:', error);
                setError(formatErrorMessage(error));
            } finally {
                setLoading(false);
            }
        };

        const handleSelectPlan = async (planId: number) => {
            try {
                // Navigate directly to checkout
                await handleConfirmUpgrade(planId);
            } catch (error) {
                console.error('Plan selection error:', error);
                setError(formatErrorMessage(error));
            }
        };

        const handleUpgrade = () => {
            try {
                // Navigate to plans view instead of showing modal
                handleViewChange('plans');
            } catch (error) {
                console.error('Upgrade initiation error:', error);
                setError(formatErrorMessage(error));
            }
        };


        const handleCancel = (immediate?: boolean) => {
            try {
                if (immediate) {
                    // Handle immediate cancellation without the full modal flow
                    handleImmediateCancel();
                } else {
                    // Show the full cancellation modal with reason collection
                    setShowCancelModal(true);
                }
            } catch (error) {
                console.error('Cancel initiation error:', error);
                setError(formatErrorMessage(error));
            }
        };

        const handleCompletePayment = () => {
            try {
                if (!currentSubscription) {
                    setError('No subscription found to complete payment for.');
                    return;
                }

                // Find the plan for this subscription
                const plan = Array.isArray(plans) ? plans.find(p => (p.code || p.plan_code) === (currentSubscription.plan_code || currentSubscription.planCode)) : undefined;
                
                if (!plan) {
                    setError('Unable to find plan information for payment completion.');
                    return;
                }

                // Navigate to payment page with the plan ID
                navigate(`/payment?planId=${plan.id}&retry=true`);
            } catch (error) {
                console.error('Complete payment error:', error);
                setError(formatErrorMessage(error));
            }
        };

        const handleImmediateCancel = async () => {
            try {
                setLoading(true);
                
                // Call API to cancel subscription immediately
                const cancelRequest: CancelRequest = {
                    reason: 'immediate-cancellation', // Simple reason for immediate cancellation
                    cancelAtPeriodEnd: false
                };
                
                const updatedSubscription = await subscriptionApi.cancelSubscription(cancelRequest);
                
                // Update subscription state
                setCurrentSubscription(updatedSubscription);
                
            } catch (error) {
                console.error('Immediate cancel error:', error);
                setError(formatErrorMessage(error));
            } finally {
                setLoading(false);
            }
        };


        const handleFiltersChange = (newFilters: TransactionFilters) => {
            try {
                setFilters(newFilters);
                setCurrentPage(newFilters.page || 1);
            } catch (error) {
                console.error('Filter change error:', error);
                setError(formatErrorMessage(error));
            }
        };

        const handlePageChange = (page: number) => {
            try {
                handleFiltersChange({ ...filters, page });
            } catch (error) {
                console.error('Page change error:', error);
                setError(formatErrorMessage(error));
            }
        };

        const handleDownloadInvoice = async (transactionId: string) => {
            try {
                const transaction = transactions.find(t => t.id === transactionId);
                if (transaction?.invoiceUrl) {
                    window.open(transaction.invoiceUrl, '_blank');
                } else {
                    // Get invoice URL from API
                    const invoiceUrl = await subscriptionApi.downloadInvoice(transactionId);
                    window.open(invoiceUrl, '_blank');
                }
            } catch (error) {
                console.error('Invoice download error:', error);
                setError(formatErrorMessage(error));
            }
        };

        const handleConfirmUpgrade = async (planId: number) => {
            try {
                setLoading(true);
                const selectedPlan = Array.isArray(plans) ? plans.find(p => p.id === planId) : undefined;
                
                if (!selectedPlan) {
                    throw new Error('Selected plan not found');
                }

                // If it's a free plan, no payment needed - call backend directly  
                // Check if plan is free (transformed price field is 0 or null)
                const isFree = (selectedPlan.price === 0 || selectedPlan.price === null);
                
                if (isFree) {
                    if (currentSubscription) {
                        // Upgrade/downgrade to free plan via upgrade endpoint
                        const upgradeResponse = await subscriptionApi.updateSubscription({ planId });
                        setCurrentSubscription(upgradeResponse.subscription);
                    } else {
                        // Create new free subscription directly via create endpoint
                        await subscriptionApi.createPaymentIntent({
                            planId,
                            paymentMethod: 'free',
                            savePaymentMethod: false
                        });
                        
                        // For free plans, subscription is created immediately
                        const newSubscription = await subscriptionApi.getCurrentSubscription();
                        setCurrentSubscription(newSubscription);
                    }
                    
                    // Reload subscription data to get latest state
                    await loadSubscriptionData();
                    return;
                }

                // For paid plans, redirect to payment page
                navigate(`/payment?planId=${selectedPlan.id}`);

            } catch (error) {
                console.error('Upgrade confirmation error:', error);
                setError(formatErrorMessage(error));
            } finally {
                setLoading(false);
            }
        };

        const handleConfirmCancel = async (request: CancelRequest) => {
            try {
                setLoading(true);
                
                // Call API to cancel subscription
                const updatedSubscription = await subscriptionApi.cancelSubscription(request);
                
                // Update subscription state
                setCurrentSubscription(updatedSubscription);
                
                setShowCancelModal(false);

            } catch (error) {
                console.error('Cancel confirmation error:', error);
                setError(formatErrorMessage(error));
            } finally {
                setLoading(false);
            }
        };


        const handleViewChange = (view: ViewMode) => {
            try {
                setCurrentView(view);
                
                // Set appropriate limit based on view
                const newLimit = view === 'history' ? 20 : 3;
                setFilters(prevFilters => ({ 
                    ...prevFilters, 
                    limit: newLimit, 
                    page: 1 // Reset to first page when changing views
                }));
                
                // Update URL without triggering a full page reload
                if (view === 'billing') {
                    navigate('/billing', { replace: true });
                } else {
                    navigate(`/billing?view=${view}`, { replace: true });
                }
            } catch (error) {
                console.error('View change error:', error);
            }
        };

        const handleBackNavigation = () => {
            try {
                if (currentView === 'plans') {
                    // If on plans, go back to billing
                    handleViewChange('billing');
                } else {
                    // Default: go back to dashboard
                    navigate('/dashboard');
                }
            } catch (error) {
                console.error('Back navigation error:', error);
                // Fallback to browser history
                window.history.back();
            }
        };

        const handleApplyCredits = async () => {
            try {
                setLoading(true);
                
                // Call API to apply credits
                await subscriptionApi.applyCredits();
                
                // Reload credits data to get updated state
                const creditsData = await subscriptionApi.getCredits();
                setCredits(creditsData.credits);
                setTotalCreditBalance(creditsData.totalBalance);

            } catch (error) {
                console.error('Apply credits error:', error);
                setError(formatErrorMessage(error));
            } finally {
                setLoading(false);
            }
        };

        // Payment Methods component - Commented out as it serves no purpose currently
        // May be used later, so preserving the implementation
        /*
        const renderPaymentMethods = () => {
            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Payment Methods
                            </h2>
                            <p className="text-gray-600 mt-1">
                                Manage your saved payment methods
                            </p>
                        </div>
                        <Button
                            variant="primary"
                            onClick={() => {}}
                            className="flex items-center space-x-2"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Add Method</span>
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {paymentMethods.length === 0 ? (
                            <Card>
                                <CardContent className="text-center py-8">
                                    <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                                        No Payment Methods
                                    </h3>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Add a payment method to manage your subscriptions.
                                    </p>
                                    <Button variant="primary">
                                        Add Payment Method
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            paymentMethods.map((method) => (
                                <Card key={method.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <div className="p-2 bg-gray-100 rounded-lg">
                                                    <CreditCard className="h-5 w-5 text-gray-600" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center space-x-2">
                                                        <span className="font-medium text-gray-900">
                                                            {method.brand?.toUpperCase()} ****{method.last4}
                                                        </span>
                                                        {method.isDefault && (
                                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                                                Default
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600">
                                                        Expires {method.expiryMonth}/{method.expiryYear}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                {!method.isDefault && (
                                                    <Button variant="ghost" size="sm">
                                                        Set as Default
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="text-red-600">
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            );
        };
        */

        const renderContent = () => {
            switch (currentView) {
                case 'plans':
                    return (
                        <SubscriptionPlans
                            plans={plans}
                            currentSubscription={currentSubscription}
                            onSelectPlan={handleSelectPlan}
                            loading={loading}
                        />
                    );

                case 'billing':
                    return (
                        <div className="space-y-8">
                            {/* Current subscription */}
                            <CurrentSubscription
                                subscription={currentSubscription}
                                onUpgrade={handleUpgrade}
                                onCancel={handleCancel}
                                onCompletePayment={handleCompletePayment}
                                loading={loading}
                            />

                            {/* Credits */}
                            {totalCreditBalance > 0 && (
                                <CreditBalance
                                    credits={credits}
                                    totalBalance={totalCreditBalance / 100}
                                    currency="INR"
                                    onApplyCredits={handleApplyCredits}
                                    loading={loading}
                                />
                            )}

                            {/* Recent transactions */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center space-x-2">
                                            <FileText className="h-5 w-5" />
                                            <span>Recent Transactions</span>
                                        </CardTitle>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleViewChange('history')}
                                            className="cursor-pointer"
                                        >
                                            View All
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <SubscriptionHistory
                                        transactions={transactions.slice(0, 3)}
                                        totalTransactions={Math.min(totalTransactions, 3)}
                                        currentPage={1}
                                        totalPages={1}
                                        filters={{ ...filters, limit: 3 }}
                                        onFiltersChange={(newFilters) => {
                                            // For recent transactions, we want to apply filters but keep limit at 3
                                            const updatedFilters = { ...newFilters, limit: 3, page: 1 };
                                            handleFiltersChange(updatedFilters);
                                        }}
                                        onPageChange={() => {
                                            // For recent transactions, redirect to full history instead of pagination
                                            handleViewChange('history');
                                        }}
                                        onDownloadInvoice={handleDownloadInvoice}
                                        loading={loading}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    );

                case 'history':
                    return (
                        <SubscriptionHistory
                            transactions={transactions}
                            totalTransactions={totalTransactions}
                            currentPage={currentPage}
                            totalPages={totalPages}
                            filters={filters}
                            onFiltersChange={handleFiltersChange}
                            onPageChange={handlePageChange}
                            onDownloadInvoice={handleDownloadInvoice}
                            loading={loading}
                        />
                    );

                // Payment Methods view - Commented out as it serves no purpose currently
                // case 'methods':
                //     return renderPaymentMethods();

                case 'credits':
                    return (
                        <CreditBalance
                            credits={credits}
                            totalBalance={totalCreditBalance / 100}
                            currency="INR"
                            onApplyCredits={handleApplyCredits}
                            loading={loading}
                        />
                    );

                default:
                    return (
                        <div className="space-y-8">
                            <CurrentSubscription
                                subscription={currentSubscription}
                                onUpgrade={handleUpgrade}
                                onCancel={handleCancel}
                                onCompletePayment={handleCompletePayment}
                                loading={loading}
                            />

                            {totalCreditBalance > 0 && (
                                <CreditBalance
                                    credits={credits}
                                    totalBalance={totalCreditBalance / 100}
                                    currency="INR"
                                    onApplyCredits={handleApplyCredits}
                                    loading={loading}
                                />
                            )}

                            <SubscriptionPlans
                                plans={plans}
                                currentSubscription={currentSubscription}
                                onSelectPlan={handleSelectPlan}
                                loading={loading}
                            />
                        </div>
                    );
            }
        };

        if (loading && !plans.length) {
            return (
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto" />
                        <p className="text-gray-600">Loading subscription information...</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        {/* Desktop layout: side by side (default) */}
                        <div className="hidden sm:flex items-center justify-between">
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
                                        {currentView === 'billing' ? 'Billing & Payments' :
                                         currentView === 'plans' ? 'Subscription Plans' :
                                         currentView === 'history' ? 'Billing History' :
                                         currentView === 'credits' ? 'Account Credits' :
                                         'Billing & Payments'}
                                    </h1>
                                    <p className="text-gray-600 mt-1">
                                        {currentView === 'billing' ? 'View your current subscription and recent transactions' :
                                         currentView === 'plans' ? 'Choose the perfect plan for your needs' :
                                         currentView === 'history' ? 'Review your complete billing and transaction history' :
                                         currentView === 'credits' ? 'View and manage your account credits and balances' :
                                         'Manage your billing, subscription plans, and account credits'}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Navigation tabs */}
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant={currentView === 'billing' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleViewChange('billing')}
                                    className="cursor-pointer"
                                >
                                    Billing
                                </Button>
                                <Button
                                    variant={currentView === 'plans' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleViewChange('plans')}
                                    className="cursor-pointer"
                                >
                                    Plans
                                </Button>
                                <Button
                                    variant={currentView === 'history' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleViewChange('history')}
                                    className="cursor-pointer"
                                >
                                    History
                                </Button>
                                {/* Payment Methods Tab - Commented out as it serves no purpose currently
                                <Button
                                    variant={currentView === 'methods' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleViewChange('methods')}
                                    className="flex items-center space-x-1 cursor-pointer"
                                >
                                    <CreditCard className="h-4 w-4" />
                                    <span>Payment Methods</span>
                                </Button>
                                */}
                                {totalCreditBalance > 0 && (
                                    <Button
                                        variant={currentView === 'credits' ? 'primary' : 'ghost'}
                                        size="sm"
                                        onClick={() => handleViewChange('credits')}
                                        className="cursor-pointer"
                                    >
                                        Credits
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Mobile layout: stacked */}
                        <div className="sm:hidden space-y-4">
                            {/* Top row: Title and Back button */}
                            <div className="flex items-start space-x-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBackNavigation}
                                    className="flex items-center space-x-1 min-h-[44px] cursor-pointer flex-shrink-0 mt-1"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    <span>Back</span>
                                </Button>
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-lg font-bold text-gray-900 leading-tight">
                                        {currentView === 'billing' ? 'Billing & Payments' :
                                         currentView === 'plans' ? 'Subscription Plans' :
                                         currentView === 'history' ? 'Billing History' :
                                         currentView === 'credits' ? 'Account Credits' :
                                         'Billing & Payments'}
                                    </h1>
                                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                                        {currentView === 'billing' ? 'View your current subscription and recent transactions' :
                                         currentView === 'plans' ? 'Choose the perfect plan for your needs' :
                                         currentView === 'history' ? 'Review your complete billing and transaction history' :
                                         currentView === 'credits' ? 'View and manage your account credits and balances' :
                                         'Manage your billing, subscription plans, and account credits'}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Bottom row: Navigation tabs - optimized for mobile touch */}
                            <div className="flex items-center justify-between space-x-1 px-2">
                                <Button
                                    variant={currentView === 'billing' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleViewChange('billing')}
                                    className="text-sm px-3 py-2 min-h-[44px] cursor-pointer flex-1"
                                >
                                    Billing
                                </Button>
                                <Button
                                    variant={currentView === 'plans' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleViewChange('plans')}
                                    className="text-sm px-3 py-2 min-h-[44px] cursor-pointer flex-1"
                                >
                                    Plans
                                </Button>
                                <Button
                                    variant={currentView === 'history' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleViewChange('history')}
                                    className="text-sm px-3 py-2 min-h-[44px] cursor-pointer flex-1"
                                >
                                    History
                                </Button>
                                {/* Payment Methods Tab - Commented out as it serves no purpose currently
                                <Button
                                    variant={currentView === 'methods' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleViewChange('methods')}
                                    className="flex items-center space-x-1 text-sm px-3 py-2 min-h-[44px] cursor-pointer"
                                >
                                    <CreditCard className="h-4 w-4" />
                                    <span>Payment Methods</span>
                                </Button>
                                */}
                                {totalCreditBalance > 0 && (
                                    <Button
                                        variant={currentView === 'credits' ? 'primary' : 'ghost'}
                                        size="sm"
                                        onClick={() => handleViewChange('credits')}
                                        className="text-sm px-3 py-2 min-h-[44px] cursor-pointer flex-1"
                                    >
                                        Credits
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Error display */}
                    {error && (
                        <div className="mb-6">
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
                        </div>
                    )}

                    {/* Main content */}
                    <motion.div
                        key={currentView}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {renderContent()}
                    </motion.div>

                    {/* Modals */}

                    {currentSubscription && (
                        <CancelSubscriptionModal
                            isOpen={showCancelModal}
                            onClose={() => setShowCancelModal(false)}
                            subscription={currentSubscription}
                            onConfirmCancel={handleConfirmCancel}
                            loading={loading}
                        />
                    )}
                </div>
            </div>
        );
    } catch (error) {
        console.error('SubscriptionPage render error:', error);
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="max-w-md">
                    <CardContent className="text-center py-8">
                        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Unable to load the subscription page. Please refresh and try again.
                        </p>
                        <Button
                            onClick={() => window.location.reload()}
                            variant="primary"
                        >
                            Refresh Page
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }
}