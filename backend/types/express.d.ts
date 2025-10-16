/**
 * Express.js type extensions
 * Adds custom properties to Express Request interface
 */

declare namespace Express {
    interface Request {
        user?: {
            id: number;
            userId: number;
            email: string;
            firstName?: string;
            lastName?: string;
            isVerified?: boolean;
            createdAt?: string;
        };
    }
}

/**
 * Database result types
 */
interface DatabasePlan {
    id: number;
    plan_code: string;
    name: string;
    description: string;
    tagline?: string;
    price_monthly: number;
    price_yearly: number;
    price_currency: string;
    features: string;
    limits_json: string;
    trial_days: number;
    is_featured: number;
    display_order: number;
    created_at: string;
    updated_at: string;
}

interface DatabaseSubscription {
    id: number;
    user_id: number;
    plan_code: string;
    status: string;
    billing_cycle: string;
    current_period_start: string;
    current_period_end: string;
    trial_start?: string;
    trial_end?: string;
    total_amount: number;
    auto_renewal: number;
    razorpay_subscription_id?: string;
    features?: string;
    limits_json?: string;
    price_monthly?: number;
    price_yearly?: number;
    price_currency?: string;
    trial_days?: number;
    is_featured?: number;
    plan_name?: string;
    current_plan_name?: string;
    plan_description?: string;
    cancel_at_period_end?: number;
    cancelled_at?: string;
    cancellation_reason?: string;
}

interface DatabaseCredits {
    total_credits: number;
}

interface DatabaseTransaction {
    id: number;
    user_id: number;
    subscription_id: number;
    razorpay_payment_id: string;
    razorpay_order_id: string;
    transaction_type: string;
    amount: number;
    net_amount: number;
    currency: string;
    status: string;
    method: string;
    method_details_json?: string;
    gateway_response_json?: string;
    processed_at: string;
    created_at: string;
    subscription_status?: string;
    plan_name?: string;
    plan_code?: string;
}

interface DatabaseCountResult {
    total: number;
}

interface DatabaseUser {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    password_hash: string;
    razorpay_customer_id?: string;
    is_verified: number;
    created_at: string;
    updated_at: string;
}

interface ScriptCountResult {
    count: number;
}

