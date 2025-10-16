/**
 * TypeScript interfaces for subscription management
 * Defines data structures for plans, subscriptions, and billing
 */

export interface SubscriptionPlan {
    id: number; // Legacy field - now computed from plan_code
    plan_code: string; // Primary identifier: 'free', 'pro', 'plus'
    code?: string; // Alias for plan_code for backward compatibility
    name: string;
    displayName?: string;
    description: string;
    price_monthly: number;
    price_yearly?: number;
    price_currency: string;
    features: string[];
    limits?: Record<string, any>;
    tagline?: string;
    trial_days?: number;
    is_featured?: boolean;
    display_order?: number;
    created_at?: string;
    updated_at?: string;
    // Legacy fields for backward compatibility
    price?: number; // Computed field
    currency?: string; // Alias for price_currency
    interval?: 'month' | 'year';
    isPopular?: boolean; // Alias for is_featured
    maxUsers?: number;
    maxProjects?: number;
    storage?: string;
    support?: string;
}

export interface UserSubscription {
    id: string | number;
    userId: string | number;
    planCode?: string; // Primary identifier: 'free', 'pro', 'plus'
    plan_code?: string; // Alias for planCode for backend compatibility
    plan: SubscriptionPlan;
    status: 'active' | 'created' | 'authenticated' | 'canceled' | 'cancelled' | 'expired' | 'past_due' | 'unpaid' | 'trialing';
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    canceledAt?: string;
    trialStart?: string;
    trialEnd?: string;
    createdAt: string;
    updatedAt: string;
    // Legacy field for backward compatibility
    planId?: number;
}

export interface BillingTransaction {
    id: string;
    userId: string;
    subscriptionId: string;
    amount: number;
    currency: string;
    status: 'succeeded' | 'failed' | 'pending' | 'refunded' | 'cancelled';
    description: string;
    invoiceUrl?: string;
    paymentMethod: string;
    createdAt: string;
    failureReason?: string;
}

export interface PaymentMethod {
    id: string;
    type: 'card' | 'upi' | 'netbanking' | 'wallet';
    last4?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault: boolean;
    createdAt: string;
}

export interface AccountCredit {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    reason: 'downgrade' | 'refund' | 'bonus' | 'adjustment';
    description: string;
    expiresAt?: string;
    createdAt: string;
    isUsed: boolean;
    usedAt?: string;
}

export interface FreeUserResponse {
    subscription: null;
    currentPlan: {
        plan_code: string;
        name: string;
        description: string;
        features: string[];
        limits: Record<string, any>;
        price_monthly: number;
        trial_days: number;
    };
}

// Raw API response from backend
export interface RawSubscriptionData {
    subscription: {
        id: number;
        user_id: number;
        plan_code: string; // Primary identifier in backend
        status: string;
        billing_cycle: string;
        current_period_start: string;
        current_period_end: string;
        trial_start?: string;
        trial_end?: string;
        cancel_at_period_end: number;
        cancelled_at?: string;
        created_at: string;
        updated_at: string;
        plan_name: string;
        plan_description: string;
        features: string[];
        limits: Record<string, any>;
        limits_json: string;
        price_monthly: number;
        price_yearly?: number;
        price_currency: string;
        trial_days: number;
        is_featured: number;
        // Legacy field - may still be present for backward compatibility
        plan_id?: number;
    };
    accountCredits: number;
    isActive: boolean;
    isTrialActive: boolean;
}

export interface SubscriptionApiResponse {
    success: boolean;
    message: string;
    data: UserSubscription | FreeUserResponse | RawSubscriptionData;
}

export interface PlansApiResponse {
    success: boolean;
    message: string;
    data: {
        plans: SubscriptionPlan[];
        total: number;
    };
}

// Raw transaction data from backend
export interface RawTransactionData {
    id: number;
    user_id: number;
    subscription_id: number;
    razorpay_payment_id: string;
    razorpay_order_id: string;
    transaction_type: string;
    amount: number;
    tax_amount: number;
    discount_amount: number;
    fee_amount: number;
    net_amount: number;
    currency: string;
    status: string; // "captured", "failed", "pending", etc.
    method: string; // "card", "upi", etc.
    description?: string;
    failure_reason?: string;
    created_at: string;
    updated_at: string;
    plan_name: string;
    plan_code: string;
    method_details?: any;
    amount_formatted: string;
    net_amount_formatted: string;
}

export interface RawTransactionsApiResponse {
    success: boolean;
    message: string;
    data: {
        data: {
            transactions: RawTransactionData[];
            pagination: {
                currentPage: number;
                totalPages: number;
                totalRecords: number;
                hasNextPage: boolean;
                hasPreviousPage: boolean;
            };
        };
    };
}

