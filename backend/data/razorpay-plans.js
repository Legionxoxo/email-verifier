/**
 * Razorpay subscription plans configuration
 * Maps internal plan IDs to Razorpay plan IDs for both monthly and yearly billing
 * 
 * @fileoverview Razorpay plans configuration for subscription management
 */


/**
 * Complete subscription plan configuration
 * Contains all plan details including pricing, features, and Razorpay plan mappings
 * 
 * @type {Record<string, {
 *   name: string,
 *   description: string,
 *   tagline: string,
 *   price_monthly: number,
 *   price_yearly: number,
 *   price_currency: string,
 *   features: string[],
 *   limits: Record<string, any>,
 *   trial_days: number,
 *   is_active: boolean,
 *   is_featured: boolean,
 *   display_order: number,
 *   razorpay_plan_ids: {monthly?: string, yearly?: string}
 * }>}
 */
const SUBSCRIPTION_PLANS = {
    free: {
        name: 'Free',
        description: 'Get started with our basic features',
        tagline: 'Perfect for trying out the platform',
        price_monthly: 0,
        price_yearly: 0,
        price_currency: 'INR',
        features: [
            'Basic dashboard access',
            'Up to 5 projects',
            'Community support',
            'Standard API access'
        ],
        limits: {
            projects: 5,
            api_calls: 1000,
            storage_gb: 1,
            users: 1
        },
        trial_days: 0,
        is_active: true,
        is_featured: false,
        display_order: 1,
        razorpay_plan_ids: {
            monthly: null, // Free plan doesn't have Razorpay plan IDs
            yearly: null
        }
    },
    
    pro: {
        name: 'Pro',
        description: 'Advanced features for growing businesses',
        tagline: 'Most popular choice for professionals',
        price_monthly: 99900, // ₹999 in paise
        price_yearly: 999900, // ₹9999 yearly (10 months price)
        price_currency: 'INR',
        features: [
            'Everything in Free',
            'Unlimited projects',
            'Priority support',
            'Advanced analytics',
            'API integrations',
            'Custom branding'
        ],
        limits: {
            projects: -1, // unlimited
            api_calls: 10000,
            storage_gb: 10,
            users: 5,
            integrations: 10
        },
        trial_days: 0,
        is_active: true,
        is_featured: true,
        display_order: 2,
        razorpay_plan_ids: {
            monthly: null, // Will be set to actual Razorpay plan ID
            yearly: null
        }
    },
    
    plus: {
        name: 'Plus',
        description: 'Enterprise-grade features and support',
        tagline: 'For teams that need maximum power',
        price_monthly: 199900, // ₹1999 in paise
        price_yearly: 1999900, // ₹19999 yearly (10 months price)
        price_currency: 'INR',
        features: [
            'Everything in Pro',
            'Unlimited users',
            '24/7 dedicated support',
            'Advanced security',
            'Custom integrations',
            'SLA guarantee',
            'White-label options'
        ],
        limits: {
            projects: -1, // unlimited
            api_calls: 100000,
            storage_gb: 100,
            users: -1, // unlimited
            integrations: -1, // unlimited
            sla: true
        },
        trial_days: 0,
        is_active: true,
        is_featured: false,
        display_order: 3,
        razorpay_plan_ids: {
            monthly: null, // Will be set to actual Razorpay plan ID
            yearly: null
        }
    }
};


/**
 * Get Razorpay plan ID for a specific internal plan and billing cycle
 * @param {string} planCode - Internal plan code (free, pro, plus)
 * @param {string} billingCycle - Billing cycle (monthly, yearly)
 * @returns {string|null} Razorpay plan ID or null if not found
 * @throws {Error} If plan code or billing cycle is invalid
 */
function getRazorpayPlanId(planCode, billingCycle) {
    try {
        // Validate inputs
        if (!planCode || typeof planCode !== 'string') {
            throw new Error('Plan code is required and must be a string');
        }

        if (!billingCycle || typeof billingCycle !== 'string') {
            throw new Error('Billing cycle is required and must be a string');
        }

        // Normalize inputs
        const normalizedPlanCode = planCode.toLowerCase().trim();
        const normalizedBillingCycle = billingCycle.toLowerCase().trim();

        // Validate plan code exists
        if (!SUBSCRIPTION_PLANS[normalizedPlanCode]) {
            throw new Error(`Invalid plan code: ${planCode}`);
        }

        // Validate billing cycle
        if (!['monthly', 'yearly'].includes(normalizedBillingCycle)) {
            throw new Error(`Invalid billing cycle: ${billingCycle}. Must be 'monthly' or 'yearly'`);
        }

        const plan = SUBSCRIPTION_PLANS[normalizedPlanCode];
        const razorpayPlanId = plan.razorpay_plan_ids[normalizedBillingCycle];

        if (!razorpayPlanId) {
            console.warn(`No Razorpay plan ID configured for ${planCode} ${billingCycle}`);
            return null;
        }

        return razorpayPlanId;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to get Razorpay plan ID:', errorMessage);
        throw error;
    } finally {
        console.debug('Get Razorpay plan ID process completed');
    }
}


/**
 * Get all active subscription plans for API responses
 * @returns {Array<Object>} Array of active plan configurations
 */
