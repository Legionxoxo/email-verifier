/**
 * Centralized mock data for subscription system
 * Ensures consistent subscription state across all components
 */

import type { 
    SubscriptionPlan, 
    UserSubscription, 
    BillingTransaction, 
    AccountCredit,
    PaymentMethod
} from '../types/subscription';

// Consistent subscription plans
export const mockPlans: SubscriptionPlan[] = [
    {
        id: 1,
        name: 'Free',
        displayName: 'Free',
        description: 'Perfect for getting started',
        price_monthly: 0,
        price_yearly: 0,
        price_currency: 'INR',
        features: [
            'Up to 3 projects',
            '1 team member',
            '1GB storage',
            'Basic support'
        ],
        limits: {
            users: 1,
            projects: 3,
            storage_gb: 1
        },
        plan_code: 'free',
        trial_days: 0,
        is_featured: false,
        // Legacy compatibility
        price: 0,
        currency: 'INR',
        interval: 'month',
        maxUsers: 1,
        maxProjects: 3,
        storage: '1GB'
    },
    {
        id: 2,
        name: 'Pro',
        displayName: 'Pro',
        description: 'Best for small teams',
        price_monthly: 99900, // ₹999 in paisa
        price_yearly: 999900, // ₹9999 in paisa (2 months free)
        price_currency: 'INR',
        features: [
            'Unlimited projects',
            'Up to 10 team members',
            '100GB storage',
            'Priority support',
            'Advanced analytics',
            'Custom integrations'
        ],
        limits: {
            users: 10,
            projects: -1,
            storage_gb: 100
        },
        plan_code: 'pro',
        trial_days: 14,
        is_featured: true,
        // Legacy compatibility
        price: 999,
        currency: 'INR',
        interval: 'month',
        isPopular: true,
        maxUsers: 10,
        maxProjects: -1,
        storage: '100GB',
        support: 'Priority'
    },
    {
        id: 3,
        name: 'Plus',
        displayName: 'Plus',
        description: 'For growing organizations',
        price_monthly: 249900, // ₹2499 in paisa
        price_yearly: 2499900, // ₹24999 in paisa (2 months free)
        price_currency: 'INR',
        features: [
            'Everything in Pro',
            'Unlimited team members',
            '1TB storage',
            '24/7 dedicated support',
            'Advanced security features',
            'Custom branding',
            'API access',
            'White-label options'
        ],
        limits: {
            users: -1,
            projects: -1,
            storage_gb: 1024
        },
        plan_code: 'plus',
        trial_days: 14,
        is_featured: false,
        // Legacy compatibility
        price: 2499,
        currency: 'INR',
        interval: 'month',
        maxUsers: -1,
        maxProjects: -1,
        storage: '1TB',
        support: 'Dedicated'
    }
];

// Current user subscription - CONSISTENT DATA
export const mockCurrentSubscription: UserSubscription = {
    id: 'sub_123',
    userId: 'user_123',
    planId: 2,  // Legacy ID for backward compatibility
    planCode: 'pro', // Primary identifier matching the config system
    plan: mockPlans[1], // Pro plan to match billing
    status: 'active',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    cancelAtPeriodEnd: false,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
};

// Transaction history - matches subscription plan
export const mockTransactions: BillingTransaction[] = [
    {
        id: 'txn_1',
        userId: 'user_123',
        subscriptionId: 'sub_123',
        amount: 117782, // ₹999 + 18% GST in paisa
        currency: 'INR',
        status: 'succeeded',
        description: 'Pro Plan - Monthly Subscription',
        paymentMethod: 'Visa ****4242',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceUrl: 'https://example.com/invoice/1'
    },
    {
        id: 'txn_2',
        userId: 'user_123',
        subscriptionId: 'sub_123',
        amount: 117782,
        currency: 'INR',
        status: 'succeeded',
        description: 'Pro Plan - Monthly Subscription',
        paymentMethod: 'Visa ****4242',
        createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceUrl: 'https://example.com/invoice/2'
    },
    {
        id: 'txn_3',
        userId: 'user_123',
        subscriptionId: 'sub_123',
        amount: 117782,
        currency: 'INR',
        status: 'failed',
        description: 'Pro Plan - Monthly Subscription',
        paymentMethod: 'Visa ****4242',
        createdAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString(),
        failureReason: 'Insufficient funds'
    },
    {
        id: 'txn_4',
        userId: 'user_123',
        subscriptionId: 'sub_123',
        amount: 0, // Free plan activation
        currency: 'INR',
        status: 'succeeded',
        description: 'Free Plan - Account Creation',
        paymentMethod: 'N/A',
        createdAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString()
    }
];

// Account credits
export const mockCredits: AccountCredit[] = [
    {
        id: 'credit_1',
        userId: 'user_123',
        amount: 25000, // ₹250 in paisa
        currency: 'INR',
        reason: 'refund',
        description: 'Refund for billing error',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        isUsed: false,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    }
];

// Payment methods
export const mockPaymentMethods: PaymentMethod[] = [
    {
        id: 'pm_1',
        type: 'card',
        last4: '4242',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2025,
        isDefault: true,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
];

/**
 * Get mock subscription data with consistent state
 */
export function getMockSubscriptionData() {
    return {
        plans: mockPlans,
        currentSubscription: mockCurrentSubscription,
        transactions: mockTransactions,
        credits: mockCredits,
        paymentMethods: mockPaymentMethods,
        totalCreditBalance: mockCredits.reduce((sum, credit) => 
            credit.isUsed ? sum : sum + credit.amount, 0
        )
    };
}

/**
 * Simulate API delay for realistic loading states
 */
export const simulateApiDelay = (ms: number = 1000): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};