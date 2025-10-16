/**
 * Subscription Plans Configuration
 * Single source of truth for all subscription plan data
 * Fill in the razorpay_plan_id_monthly and razorpay_plan_id_yearly with actual Razorpay plan IDs
 *
 * @fileoverview Comprehensive subscription plans configuration with features, limits, and pricing
 */

/**
 * Complete subscription plans configuration
 * @type {Record<string, Object>}
 */
const SUBSCRIPTION_PLANS = {
	free: {
		plan_code: 'free',
		name: 'Free',
		description: 'Get started with our basic features',
		tagline: 'Perfect for trying out the platform',
		price_monthly: 0,
		price_yearly: 0,
		price_currency: 'INR',
		features: ['Basic dashboard access', 'Up to 5 projects', 'Community support', 'Standard API access'],
		limits: {
			projects: 5,
			api_calls: 1000,
			storage_gb: 1,
			users: 1,
		},
		trial_days: 0,
		is_active: true,
		is_featured: false,
		display_order: 1,
		// TODO: Fill these with actual Razorpay plan IDs
		razorpay_plan_id_monthly: null, // Free plan doesn't need Razorpay ID
		razorpay_plan_id_yearly: null, // Free plan doesn't need Razorpay ID
	},

	pro: {
		plan_code: 'pro',
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
			'Custom branding',
		],
		limits: {
			projects: -1, // unlimited
			api_calls: 10000,
			storage_gb: 10,
			users: 5,
			integrations: 10,
		},
		trial_days: 0,
		is_active: true,
		is_featured: true,
		display_order: 2,
		// TODO: Fill these with actual Razorpay plan IDs from your Razorpay dashboard
		razorpay_plan_id_monthly: 'plan_R0c1k7ViK9H1Hj', // e.g., 'plan_xxxxxxxxx'
		razorpay_plan_id_yearly: 'plan_R0cCKbK32MukR0', // e.g., 'plan_yyyyyyyyy'
	},

	plus: {
		plan_code: 'plus',
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
			'White-label options',
		],
		limits: {
			projects: -1, // unlimited
			api_calls: 100000,
			storage_gb: 100,
			users: -1, // unlimited
			integrations: -1, // unlimited
			sla: true,
		},
		trial_days: 0,
		is_active: true,
		is_featured: false,
		display_order: 3,
		// TODO: Fill these with actual Razorpay plan IDs from your Razorpay dashboard
		razorpay_plan_id_monthly: 'plan_R0cEP1uG3nJ668', // e.g., 'plan_zzzzzzzzz'
		razorpay_plan_id_yearly: 'plan_R0cFdJ2yJofJzy', // e.g., 'plan_aaaaaaaaa'
	},
};

/**
 * Get all active subscription plans
 * @returns {Array<Object>} Array of active plans sorted by display order
 */
function getActivePlans() {
	try {
		const activePlans = Object.values(SUBSCRIPTION_PLANS)
			.filter(plan => plan.is_active)
			.sort((a, b) => a.display_order - b.display_order);

		return activePlans;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Failed to get active plans:', errorMessage);
		throw error;
	} finally {
		console.debug('Get active plans process completed');
	}
}

/**
 * Get subscription plan by plan code
 * @param {string} planCode - Plan code (free, pro, plus)
 * @returns {Object|null} Plan object or null if not found
 * @throws {Error} If plan code is invalid
 */
function getPlanByCode(planCode) {
	try {
		if (!planCode || typeof planCode !== 'string') {
			throw new Error('Plan code is required and must be a string');
		}

		const normalizedPlanCode = planCode.toLowerCase().trim();
		const plan = SUBSCRIPTION_PLANS[normalizedPlanCode];

		if (!plan) {
			console.warn(`Plan not found for code: ${planCode}`);
			return null;
		}

		return { ...plan };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Failed to get plan by code:', errorMessage);
		throw error;
	} finally {
		console.debug('Get plan by code process completed');
	}
}

/**
 * Get subscription plan by ID (for backward compatibility)
 * Maps old numeric IDs to plan codes
 * @param {number} planId - Numeric plan ID (1=free, 2=pro, 3=plus)
 * @returns {Object|null} Plan object or null if not found
 * @throws {Error} If plan ID is invalid
 */
function getPlanById(planId) {
	try {
		if (typeof planId !== 'number' && typeof planId !== 'string') {
			throw new Error('Plan ID must be a number or string');
		}

		// Map old numeric IDs to plan codes for backward compatibility
		const idToCodeMap = {
			1: 'free',
			2: 'pro',
			3: 'plus',
		};

		const numericId = typeof planId === 'string' ? parseInt(planId, 10) : planId;

		if (isNaN(numericId)) {
			throw new Error('Plan ID must be a valid number');
		}

		const planCode = idToCodeMap[numericId];

		if (!planCode) {
			console.warn(`No plan found for ID: ${planId}`);
			return null;
		}

		return getPlanByCode(planCode);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Failed to get plan by ID:', errorMessage);
		throw error;
	} finally {
		console.debug('Get plan by ID process completed');
	}
}

/**
 * Get all subscription plans
 * @returns {Array<Object>} Array of all plans sorted by display order
 */