export interface TransactionsApiResponse {
    success: boolean;
    message: string;
    data: {
        transactions: BillingTransaction[];
        total: number;
        page: number;
        limit: number;
    };
}

export interface PaymentIntentResponse {
    success: boolean;
    message: string;
    data: {
        subscriptionId?: number;
        razorpaySubscriptionId?: string;
        orderId?: string;
        amount: number;
        currency?: string;
        planName: string;
        billingCycle?: string;
        trialDays?: number;
        requiresPayment: boolean;
        razorpayKeyId?: string;
        isSubscription?: boolean;
        subscriptionUrl?: string;
    };
}

// Enhanced billing information from upgrade API response
export interface BillingInfo {
    immediateCharge: boolean;
    chargeAmount: number;
    chargeDescription: string | null;
    creditAmount?: number;
    creditDescription?: string | null;
    nextBillingAmount: number;
    nextBillingDate: string;
}

// Proration information from upgrade API response
export interface ProrationInfo {
    proratedAmount: number;
    requiresPayment: boolean;
    daysRemaining: number;
    dailyRate: number;
    description: string;
}

// Enhanced upgrade API response
export interface UpgradeResponse {
    success: boolean;
    message: string;
    data: {
        subscription: UserSubscription;
        proration: ProrationInfo;
        billing: BillingInfo;
        requiresPayment: boolean;
        hasProration: boolean;
        transactionId?: string;
    };
}

export interface UpgradeRequest {
    planCode?: string; // Primary identifier: 'free', 'pro', 'plus'
    paymentMethodId?: string;
    // Legacy field for backward compatibility
    planId?: number;
}

export interface CancelRequest {
    reason?: string;
    feedback?: string;
    cancelAtPeriodEnd: boolean;
}

// Filter types for transaction history
export interface TransactionFilters {
    status?: BillingTransaction['status'];
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
}

// UI State types
export interface PaymentFormData {
    planCode?: string; // Primary identifier: 'free', 'pro', 'plus'
    paymentMethod: string;
    savePaymentMethod: boolean;
    // Legacy field for backward compatibility
    planId?: number;
}

export interface PlanComparisonFeature {
    name: string;
    free: boolean | string;
    pro: boolean | string;
    plus: boolean | string;
}

// Payment Status Polling Types
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired' | 'not_required';

export interface PollingConfig {
    initialIntervalMs: number;
    maxIntervalMs: number;
    backoffMultiplier: number;
    maxAttempts: number;
    timeoutMs: number;
}

export interface PaymentStatusInfo {
    status: PaymentStatus;
    subscriptionId: string;
    paymentId?: string;
    orderId?: string;
    amount?: number;
    currency?: string;
    errorMessage?: string;
    nextRetryMs?: number;
    attemptsRemaining?: number;
    lastUpdated: string;
}

export interface PaymentStatusResponse {
    success: boolean;
    message: string;
    data: {
        subscription: {
            id: number;
            status: string;
            plan_code: string;
            plan_name: string;
            billing_cycle: string;
            total_amount: number;
            total_amount_formatted: string;
            currency: string;
            razorpay_subscription_id: string;
            auto_renewal: number;
            created_at: string;
            updated_at: string;
        };
        payment: {
            status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired' | 'not_required';
            message: string;
            is_active: boolean;
            is_pending: boolean;
            is_cancelled: boolean;
            is_expired: boolean;
            requires_payment: boolean;
            latest_payment_id: string | null;
            latest_payment_date: string | null;
            successful_payments: number;
            failed_payments: number;
            failed_payment_count: number;
            last_payment_attempt: string | null;
        };
        timing: {
            is_in_trial: boolean | null;
            trial_end: string | null;
            current_period_start: string;
            current_period_end: string;
            next_billing_date: string;
            days_until_expiry: number;
            days_until_billing: number;
            cancel_at_period_end: number;
            cancelled_at: string | null;
        };
        polling: {
            should_continue: boolean;
            interval_seconds: number;
            max_attempts: number;
            recommended_timeout: number;
        };
        recent_transactions: Array<{
            id: number;
            transaction_type: string;
            amount: number;
            status: string;
            method: string;
            description: string | null;
            razorpay_payment_id: string | null;
            razorpay_order_id: string | null;
            failure_reason: string | null;
            processed_at: string;
            created_at: string;
            amount_formatted: string;
            created_at_formatted: string;
            processed_at_formatted: string;
        }>;
        metadata: {
            checked_at: string;
            user_id: number;
            plan_features: string[];
            plan_limits: Record<string, any>;
        };
    };
}