function getAllActivePlans() {
    try {
        return Object.entries(SUBSCRIPTION_PLANS)
            .filter(([_, plan]) => plan.is_active)
            .sort((a, b) => a[1].display_order - b[1].display_order)
            .map(([planCode, plan]) => ({
                plan_code: planCode,
                name: plan.name,
                description: plan.description,
                tagline: plan.tagline,
                price_monthly: plan.price_monthly,
                price_yearly: plan.price_yearly,
                price_currency: plan.price_currency,
                features: plan.features,
                limits: plan.limits,
                trial_days: plan.trial_days,
                is_featured: plan.is_featured,
                display_order: plan.display_order
            }));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to get active plans:', errorMessage);
        throw error;
    } finally {
        console.debug('Get active plans process completed');
    }
}


/**
 * Get all plan configurations (including internal data)
 * @returns {Record<string, Object>} All plan configurations
 */
function getAllPlanConfigurations() {
    try {
        return { ...SUBSCRIPTION_PLANS };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to get all plan configurations:', errorMessage);
        throw error;
    } finally {
        console.debug('Get all plan configurations process completed');
    }
}


/**
 * Check if a plan code is valid
 * @param {string} planCode - Plan code to validate
 * @returns {boolean} True if plan code is valid
 */
function isValidPlanCode(planCode) {
    try {
        if (!planCode || typeof planCode !== 'string') {
            return false;
        }

        const normalizedPlanCode = planCode.toLowerCase().trim();
        return normalizedPlanCode in SUBSCRIPTION_PLANS;

    } catch (error) {
        console.error('Failed to validate plan code:', error);
        return false;
    } finally {
        console.debug('Plan code validation process completed');
    }
}


/**
 * Check if billing cycle is valid
 * @param {string} billingCycle - Billing cycle to validate
 * @returns {boolean} True if billing cycle is valid
 */
function isValidBillingCycle(billingCycle) {
    try {
        if (!billingCycle || typeof billingCycle !== 'string') {
            return false;
        }

        const normalizedBillingCycle = billingCycle.toLowerCase().trim();
        return ['monthly', 'yearly'].includes(normalizedBillingCycle);

    } catch (error) {
        console.error('Failed to validate billing cycle:', error);
        return false;
    } finally {
        console.debug('Billing cycle validation process completed');
    }
}


/**
 * Get plan configuration by plan code
 * @param {string} planCode - Internal plan code
 * @returns {Object|null} Plan configuration or null if not found
 */
function getPlanConfiguration(planCode) {
    try {
        if (!planCode || typeof planCode !== 'string') {
            throw new Error('Plan code is required and must be a string');
        }

        const normalizedPlanCode = planCode.toLowerCase().trim();
        
        if (!SUBSCRIPTION_PLANS[normalizedPlanCode]) {
            console.warn(`Plan configuration not found for: ${planCode}`);
            return null;
        }

        return { ...SUBSCRIPTION_PLANS[normalizedPlanCode] };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to get plan configuration:', errorMessage);
        throw error;
    } finally {
        console.debug('Get plan configuration process completed');
    }
}


/**
 * Update Razorpay plan ID for a specific plan and billing cycle
 * This function should be used when setting up plans in Razorpay
 * @param {string} planCode - Internal plan code
 * @param {string} billingCycle - Billing cycle (monthly, yearly)
 * @param {string} razorpayPlanId - Razorpay plan ID to set
 * @returns {void}
 * @throws {Error} If plan code, billing cycle, or plan ID is invalid
 */
function updateRazorpayPlanId(planCode, billingCycle, razorpayPlanId) {
    try {
        // Validate inputs
        if (!planCode || typeof planCode !== 'string') {
            throw new Error('Plan code is required and must be a string');
        }

        if (!billingCycle || typeof billingCycle !== 'string') {
            throw new Error('Billing cycle is required and must be a string');
        }

        if (!razorpayPlanId || typeof razorpayPlanId !== 'string') {
            throw new Error('Razorpay plan ID is required and must be a string');
        }

        // Normalize inputs
        const normalizedPlanCode = planCode.toLowerCase().trim();
        const normalizedBillingCycle = billingCycle.toLowerCase().trim();

        // Validate plan code exists
        if (!SUBSCRIPTION_PLANS[normalizedPlanCode]) {
            throw new Error(`Invalid plan code: ${planCode}`);
        }

        // Validate billing cycle
        if (!['monthly', 'yearly'].includes(normalizedBillingCycle)) {
            throw new Error(`Invalid billing cycle: ${billingCycle}. Must be 'monthly' or 'yearly'`);
        }

        // Update the plan ID
        SUBSCRIPTION_PLANS[normalizedPlanCode].razorpay_plan_ids[normalizedBillingCycle] = razorpayPlanId.trim();

        console.log(`Updated Razorpay plan ID for ${planCode} ${billingCycle}: ${razorpayPlanId}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to update Razorpay plan ID:', errorMessage);
        throw error;
    } finally {
        console.debug('Update Razorpay plan ID process completed');
    }
}


// Export all functions and constants
module.exports = {
    SUBSCRIPTION_PLANS,
    getRazorpayPlanId,
    getAllActivePlans,
    getAllPlanConfigurations,
    isValidPlanCode,
    isValidBillingCycle,
    getPlanConfiguration,
    updateRazorpayPlanId
};