function getAllPlans() {
	try {
		const allPlans = Object.values(SUBSCRIPTION_PLANS).sort((a, b) => a.display_order - b.display_order);

		return allPlans;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Failed to get all plans:', errorMessage);
		throw error;
	} finally {
		console.debug('Get all plans process completed');
	}
}

/**
 * Get Razorpay plan ID for a specific plan and billing cycle
 * @param {string} planCode - Plan code (free, pro, plus)
 * @param {string} billingCycle - Billing cycle (monthly, yearly)
 * @returns {string|null} Razorpay plan ID or null if not found
 * @throws {Error} If plan code or billing cycle is invalid
 */
function getRazorpayPlanId(planCode, billingCycle) {
	try {
		if (!planCode || typeof planCode !== 'string') {
			throw new Error('Plan code is required and must be a string');
		}

		if (!billingCycle || typeof billingCycle !== 'string') {
			throw new Error('Billing cycle is required and must be a string');
		}

		const plan = getPlanByCode(planCode);

		if (!plan) {
			throw new Error(`Invalid plan code: ${planCode}`);
		}

		const normalizedBillingCycle = billingCycle.toLowerCase().trim();

		if (!['monthly', 'yearly'].includes(normalizedBillingCycle)) {
			throw new Error(`Invalid billing cycle: ${billingCycle}. Must be 'monthly' or 'yearly'`);
		}

		const razorpayPlanId =
			normalizedBillingCycle === 'yearly' ? plan.razorpay_plan_id_yearly : plan.razorpay_plan_id_monthly;

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
 * Get plan pricing for display
 * @param {string} planCode - Plan code (free, pro, plus)
 * @param {string} billingCycle - Billing cycle (monthly, yearly)
 * @returns {Object} Pricing information with formatted amounts
 * @throws {Error} If plan code or billing cycle is invalid
 */
function getPlanPricing(planCode, billingCycle) {
	try {
		const plan = getPlanByCode(planCode);

		if (!plan) {
			throw new Error(`Invalid plan code: ${planCode}`);
		}

		const normalizedBillingCycle = billingCycle.toLowerCase().trim();

		if (!['monthly', 'yearly'].includes(normalizedBillingCycle)) {
			throw new Error(`Invalid billing cycle: ${billingCycle}. Must be 'monthly' or 'yearly'`);
		}

		const priceInPaise = normalizedBillingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;

		const priceInRupees = priceInPaise / 100;
		const formattedPrice = priceInRupees.toLocaleString('en-IN', {
			style: 'currency',
			currency: plan.price_currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		});

		return {
			price_paise: priceInPaise,
			price_rupees: priceInRupees,
			price_formatted: formattedPrice,
			currency: plan.price_currency,
			billing_cycle: normalizedBillingCycle,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Failed to get plan pricing:', errorMessage);
		throw error;
	} finally {
		console.debug('Get plan pricing process completed');
	}
}

/**
 * Check if a plan has a specific feature
 * @param {string} planCode - Plan code (free, pro, plus)
 * @param {string} featureName - Feature name to check
 * @returns {boolean} True if plan has the feature
 * @throws {Error} If plan code is invalid
 */
function planHasFeature(planCode, featureName) {
	try {
		const plan = getPlanByCode(planCode);

		if (!plan) {
			throw new Error(`Invalid plan code: ${planCode}`);
		}

		if (!featureName || typeof featureName !== 'string') {
			throw new Error('Feature name is required and must be a string');
		}

		return plan.features.some(feature => feature.toLowerCase().includes(featureName.toLowerCase()));
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Failed to check plan feature:', errorMessage);
		throw error;
	} finally {
		console.debug('Plan feature check process completed');
	}
}

/**
 * Get plan limits for a specific resource
 * @param {string} planCode - Plan code (free, pro, plus)
 * @param {string} resource - Resource name (projects, api_calls, storage_gb, users, etc.)
 * @returns {number} Limit value (-1 for unlimited, 0 for none)
 * @throws {Error} If plan code is invalid
 */
function getPlanLimit(planCode, resource) {
	try {
		const plan = getPlanByCode(planCode);

		if (!plan) {
			throw new Error(`Invalid plan code: ${planCode}`);
		}

		if (!resource || typeof resource !== 'string') {
			throw new Error('Resource name is required and must be a string');
		}

		const limit = plan.limits[resource];

		if (limit === undefined) {
			console.warn(`Resource '${resource}' not found in plan limits for ${planCode}`);
			return 0;
		}

		return limit;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Failed to get plan limit:', errorMessage);
		throw error;
	} finally {
		console.debug('Get plan limit process completed');
	}
}

/**
 * Check if a plan is unlimited for a specific resource
 * @param {string} planCode - Plan code (free, pro, plus)
 * @param {string} resource - Resource name
 * @returns {boolean} True if unlimited (-1)
 */
function isPlanUnlimited(planCode, resource) {
	try {
		const limit = getPlanLimit(planCode, resource);
		return limit === -1;
	} catch (error) {
		console.error('Failed to check if plan is unlimited:', error);
		return false;
	} finally {
		console.debug('Plan unlimited check process completed');
	}
}

module.exports = {
	SUBSCRIPTION_PLANS,
	getActivePlans,
	getPlanByCode,
	getPlanById,
	getAllPlans,
	getRazorpayPlanId,
	getPlanPricing,
	planHasFeature,
	getPlanLimit,
	isPlanUnlimited,
};
