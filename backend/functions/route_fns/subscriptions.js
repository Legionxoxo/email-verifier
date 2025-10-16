/**
 * Subscription management route functions
 * Handles all subscription-related business logic for Razorpay subscription system
 *
 * @fileoverview Subscription management functions with proper Razorpay integration
 */

/**
 * @typedef {Object} DatabaseUser
 * @property {number} id - User ID
 * @property {string} name - User full name
 * @property {string} email - User email
 * @property {string} [phone] - User phone number
 * @property {string} [razorpay_customer_id] - Razorpay customer ID
 */

/**
 * @typedef {Object} PlanConfiguration
 * @property {string} plan_code - Plan code (free, pro, plus)
 * @property {string} name - Plan name
 * @property {string} description - Plan description
 * @property {number} price_monthly - Monthly price in paise
 * @property {number} price_yearly - Yearly price in paise
 * @property {string} price_currency - Currency code
 * @property {number} trial_days - Trial period in days
 * @property {string[]} features - Array of features
 * @property {Object} limits - Object containing limits
 * @property {boolean} is_active - Whether plan is active
 */

/**
 * @typedef {Object} DatabaseSubscription
 * @property {number} id - Subscription ID
 * @property {number} user_id - User ID
 * @property {string} plan_code - Plan code (free, pro, plus)
 * @property {string} status - Subscription status
 * @property {string} billing_cycle - Billing cycle (monthly/yearly)
 * @property {string} current_period_start - Current period start date
 * @property {string} current_period_end - Current period end date
 * @property {string} [trial_start] - Trial start date
 * @property {string} [trial_end] - Trial end date
 * @property {number} total_amount - Total amount in paise
 * @property {string} [razorpay_subscription_id] - Razorpay subscription ID
 * @property {string} [razorpay_customer_id] - Razorpay customer ID
 * @property {number} [cancel_at_period_end] - Whether subscription cancels at period end
 * @property {string} [cancelled_at] - Cancellation timestamp
 * @property {string} [cancellation_reason] - Reason for cancellation
 * @property {number} [failed_payment_count] - Failed payment count
 * @property {string} [last_payment_attempt] - Last payment attempt timestamp
 * @property {string} [next_billing_date] - Next billing date
 * @property {number} [auto_renewal] - Auto renewal flag
 * @property {string} [created_at] - Creation timestamp
 * @property {string} [updated_at] - Update timestamp
 */

/**
 * @typedef {Object} DatabaseTransaction
 * @property {number} id - Transaction ID
 * @property {number} user_id - User ID
 * @property {number} subscription_id - Subscription ID
 * @property {string} transaction_type - Transaction type
 * @property {number} amount - Amount in paise
 * @property {number} net_amount - Net amount in paise
 * @property {string} status - Transaction status
 * @property {string} [method_details_json] - Payment method details JSON
 * @property {string} [gateway_response_json] - Gateway response JSON
 * @property {string} [plan_code] - Plan code (from JOIN)
 * @property {string} [subscription_status] - Subscription status (from JOIN)
 */

/**
 * @typedef {Object} DatabaseCredits
 * @property {number} [total_credits] - Total credits amount
 */

/**
 * @typedef {Object} DatabaseCountResult
 * @property {number} total - Total count
 */

const { getDb } = require('../../database/connection');
const {
	createRazorpayOrder, // Keep for any one-time payments
	calculateProratedAmount,
	processRefundToCredits,
	handleFailedPayments,
	fetchPaymentDetails,
	// Subscription management
	createRazorpayPlan,
	createRazorpaySubscription,
	updateRazorpaySubscription,
	fetchRazorpaySubscription,
	cancelRazorpaySubscription,
	// Customer management
	createRazorpayCustomer,
	fetchRazorpayCustomer,
	updateRazorpayCustomer,
} = require('../utils/razorpay');

/**
 * Create a subscription transaction record for audit trail
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {Object} transactionData - Transaction data
 * @param {number} transactionData.userId - User ID
 * @param {number} transactionData.subscriptionId - Subscription ID
 * @param {string} transactionData.transactionType - Transaction type (subscription, cancellation, upgrade, etc.)
 * @param {number} transactionData.amount - Amount in paise
 * @param {string} transactionData.status - Transaction status
 * @param {string} [transactionData.description] - Description of the transaction
 * @param {string} [transactionData.razorpayPaymentId] - Razorpay payment ID
 * @param {string} [transactionData.razorpayOrderId] - Razorpay order ID
 * @param {string} [transactionData.method] - Payment method
 * @param {Object} [transactionData.methodDetails] - Payment method details
 * @param {Object} [transactionData.gatewayResponse] - Gateway response
 * @returns {number} Transaction ID
 * @throws {Error} If transaction recording fails
 */
function recordSubscriptionTransaction(db, transactionData) {
	try {
		const {
			userId,
			subscriptionId,
			transactionType,
			amount,
			status,
			description,
			razorpayPaymentId = null,
			razorpayOrderId = null,
			method = 'free_plan',
			methodDetails = null,
			gatewayResponse = null,
		} = transactionData;

		// Validate required fields
		if (!userId || !subscriptionId || !transactionType || typeof amount !== 'number' || !status) {
			throw new Error('Missing required transaction data for audit trail');
		}

		const insertTransaction = db.prepare(`
            INSERT INTO subscription_transactions (
                user_id, subscription_id, razorpay_payment_id, razorpay_order_id,
                transaction_type, amount, net_amount, currency, status,
                method, description, method_details_json, gateway_response_json,
                processed_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);

		const transactionResult = insertTransaction.run(
			userId,
			subscriptionId,
			razorpayPaymentId,
			razorpayOrderId,
			transactionType,
			amount,
			amount, // net_amount same as amount for most cases
			'INR',
			status,
			method,
			description || `${transactionType} transaction`,
			methodDetails ? JSON.stringify(methodDetails) : null,
			gatewayResponse ? JSON.stringify(gatewayResponse) : null,
			new Date().toISOString()
		);

		console.log(`Transaction recorded for audit trail: ${transactionType} - Subscription ID: ${subscriptionId}, Transaction ID: ${transactionResult.lastInsertRowid}`);
		return Number(transactionResult.lastInsertRowid);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Failed to record subscription transaction:', errorMessage);
		throw error;
	} finally {
		console.debug('Subscription transaction recording process completed');
	}
}

const { getActivePlans, getPlanByCode, getRazorpayPlanId } = require('../../data/subscription-plans');
const { RAZORPAY_KEY_ID } = require('../../data/env');

/**
 * Validate plan code against available plans
 * @param {string} planCode - Plan code to validate
 * @returns {boolean} True if plan code is valid
 */
function isValidPlanCode(planCode) {
	try {
		const plan = getPlanByCode(planCode);
		return plan !== null;
	} catch (error) {
		return false;
	} finally {
		console.debug('Plan code validation completed');
	}
}

/**
 * Validate billing cycle
 * @param {string} billingCycle - Billing cycle to validate
 * @returns {boolean} True if billing cycle is valid
 */
function isValidBillingCycle(billingCycle) {
	try {
		return ['monthly', 'yearly'].includes(billingCycle?.toLowerCase());
	} catch (error) {
		return false;
	} finally {
		console.debug('Billing cycle validation completed');
	}
}

/**
 * Get all available subscription plans
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
async function getAllPlans(req, res) {
	try {
		// Get all active plans from configuration
		const plans = getActivePlans();

		res.json({
			success: true,
			message: 'Subscription plans retrieved successfully',
			data: {
				plans: plans,
				total: plans.length,
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Get all plans failed:', errorMessage);

		res.status(500).json({
			success: false,
			message: 'Failed to retrieve subscription plans. Please try again later.',
			code: 'PLANS_FETCH_ERROR',
		});
	} finally {
		console.debug('Get all plans process completed');
	}
}

/**
 * Get user's current subscription details
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
async function getUserSubscription(req, res) {
	try {
		const userId = /** @type {number | undefined} */ (req.user?.id);

		if (!userId) {
			res.status(401).json({
				success: false,
				message: 'Please log in to view your subscription details.',
				code: 'AUTHENTICATION_REQUIRED',
			});
			return;
		}

		const db = getDb();

		// Get user's current subscription
		// Include created, active, authenticated subscriptions and cancelled subscriptions that are still in their paid period
		const getSubscription = db.prepare(`
            SELECT 
                us.*
            FROM user_subscriptions us
            WHERE us.user_id = ? AND (
                us.status IN ('created', 'active', 'authenticated') OR 
                (us.status = 'cancelled' AND us.cancel_at_period_end = 1 AND us.current_period_end > CURRENT_TIMESTAMP)
            )
            ORDER BY us.created_at DESC
            LIMIT 1
        `);

		const subscription = /** @type {DatabaseSubscription | undefined} */ (getSubscription.get(userId));

		// Check if user has any subscription (including cancelled ones) for credits calculation
		const getLatestSubscription = db.prepare(`
            SELECT 
                us.*
            FROM user_subscriptions us
            WHERE us.user_id = ?
            ORDER BY us.created_at DESC
            LIMIT 1
        `);

		const latestSubscription = /** @type {DatabaseSubscription | undefined} */ (getLatestSubscription.get(userId));

		if (!subscription) {
			// No subscription found - user is on free plan by default
			const freePlan = getPlanByCode('free');
			if (!freePlan) {
				res.status(500).json({
					success: false,
					message: 'Free plan configuration error. Please contact support.',
					code: 'FREE_PLAN_CONFIG_ERROR',
				});
				return;
			}

			res.json({
				success: true,
				message: 'No active subscription found',
				data: {
					subscription: null,
					currentPlan: {
						plan_code: 'free',
						name: freePlan.name,
						description: freePlan.description,
						features: freePlan.features,
						limits: freePlan.limits,
						price_monthly: freePlan.price_monthly,
						trial_days: freePlan.trial_days,
					},
				},
			});
			return;
		}

		// Get plan configuration for the subscription
		const planConfig = getPlanByCode(subscription.plan_code);
		if (!planConfig) {
			res.status(500).json({
				success: false,
				message: 'Plan configuration error. Please contact support.',
				code: 'PLAN_CONFIG_ERROR',
			});
			return;
		}

		// Merge subscription data with plan configuration
		const parsedSubscription = {
			...subscription,
			plan_name: planConfig.name,
			plan_description: planConfig.description,
			features: planConfig.features,
			limits: planConfig.limits,
			price_monthly: planConfig.price_monthly,
			price_yearly: planConfig.price_yearly,
			price_currency: planConfig.price_currency,
			trial_days: planConfig.trial_days,
			is_featured: planConfig.is_featured,
		};

		// Get account credits if any
		const getCredits = db.prepare(`
            SELECT SUM(remaining_amount) as total_credits
            FROM account_credits 
            WHERE user_id = ? AND is_active = 1 AND remaining_amount > 0
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `);

		const creditsResult = /** @type {DatabaseCredits | undefined} */ (getCredits.get(userId));
		const totalCredits = creditsResult?.total_credits || 0;

		// Determine subscription status and messaging
		const isActive = ['created', 'active', 'authenticated'].includes(parsedSubscription.status);
		const isCancelled = parsedSubscription.status === 'cancelled';
		const isTrialActive = parsedSubscription.trial_end && new Date(parsedSubscription.trial_end) > new Date();

		let message = 'Current subscription retrieved successfully';
		if (parsedSubscription.status === 'created') {
			message = 'Subscription is active and ready to use';
		}
		let responseData = {
			subscription: parsedSubscription,
			accountCredits: totalCredits,
			isActive: isActive,
			isTrialActive: isTrialActive,
		};

		// Handle cancelled subscription
		if (isCancelled) {
			if (parsedSubscription.cancel_at_period_end) {
				// End-of-period cancellation - still has access until period end
				const periodEnd = new Date(parsedSubscription.current_period_end);
				message = `Subscription cancelled but active until ${periodEnd.toLocaleDateString()}. No further charges will be made.`;
				responseData = {
					...responseData,
					isActive: true, // Still has access until period end
					isCancelledButActive: true,
					accessEndsAt: periodEnd.toISOString(),
					willRenew: false,
				};
			} else {
				// Immediate cancellation - access ended immediately
				const cancelledAt = new Date(parsedSubscription.cancelled_at);
				message = 'Subscription has been cancelled and access has ended immediately';
				responseData = {
					...responseData,
					isActive: false,
					isCancelledButActive: false,
					accessEndsAt: cancelledAt.toISOString(),
					willRenew: false,
				};
			}
		}

		res.json({
			success: true,
			message,
			data: responseData,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Get user subscription failed:', errorMessage);

		res.status(500).json({
			success: false,
			message: 'Failed to retrieve subscription details. Please try again later.',
			code: 'SUBSCRIPTION_FETCH_ERROR',
		});
	} finally {
		console.debug('Get user subscription process completed');
	}
}

/**
 * Replace existing subscription with new one (atomic operation)
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {number} userId - User ID
 * @param {DatabaseSubscription} existingSubscription - Existing subscription to replace
 * @param {string} newPlanCode - New plan code
 * @param {string} billingCycle - Billing cycle
 * @param {number} amount - Subscription amount
 * @param {PlanConfiguration} planConfig - Plan configuration
 * @param {string | null} razorpayPlanId - Razorpay plan ID
 * @returns {Promise<Object>} Replacement result
 */
async function replaceExistingSubscription(db, userId, existingSubscription, newPlanCode, billingCycle, amount, planConfig, razorpayPlanId) {
	try {
		// Cancel existing Razorpay subscription if it exists and is active
		if (existingSubscription.razorpay_subscription_id && ['active', 'authenticated', 'created'].includes(existingSubscription.status)) {
			try {
				await cancelRazorpaySubscription(existingSubscription.razorpay_subscription_id, {
					cancel_at_cycle_end: false, // Cancel immediately
				});
				console.log(`Cancelled existing Razorpay subscription: ${existingSubscription.razorpay_subscription_id}`);
			} catch (cancelError) {
				// Log error but continue - we'll mark as replaced in our DB
				console.warn('Failed to cancel existing Razorpay subscription:', cancelError.message);
				console.log('Continuing with local subscription replacement');
			}
		}

		if (amount === 0) {
			// Handle free plan replacement - no payment required
			const currentDate = new Date();
			const nextYear = new Date(currentDate);
			nextYear.setFullYear(currentDate.getFullYear() + 1);

			// Atomic replacement transaction with audit trail
			const replaceTransaction = db.transaction(() => {
				// Mark existing subscription as replaced
				const markReplaced = db.prepare(`
					UPDATE user_subscriptions 
					SET status = 'replaced',
						cancelled_at = CURRENT_TIMESTAMP,
						updated_at = CURRENT_TIMESTAMP
					WHERE id = ?
				`);
				markReplaced.run(existingSubscription.id);

				// Only record cancellation transaction if the existing subscription was actually active/paid
				// Don't create false cancellation records for subscriptions that were never activated
				if (['active', 'authenticated'].includes(existingSubscription.status)) {
					recordSubscriptionTransaction(db, {
						userId: userId,
						subscriptionId: existingSubscription.id,
						transactionType: 'adjustment',
						amount: 0,
						status: 'cancelled',
						description: `Subscription replaced: ${existingSubscription.plan_code} to ${newPlanCode}`,
						method: 'replacement',
						methodDetails: {
							old_plan_code: existingSubscription.plan_code,
							new_plan_code: newPlanCode,
							replacement_reason: 'plan_change'
						}
					});
				}

				// Create new subscription
				const insertSubscription = db.prepare(`
					INSERT INTO user_subscriptions (
						user_id, plan_code, status, billing_cycle,
						current_period_start, current_period_end, next_billing_date,
						total_amount, auto_renewal, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				`);

				const subscriptionResult = insertSubscription.run(
					userId,
					newPlanCode,
					'active',
					billingCycle,
					currentDate.toISOString(),
					nextYear.toISOString(),
					nextYear.toISOString(),
					0,
					0 // No auto-renewal for free plan
				);

				// Record activation transaction for new free subscription
				const transactionId = recordSubscriptionTransaction(db, {
					userId: userId,
					subscriptionId: Number(subscriptionResult.lastInsertRowid),
					transactionType: 'subscription',
					amount: 0,
					status: 'captured',
					description: `Free plan (${planConfig.name}) activation via replacement`,
					method: 'free_plan',
					methodDetails: {
						plan_code: newPlanCode,
						plan_name: planConfig.name,
						billing_cycle: billingCycle,
						activation_type: 'replacement',
						replaced_subscription_id: existingSubscription.id
					}
				});

				return {
					subscriptionId: Number(subscriptionResult.lastInsertRowid),
					transactionId: transactionId
				};
			});

			const result = replaceTransaction();

			return {
				success: true,
				message: `Subscription replaced successfully. ${planConfig.name} plan activated.`,
				data: {
					subscriptionId: result.subscriptionId,
					planName: planConfig.name,
					amount: 0,
					status: 'active',
					requiresPayment: false,
					wasReplaced: true,
					previousPlan: existingSubscription.plan_code,
					transactionId: result.transactionId,
				},
			};
		}

		// Handle paid plan replacement - requires payment
		// Get user details for customer creation
		const getUserDetails = db.prepare(`
			SELECT (first_name || ' ' || last_name) as name, email, NULL as phone, razorpay_customer_id FROM users WHERE id = ?
		`);
		const userDetails = /** @type {DatabaseUser | undefined} */ (getUserDetails.get(userId));

		if (!userDetails) {
			throw new Error('User not found');
		}

		// Get or create Razorpay customer
		let razorpayCustomer;
		if (userDetails.razorpay_customer_id) {
			try {
				razorpayCustomer = await fetchRazorpayCustomer(userDetails.razorpay_customer_id);
				razorpayCustomer.isNew = false;
			} catch (fetchError) {
				console.warn('Failed to fetch existing customer, creating new one:', fetchError.message);
				razorpayCustomer = await createRazorpayCustomer({
					name: userDetails.name,
					email: userDetails.email,
					contact: userDetails.phone || undefined,
					notes: {
						user_id: userId.toString(),
						created_for: 'subscription_replacement',
					},
				});
			}
		} else {
			razorpayCustomer = await createRazorpayCustomer({
				name: userDetails.name,
				email: userDetails.email,
				contact: userDetails.phone || undefined,
				notes: {
					user_id: userId.toString(),
					created_for: 'subscription_replacement',
				},
			});

			// Update user record with customer ID if it's new
			if (razorpayCustomer.isNew) {
				const updateUserCustomerId = db.prepare(`
					UPDATE users SET razorpay_customer_id = ? WHERE id = ?
				`);
				updateUserCustomerId.run(razorpayCustomer.id, userId);
			}
		}

		// Create new Razorpay subscription
		const subscription = await createRazorpaySubscription({
			plan_id: razorpayPlanId,
			customer_id: razorpayCustomer.id,
			total_count: billingCycle === 'yearly' ? 1 : 12,
			quantity: 1,
			customer_notify: 1,
			notes: {
				user_id: userId.toString(),
				plan_code: newPlanCode,
				billing_cycle: billingCycle,
				plan_name: planConfig.name,
				customer_id: razorpayCustomer.id,
				replaced_subscription_id: existingSubscription.id.toString(),
				is_replacement: 'true',
			},
		});

		// Atomic replacement transaction
		const currentDate = new Date();
		const periodEnd = new Date(currentDate);
		if (billingCycle === 'yearly') {
			periodEnd.setFullYear(currentDate.getFullYear() + 1);
		} else {
			periodEnd.setMonth(currentDate.getMonth() + 1);
		}

		const replaceTransaction = db.transaction(() => {
			// Mark existing subscription as replaced
			const markReplaced = db.prepare(`
				UPDATE user_subscriptions 
				SET status = 'replaced',
					cancelled_at = CURRENT_TIMESTAMP,
					updated_at = CURRENT_TIMESTAMP
				WHERE id = ?
			`);
			markReplaced.run(existingSubscription.id);

			// Only record cancellation transaction if the existing subscription was actually active/paid
			// Don't create false cancellation records for subscriptions that were never activated
			if (['active', 'authenticated'].includes(existingSubscription.status)) {
				recordSubscriptionTransaction(db, {
					userId: userId,
					subscriptionId: existingSubscription.id,
					transactionType: 'adjustment',
					amount: 0,
					status: 'cancelled',
					description: `Subscription replaced: ${existingSubscription.plan_code} to ${newPlanCode}`,
					method: 'replacement',
					methodDetails: {
						old_plan_code: existingSubscription.plan_code,
						new_plan_code: newPlanCode,
						replacement_reason: 'plan_change',
						old_razorpay_subscription_id: existingSubscription.razorpay_subscription_id
					}
				});
			}

			// Create new subscription
			const insertSubscription = db.prepare(`
				INSERT INTO user_subscriptions (
					user_id, plan_code, status, billing_cycle,
					current_period_start, current_period_end, next_billing_date,
					trial_start, trial_end, total_amount, auto_renewal,
					razorpay_subscription_id, razorpay_customer_id,
					created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			`);

			const subscriptionResult = insertSubscription.run(
				userId,
				newPlanCode,
				'created',
				billingCycle,
				currentDate.toISOString(),
				periodEnd.toISOString(),
				periodEnd.toISOString(),
				null, // trial_start
				null, // trial_end
				amount,
				1, // auto_renewal
				subscription.id,
				razorpayCustomer.id
			);

			// Record subscription creation transaction (will be updated to 'captured' by webhooks)
			const transactionId = recordSubscriptionTransaction(db, {
				userId: userId,
				subscriptionId: Number(subscriptionResult.lastInsertRowid),
				transactionType: 'subscription',
				amount: amount,
				status: 'created',
				description: `Paid plan (${planConfig.name}) subscription replacement`,
				method: 'razorpay_subscription',
				methodDetails: {
					plan_code: newPlanCode,
					plan_name: planConfig.name,
					billing_cycle: billingCycle,
					activation_type: 'replacement',
					replaced_subscription_id: existingSubscription.id,
					razorpay_subscription_id: subscription.id,
					razorpay_customer_id: razorpayCustomer.id
				},
				gatewayResponse: {
					razorpay_subscription_id: subscription.id,
					razorpay_plan_id: razorpayPlanId,
					customer_id: razorpayCustomer.id
				}
			});

			return {
				subscriptionId: Number(subscriptionResult.lastInsertRowid),
				transactionId: transactionId
			};
		});

		const result = replaceTransaction();

		return {
			success: true,
			message: `Subscription replaced successfully. Previous ${existingSubscription.plan_code} subscription cancelled and new ${planConfig.name} subscription created.`,
			data: {
				razorpayKeyId: RAZORPAY_KEY_ID,
				subscriptionId: result.subscriptionId,
				razorpaySubscriptionId: subscription.id,
				razorpayCustomerId: razorpayCustomer.id,
				planName: planConfig.name,
				billingCycle,
				amount: amount,
				trialDays: 0,
				hasTrialPeriod: false,
				nextBillingDate: periodEnd.toISOString(),
				requiresPayment: true,
				isSubscription: true,
				subscriptionUrl: subscription.short_url,
				status: 'created',
				wasReplaced: true,
				previousPlan: existingSubscription.plan_code,
				transactionId: result.transactionId,
			},
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Subscription replacement failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Subscription replacement process completed');
	}
}

/**
 * Create new subscription with Razorpay payment processing
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
async function createSubscription(req, res) {
	try {
		const userId = /** @type {number | undefined} */ (req.user?.id);
		const { planCode, billingCycle = 'monthly' } = req.body;

		if (!userId) {
			res.status(401).json({
				success: false,
				message: 'Please log in to create a subscription.',
				code: 'AUTHENTICATION_REQUIRED',
			});
			return;
		}

		if (!planCode) {
			res.status(400).json({
				success: false,
				message: 'Please select a valid subscription plan.',
				code: 'PLAN_CODE_REQUIRED',
			});
			return;
		}

		if (!isValidPlanCode(planCode)) {
			res.status(400).json({
				success: false,
				message: 'Invalid plan code provided.',
				code: 'INVALID_PLAN_CODE',
			});
			return;
		}

		if (!isValidBillingCycle(billingCycle)) {
			res.status(400).json({
				success: false,
				message: 'Please select a valid billing cycle (monthly or yearly).',
				code: 'INVALID_BILLING_CYCLE',
			});
			return;
		}

		const db = getDb();

		// Get plan configuration
		const planConfig = getPlanByCode(planCode);
		if (!planConfig || !planConfig.is_active) {
			res.status(404).json({
				success: false,
				message: 'Selected subscription plan not found or inactive.',
				code: 'PLAN_NOT_FOUND',
			});
			return;
		}

		// Calculate amount based on billing cycle
		const amount = billingCycle === 'yearly' ? planConfig.price_yearly : planConfig.price_monthly;

		// Get Razorpay plan ID for paid plans
		let razorpayPlanId = null;
		if (amount > 0) {
			try {
				razorpayPlanId = getRazorpayPlanId(planCode, billingCycle);

				if (!razorpayPlanId) {
					res.status(500).json({
						success: false,
						message: `Razorpay plan ID not configured for ${planCode} ${billingCycle}. Please contact support.`,
						code: 'RAZORPAY_PLAN_NOT_CONFIGURED',
					});
					return;
				}
			} catch (planError) {
				console.error('Failed to get Razorpay plan ID:', planError);
				res.status(500).json({
					success: false,
					message: 'Subscription plan configuration error. Please contact support.',
					code: 'PLAN_CONFIGURATION_ERROR',
				});
				return;
			}
		}

		// Check for ANY existing subscription to enforce ONE subscription per user
		const getExistingSubscription = db.prepare(`
            SELECT id, status, plan_code, razorpay_subscription_id FROM user_subscriptions 
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `);
		const existingSubscription = /** @type {DatabaseSubscription | undefined} */ (
			getExistingSubscription.get(userId)
		);

		// If user has existing subscription, replace it instead of creating duplicate
		if (existingSubscription) {
			console.log(`Replacing existing subscription for user ${userId}: ${existingSubscription.status} ${existingSubscription.plan_code}`);
			
			// If trying to create same plan and it's already active, return error
			// Note: 'created' status is NOT considered active - it means payment is pending
			if (existingSubscription.plan_code === planCode && ['active', 'authenticated'].includes(existingSubscription.status)) {
				res.status(409).json({
					success: false,
					message: `You already have an active ${planConfig.name} subscription.`,
					code: 'EXISTING_SUBSCRIPTION_FOUND',
				});
				return;
			}
			
			// Replace existing subscription with new one
			try {
				const replacementResult = await replaceExistingSubscription(db, userId, existingSubscription, planCode, billingCycle, amount, planConfig, razorpayPlanId);
				res.json(replacementResult);
				return;
			} catch (replacementError) {
				console.error('Subscription replacement failed:', replacementError);
				throw new Error('Failed to replace existing subscription. Please try again.');
			}
		}

		if (amount === 0) {
			// Handle free plan - no payment required
			const currentDate = new Date();
			const nextYear = new Date(currentDate);
			nextYear.setFullYear(currentDate.getFullYear() + 1);

			// Atomic transaction for free plan creation with audit trail
			const freeSubscriptionTransaction = db.transaction(() => {
				const insertSubscription = db.prepare(`
					INSERT INTO user_subscriptions (
						user_id, plan_code, status, billing_cycle,
						current_period_start, current_period_end, next_billing_date,
						total_amount, auto_renewal
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				`);

				const subscriptionResult = insertSubscription.run(
					userId,
					planCode,
					'active',
					billingCycle,
					currentDate.toISOString(),
					nextYear.toISOString(),
					nextYear.toISOString(),
					0,
					0 // No auto-renewal for free plan
				);

				// Record transaction for free plan activation
				const transactionId = recordSubscriptionTransaction(db, {
					userId: userId,
					subscriptionId: Number(subscriptionResult.lastInsertRowid),
					transactionType: 'subscription',
					amount: 0,
					status: 'captured',
					description: `Free plan (${planConfig.name}) activation`,
					method: 'free_plan',
					methodDetails: {
						plan_code: planCode,
						plan_name: planConfig.name,
						billing_cycle: billingCycle,
						activation_type: 'free_plan'
					}
				});

				return {
					subscriptionId: Number(subscriptionResult.lastInsertRowid),
					transactionId: transactionId
				};
			});

			const result = freeSubscriptionTransaction();

			res.json({
				success: true,
				message: 'Free plan activated successfully',
				data: {
					subscriptionId: result.subscriptionId,
					planName: planConfig.name,
					amount: 0,
					status: 'active',
					requiresPayment: false,
					transactionId: result.transactionId,
				},
			});
			return;
		}

		// Create Razorpay subscription for paid plans
		try {
			// Get user details for customer creation
			const getUserDetails = db.prepare(`
                SELECT (first_name || ' ' || last_name) as name, email, NULL as phone FROM users WHERE id = ?
            `);
			const userDetails = /** @type {DatabaseUser | undefined} */ (getUserDetails.get(userId));

			if (!userDetails) {
				res.status(404).json({
					success: false,
					message: 'User not found. Please log in again.',
					code: 'USER_NOT_FOUND',
				});
				return;
			}

			// Get or create Razorpay customer
			let razorpayCustomer;
			try {
				razorpayCustomer = await createRazorpayCustomer({
					name: userDetails.name,
					email: userDetails.email,
					contact: userDetails.phone || undefined,
					notes: {
						user_id: userId.toString(),
						created_for: 'subscription',
					},
				});
			} catch (customerError) {
				console.error('Failed to create Razorpay customer:', customerError);
				res.status(500).json({
					success: false,
					message: 'Failed to set up customer account with payment gateway. Please try again.',
					code: 'CUSTOMER_CREATION_FAILED',
				});
				return;
			}

			// Update user record with Razorpay customer ID if it's a new customer
			if (razorpayCustomer.isNew) {
				const updateUserCustomerId = db.prepare(`
                    UPDATE users SET razorpay_customer_id = ? WHERE id = ?
                `);
				updateUserCustomerId.run(razorpayCustomer.id, userId);
			}

			// Create Razorpay subscription using the plan ID from configuration
			try {
				const subscription = await createRazorpaySubscription({
					plan_id: razorpayPlanId, // Use plan ID from razorpay-plans.js configuration
					customer_id: razorpayCustomer.id, // Link to customer
					total_count: billingCycle === 'yearly' ? 1 : 12, // 1 cycle for yearly, 12 for monthly
					quantity: 1,
					customer_notify: 1,
					notes: {
						user_id: userId.toString(),
						plan_code: planCode,
						billing_cycle: billingCycle,
						plan_name: planConfig.name,
						customer_id: razorpayCustomer.id,
					},
				});

				// Store subscription details in database with transaction recording
				const currentDate = new Date();
				const periodEnd = new Date(currentDate);
				if (billingCycle === 'yearly') {
					periodEnd.setFullYear(currentDate.getFullYear() + 1);
				} else {
					periodEnd.setMonth(currentDate.getMonth() + 1);
				}

				// No trial period - subscriptions are immediately active
				const trialStart = null;
				const trialEnd = null;

				// Atomic transaction for subscription creation with audit trail
				const createSubscriptionTransaction = db.transaction(() => {
					const insertSubscription = db.prepare(`
						INSERT INTO user_subscriptions (
							user_id, plan_code, status, billing_cycle,
							current_period_start, current_period_end, next_billing_date,
							trial_start, trial_end, total_amount, auto_renewal,
							razorpay_subscription_id, razorpay_customer_id
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`);

					const subscriptionResult = insertSubscription.run(
						userId,
						planCode,
						'created',
						billingCycle,
						currentDate.toISOString(),
						periodEnd.toISOString(),
						periodEnd.toISOString(),
						trialStart,
						trialEnd,
						amount,
						1,
						subscription.id,
						razorpayCustomer.id
					);

					// Record subscription creation transaction (will be updated to 'captured' by webhooks)
					const transactionId = recordSubscriptionTransaction(db, {
						userId: userId,
						subscriptionId: Number(subscriptionResult.lastInsertRowid),
						transactionType: 'subscription',
						amount: amount,
						status: 'created',
						description: `Paid plan (${planConfig.name}) subscription creation`,
						method: 'razorpay_subscription',
						methodDetails: {
							plan_code: planCode,
							plan_name: planConfig.name,
							billing_cycle: billingCycle,
							activation_type: 'new_subscription',
							razorpay_subscription_id: subscription.id,
							razorpay_customer_id: razorpayCustomer.id
						},
						gatewayResponse: {
							razorpay_subscription_id: subscription.id,
							razorpay_plan_id: razorpayPlanId,
							customer_id: razorpayCustomer.id,
							subscription_url: subscription.short_url
						}
					});

					return {
						subscriptionId: Number(subscriptionResult.lastInsertRowid),
						transactionId: transactionId
					};
				});

				const result = createSubscriptionTransaction();

				res.json({
					success: true,
					message:
						'Subscription created successfully. You will be charged automatically according to your billing cycle.',
					data: {
						razorpayKeyId: RAZORPAY_KEY_ID,
						subscriptionId: result.subscriptionId,
						razorpaySubscriptionId: subscription.id,
						razorpayCustomerId: razorpayCustomer.id,
						planName: planConfig.name,
						billingCycle,
						amount: amount,
						trialDays: 0,
						hasTrialPeriod: false,
						nextBillingDate: periodEnd.toISOString(),
						requiresPayment: true,
						isSubscription: true,
						subscriptionUrl: subscription.short_url,
						status: 'created',
						transactionId: result.transactionId,
					},
				});
				return;
			} catch (subscriptionError) {
				console.error('Razorpay subscription creation failed:', {
					statusCode: subscriptionError.statusCode,
					status: subscriptionError.status,
					errorMessage: subscriptionError.message,
					errorDescription: subscriptionError.error?.description,
					planCode: planCode,
					razorpayPlanId: razorpayPlanId,
				});

				// If subscription creation fails, this indicates a configuration issue
				res.status(500).json({
					success: false,
					message: 'Failed to create subscription. Please contact support.',
					code: 'SUBSCRIPTION_CREATION_FAILED',
					details: subscriptionError.error?.description || subscriptionError.message,
				});
				return;
			}
		} catch (error) {
			// Handle any other errors in subscription creation
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error('Subscription creation process failed:', errorMessage);

			// Check for authentication errors
			if (error.statusCode === 401) {
				console.error('Razorpay authentication failed - check API credentials');
				throw new Error('Payment gateway configuration error. Please contact support.');
			}

			// Check for specific Razorpay errors
			const errorDescription = error.error?.description || error.message || 'Unknown error';
			console.error('Razorpay error details:', errorDescription);

			throw new Error('Payment processing setup failed. Please try again.');
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Create subscription failed:', errorMessage);

		res.status(500).json({
			success: false,
			message: errorMessage.includes('Payment processing')
				? errorMessage
				: 'Failed to create subscription. Please try again later.',
			code: 'SUBSCRIPTION_CREATION_FAILED',
		});
	} finally {
		console.debug('Create subscription process completed');
	}
}

/**
 * Upgrade subscription plan with prorated billing
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
async function upgradeSubscription(req, res) {
	try {
		const userId = /** @type {number | undefined} */ (req.user?.id);
		const { newPlanCode } = req.body;

		// Log upgrade attempt for monitoring
		console.log('Subscription upgrade attempt:', {
			userId: userId,
			newPlanCode: newPlanCode,
			timestamp: new Date().toISOString(),
			userAgent: req.get('User-Agent'),
			ip: req.ip
		});

		if (!userId) {
			console.warn('Subscription upgrade attempt without authentication:', {
				newPlanCode: newPlanCode,
				ip: req.ip,
				timestamp: new Date().toISOString()
			});
			res.status(401).json({
				success: false,
				message: 'Please log in to upgrade your subscription.',
				code: 'AUTHENTICATION_REQUIRED',
			});
			return;
		}

		if (!newPlanCode) {
			res.status(400).json({
				success: false,
				message: 'Please select a valid plan to upgrade to.',
				code: 'NEW_PLAN_CODE_REQUIRED',
			});
			return;
		}

		if (!isValidPlanCode(newPlanCode)) {
			res.status(400).json({
				success: false,
				message: 'Invalid plan code provided.',
				code: 'INVALID_PLAN_CODE',
			});
			return;
		}

		const db = getDb();

		// Get current subscription
		const getCurrentSubscription = db.prepare(`
            SELECT us.*
            FROM user_subscriptions us
            WHERE us.user_id = ? AND us.status IN ('created', 'active', 'authenticated')
            ORDER BY us.created_at DESC
            LIMIT 1
        `);
		const currentSubscription = /** @type {DatabaseSubscription | undefined} */ (
			getCurrentSubscription.get(userId)
		);

		if (!currentSubscription) {
			res.status(404).json({
				success: false,
				message: 'No active subscription found. Please create a subscription first.',
				code: 'NO_ACTIVE_SUBSCRIPTION',
			});
			return;
		}

		// Get current and new plan configurations
		const currentPlanConfig = getPlanByCode(currentSubscription.plan_code);
		const newPlanConfig = getPlanByCode(newPlanCode);

		if (!currentPlanConfig) {
			res.status(500).json({
				success: false,
				message: 'Current plan configuration error. Please contact support.',
				code: 'CURRENT_PLAN_CONFIG_ERROR',
			});
			return;
		}

		if (!newPlanConfig || !newPlanConfig.is_active) {
			res.status(404).json({
				success: false,
				message: 'Selected plan not found or inactive.',
				code: 'NEW_PLAN_NOT_FOUND',
			});
			return;
		}

		// Prevent downgrade to same plan
		if (currentSubscription.plan_code === newPlanCode) {
			res.status(400).json({
				success: false,
				message: 'You are already on this plan.',
				code: 'SAME_PLAN_SELECTED',
			});
			return;
		}

		// Calculate current and new plan prices based on billing cycle
		const currentPlanPrice =
			currentSubscription.billing_cycle === 'yearly'
				? currentPlanConfig.price_yearly
				: currentPlanConfig.price_monthly;
		const newPlanPrice =
			currentSubscription.billing_cycle === 'yearly' ? newPlanConfig.price_yearly : newPlanConfig.price_monthly;

		// Allow both upgrades and downgrades - let the pricing comparison determine the flow
		console.log('Plan change details:', {
			currentPlan: currentSubscription.plan_code,
			newPlan: newPlanCode,
			currentPrice: currentPlanPrice,
			newPrice: newPlanPrice,
			isUpgrade: newPlanPrice > currentPlanPrice,
			isDowngrade: newPlanPrice < currentPlanPrice
		});

		// Get Razorpay plan ID for the new plan
		let newRazorpayPlanId;
		try {
			newRazorpayPlanId = getRazorpayPlanId(newPlanCode, currentSubscription.billing_cycle);
			if (!newRazorpayPlanId) {
				res.status(500).json({
					success: false,
					message: `Razorpay plan ID not configured for ${newPlanCode} ${currentSubscription.billing_cycle}. Please contact support.`,
					code: 'NEW_PLAN_RAZORPAY_NOT_CONFIGURED',
				});
				return;
			}
		} catch (planError) {
			console.error('Failed to get Razorpay plan ID for new plan:', planError);
			res.status(500).json({
				success: false,
				message: 'New subscription plan configuration error. Please contact support.',
				code: 'NEW_PLAN_CONFIGURATION_ERROR',
			});
			return;
		}

		// Check if this is a legacy subscription (without razorpay_subscription_id)
		const isLegacySubscription = !currentSubscription.razorpay_subscription_id;

		if (isLegacySubscription) {
			console.log('Processing legacy subscription upgrade for user:', userId);

			// Get or create Razorpay customer for legacy subscription upgrade
			let razorpayCustomer;
			try {
				const getUserDetails = db.prepare(`
                    SELECT (first_name || ' ' || last_name) as name, email, NULL as phone, razorpay_customer_id FROM users WHERE id = ?
                `);
				const userDetails = /** @type {DatabaseUser | undefined} */ (getUserDetails.get(userId));

				if (!userDetails) {
					res.status(404).json({
						success: false,
						message: 'User not found. Please log in again.',
						code: 'USER_NOT_FOUND',
					});
					return;
				}

				// Get or create customer
				if (userDetails.razorpay_customer_id) {
					razorpayCustomer = await fetchRazorpayCustomer(userDetails.razorpay_customer_id);
					razorpayCustomer.isNew = false;
				} else {
					razorpayCustomer = await createRazorpayCustomer({
						name: userDetails.name,
						email: userDetails.email,
						contact: userDetails.phone || undefined,
						notes: {
							user_id: userId.toString(),
							created_for: 'legacy_upgrade',
						},
					});

					// Update user record with customer ID
					if (razorpayCustomer.isNew) {
						const updateUserCustomerId = db.prepare(`
                            UPDATE users SET razorpay_customer_id = ? WHERE id = ?
                        `);
						updateUserCustomerId.run(razorpayCustomer.id, userId);
					}
				}
			} catch (customerError) {
				console.error('Failed to setup customer for legacy upgrade:', customerError);
				res.status(500).json({
					success: false,
					message: 'Failed to set up customer account for upgrade. Please try again.',
					code: 'CUSTOMER_SETUP_FAILED',
				});
				return;
			}

			// Handle legacy subscription upgrade by creating new subscription
			try {
				// Create new Razorpay subscription for the new plan
				const subscription = await createRazorpaySubscription({
					plan_id: newRazorpayPlanId,
					customer_id: razorpayCustomer.id,
					total_count: currentSubscription.billing_cycle === 'yearly' ? 1 : 12,
					quantity: 1,
					customer_notify: 1,
					notes: {
						user_id: userId.toString(),
						old_subscription_id: currentSubscription.id.toString(),
						upgrade_from_legacy: 'true',
						old_plan_code: currentSubscription.plan_code,
						new_plan_code: newPlanCode,
						customer_id: razorpayCustomer.id,
					},
				});

				// Start database transaction for atomic upgrade with audit trail
				const upgradeTransaction = db.transaction(() => {
					// Mark old subscription as upgraded
					const markOldSubscription = db.prepare(`
                        UPDATE user_subscriptions 
                        SET status = 'upgraded',
                            cancelled_at = CURRENT_TIMESTAMP,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `);
					markOldSubscription.run(currentSubscription.id);

					// Record cancellation transaction for old subscription
					recordSubscriptionTransaction(db, {
						userId: userId,
						subscriptionId: currentSubscription.id,
						transactionType: 'adjustment',
						amount: 0,
						status: 'cancelled',
						description: `Legacy subscription upgraded: ${currentSubscription.plan_code} to ${newPlanCode}`,
						method: 'legacy_upgrade',
						methodDetails: {
							old_plan_code: currentSubscription.plan_code,
							new_plan_code: newPlanCode,
							upgrade_reason: 'legacy_to_razorpay',
							old_subscription_id: currentSubscription.id
						}
					});

					// Calculate new billing dates
					const now = new Date();
					const nextBilling = new Date(now);
					if (currentSubscription.billing_cycle === 'yearly') {
						nextBilling.setFullYear(now.getFullYear() + 1);
					} else {
						nextBilling.setMonth(now.getMonth() + 1);
					}

					// Create new subscription record with customer ID
					const insertNewSubscription = db.prepare(`
                        INSERT INTO user_subscriptions (
                            user_id, plan_code, status, billing_cycle,
                            razorpay_subscription_id, razorpay_customer_id, current_period_start, current_period_end,
                            next_billing_date, total_amount, auto_renewal, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    `);

					const subscriptionResult = insertNewSubscription.run(
						userId,
						newPlanCode,
						'created', // Will be updated to 'active' via webhooks
						currentSubscription.billing_cycle,
						subscription.id,
						razorpayCustomer.id,
						now.toISOString(),
						nextBilling.toISOString(),
						nextBilling.toISOString(),
						newPlanPrice,
						1
					);

					// Record creation transaction for new subscription
					const transactionId = recordSubscriptionTransaction(db, {
						userId: userId,
						subscriptionId: Number(subscriptionResult.lastInsertRowid),
						transactionType: 'subscription',
						amount: newPlanPrice,
						status: 'created',
						description: `Legacy upgrade: ${currentPlanConfig.name} to ${newPlanConfig.name}`,
						method: 'razorpay_subscription',
						methodDetails: {
							old_plan_code: currentSubscription.plan_code,
							new_plan_code: newPlanCode,
							old_plan_name: currentPlanConfig.name,
							new_plan_name: newPlanConfig.name,
							billing_cycle: currentSubscription.billing_cycle,
							upgrade_type: 'legacy_upgrade',
							razorpay_subscription_id: subscription.id,
							razorpay_customer_id: razorpayCustomer.id
						},
						gatewayResponse: {
							razorpay_subscription_id: subscription.id,
							legacy_upgrade: true
						}
					});

					return {
						subscriptionId: Number(subscriptionResult.lastInsertRowid),
						transactionId: transactionId
					};
				});

				// Execute the transaction
				const result = upgradeTransaction();

				res.json({
					success: true,
					message: `Legacy subscription upgraded successfully from ${currentPlanConfig.name} to ${newPlanConfig.name}. Please complete the payment to activate your new plan.`,
					data: {
						subscriptionId: result.subscriptionId,
						razorpaySubscriptionId: subscription.id,
						currentPlan: currentPlanConfig.name,
						newPlan: newPlanConfig.name,
						newPlanPrice,
						currency: newPlanConfig.price_currency || 'INR',
						billingCycle: currentSubscription.billing_cycle,
						requiresPayment: true,
						isLegacyUpgrade: true,
						razorpayKeyId: process.env.RAZORPAY_KEY_ID,
						transactionId: result.transactionId,
					},
				});
				return;
			} catch (legacyUpgradeError) {
				console.log('Legacy subscription upgrade failed, analyzing error for fallback:', {
					statusCode: legacyUpgradeError.statusCode,
					status: legacyUpgradeError.status,
					errorMessage: legacyUpgradeError.message,
					errorDescription: legacyUpgradeError.error?.description,
					planCode: newPlanCode,
					razorpayPlanId: newRazorpayPlanId,
				});

				// Check if it's a "plan not found" error or credential/configuration error
				const errorDescription = legacyUpgradeError.error?.description || legacyUpgradeError.message || '';
				const errorCode = legacyUpgradeError.error?.code || '';
				const isPlanNotFoundError =
					errorDescription.includes('does not exist') ||
					errorDescription.includes('not found') ||
					errorDescription.includes('invalid') ||
					errorDescription.includes('credentials not configured') ||
					errorCode.includes('BAD_REQUEST_ERROR') ||
					legacyUpgradeError.statusCode === 400 ||
					legacyUpgradeError.status === 400;

				if (isPlanNotFoundError) {
					console.log(
						`Legacy upgrade fallback: Plan ${newPlanCode} (${newRazorpayPlanId}) not found in Razorpay, using order-based upgrade`
					);

					// FALLBACK: Use order-based payment for legacy upgrade
					const order = await createRazorpayOrder({
						amount: newPlanPrice,
						currency: newPlanConfig.price_currency || 'INR',
						receipt: `upgrade_${userId}_${Date.now()}`,
						notes: {
							user_id: userId.toString(),
							old_subscription_id: currentSubscription.id.toString(),
							upgrade_from_legacy: 'true',
							old_plan_code: currentSubscription.plan_code,
							new_plan_code: newPlanCode,
							fallback_payment: 'true',
							customer_id: razorpayCustomer.id,
						},
					});

					// Start database transaction for atomic legacy upgrade (fallback mode) with audit trail
					const upgradeTransaction = db.transaction(() => {
						// Mark old subscription as upgraded
						const markOldSubscription = db.prepare(`
                            UPDATE user_subscriptions 
                            SET status = 'upgraded',
                                cancelled_at = CURRENT_TIMESTAMP,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `);
						markOldSubscription.run(currentSubscription.id);

						// Record cancellation transaction for old subscription
						recordSubscriptionTransaction(db, {
							userId: userId,
							subscriptionId: currentSubscription.id,
							transactionType: 'adjustment',
							amount: 0,
							status: 'cancelled',
							description: `Legacy subscription upgraded (fallback): ${currentSubscription.plan_code} to ${newPlanCode}`,
							method: 'legacy_upgrade_fallback',
							methodDetails: {
								old_plan_code: currentSubscription.plan_code,
								new_plan_code: newPlanCode,
								upgrade_reason: 'legacy_to_order_fallback',
								old_subscription_id: currentSubscription.id,
								fallback_reason: 'Razorpay subscription creation failed'
							}
						});

						// Calculate new billing dates
						const now = new Date();
						const nextBilling = new Date(now);
						if (currentSubscription.billing_cycle === 'yearly') {
							nextBilling.setFullYear(now.getFullYear() + 1);
						} else {
							nextBilling.setMonth(now.getMonth() + 1);
						}

						// Create new subscription record without razorpay_subscription_id (fallback mode)
						const insertNewSubscription = db.prepare(`
                            INSERT INTO user_subscriptions (
                                user_id, plan_code, status, billing_cycle,
                                current_period_start, current_period_end,
                                next_billing_date, total_amount, auto_renewal, 
                                razorpay_customer_id, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        `);

						const subscriptionResult = insertNewSubscription.run(
							userId,
							newPlanCode,
							'created', // Will be updated to 'active' when payment is completed
							currentSubscription.billing_cycle,
							now.toISOString(),
							nextBilling.toISOString(),
							nextBilling.toISOString(),
							newPlanPrice,
							1,
							razorpayCustomer.id
						);

						// Record creation transaction for new subscription (fallback mode)
						const transactionId = recordSubscriptionTransaction(db, {
							userId: userId,
							subscriptionId: Number(subscriptionResult.lastInsertRowid),
							transactionType: 'subscription',
							amount: newPlanPrice,
							status: 'created',
							description: `Legacy upgrade fallback: ${currentPlanConfig.name} to ${newPlanConfig.name}`,
							method: 'razorpay_order',
							razorpayOrderId: order.id,
							methodDetails: {
								old_plan_code: currentSubscription.plan_code,
								new_plan_code: newPlanCode,
								old_plan_name: currentPlanConfig.name,
								new_plan_name: newPlanConfig.name,
								billing_cycle: currentSubscription.billing_cycle,
								upgrade_type: 'legacy_upgrade_fallback',
								razorpay_customer_id: razorpayCustomer.id,
								fallback_reason: 'Razorpay subscription creation failed'
							},
							gatewayResponse: {
								razorpay_order_id: order.id,
								fallback_mode: true,
								order_amount: order.amount,
								order_currency: order.currency
							}
						});

						return {
							subscriptionId: Number(subscriptionResult.lastInsertRowid),
							transactionId: transactionId
						};
					});

					// Execute the transaction
					const result = upgradeTransaction();

					res.json({
						success: true,
						message: `Legacy subscription upgraded successfully from ${currentPlanConfig.name} to ${newPlanConfig.name} in fallback mode. Please complete the payment to activate your new plan.`,
						data: {
							subscriptionId: result.subscriptionId,
							orderId: order.id,
							amount: order.amount,
							currency: order.currency,
							currentPlan: currentPlanConfig.name,
							newPlan: newPlanConfig.name,
							newPlanPrice,
							billingCycle: currentSubscription.billing_cycle,
							requiresPayment: true,
							isLegacyUpgrade: true,
							isFallbackMode: true,
							fallbackReason: 'Razorpay subscription creation failed',
							razorpayKeyId: process.env.RAZORPAY_KEY_ID,
							transactionId: result.transactionId,
						},
					});
					return;
				} else {
					// Check for authentication errors
					if (legacyUpgradeError.statusCode === 401) {
						console.error('Razorpay authentication failed - check API credentials');
						throw new Error('Payment gateway configuration error. Please contact support.');
					}

					// Check for specific Razorpay errors
					const errorDescription =
						legacyUpgradeError.error?.description || legacyUpgradeError.message || 'Unknown error';
					console.error('Legacy upgrade Razorpay error details:', errorDescription);

					throw new Error(
						'Legacy subscription upgrade processing failed. Please try again or contact support.'
					);
				}
			}
		}

		// Determine change type for logic
		const isDowngrade = newPlanPrice < currentPlanPrice;
		const isUpgrade = newPlanPrice > currentPlanPrice;

		// Update Razorpay subscription with immediate plan change
		try {
			const updatedSubscription = await updateRazorpaySubscription(currentSubscription.razorpay_subscription_id, {
				plan_id: newRazorpayPlanId, // Use plan ID from configuration
				schedule_change_at: 'now', // Always immediate - we handle no-refund policy in our logic
				quantity: 1,
				notes: {
					changed_by: 'user',
					change_type: isDowngrade ? 'downgrade' : 'upgrade',
					old_plan_code: currentSubscription.plan_code,
					new_plan_code: newPlanCode,
					change_date: new Date().toISOString(),
					schedule: isDowngrade ? 'cycle_end' : 'immediate',
					no_refund_policy: isDowngrade ? 'true' : 'false'
				},
			});

			// Update database subscription record immediately with transaction recording
			// Atomic transaction for upgrade with audit trail
			const upgradeTransaction = db.transaction(() => {
				const updateSubscription = db.prepare(`
					UPDATE user_subscriptions 
					SET plan_code = ?,
						total_amount = ?,
						updated_at = CURRENT_TIMESTAMP
					WHERE id = ?
				`);

				updateSubscription.run(newPlanCode, newPlanPrice, currentSubscription.id);

				// Record plan change transaction for audit trail
				// Change type variables already declared above
				const priceDifference = Math.abs(newPlanPrice - currentPlanPrice);
				
				const transactionId = recordSubscriptionTransaction(db, {
					userId: userId,
					subscriptionId: currentSubscription.id,
					transactionType: isDowngrade ? 'adjustment' : 'subscription',
					amount: isDowngrade ? 0 : priceDifference, // For downgrades, use 0; for upgrades, use difference
					status: 'captured',
					description: `Subscription ${isDowngrade ? 'downgrade' : 'upgrade'}: ${currentPlanConfig.name} to ${newPlanConfig.name}`,
					method: 'razorpay_subscription_update',
					methodDetails: {
						old_plan_code: currentSubscription.plan_code,
						new_plan_code: newPlanCode,
						old_plan_name: currentPlanConfig.name,
						new_plan_name: newPlanConfig.name,
						old_plan_price: currentPlanPrice,
						new_plan_price: newPlanPrice,
						price_difference: priceDifference,
						billing_cycle: currentSubscription.billing_cycle,
						change_type: isDowngrade ? 'downgrade' : 'upgrade',
						plan_change_type: 'immediate',
						razorpay_subscription_id: currentSubscription.razorpay_subscription_id
					},
					gatewayResponse: {
						razorpay_subscription_id: currentSubscription.razorpay_subscription_id,
						upgrade_processed_at: new Date().toISOString()
					}
				});

				return transactionId;
			});

			const transactionId = upgradeTransaction();

			// Calculate proration information for response
			const now = new Date();
			const periodEnd = new Date(currentSubscription.current_period_end);
			const totalDays = currentSubscription.billing_cycle === 'yearly' ? 365 : 30;
			const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

			const proratedInfo = calculateProratedAmount({
				currentPlanPrice,
				newPlanPrice,
				daysRemaining,
				totalDays,
			});

			// Change type already determined above

			// Format amounts for display (paise to rupees)
			const formattedProratedAmount = (Math.abs(proratedInfo.proratedAmount) / 100).toFixed(2);
			const formattedCurrentPrice = (currentPlanPrice / 100).toFixed(2);
			const formattedNewPrice = (newPlanPrice / 100).toFixed(2);
			const formattedPriceDifference = (Math.abs(proratedInfo.priceDifference) / 100).toFixed(2);
			
			// Create detailed billing message
			const changeType = isDowngrade ? 'downgraded' : 'upgraded';
			let detailedMessage = `Subscription ${changeType} successfully from ${currentPlanConfig.name} to ${newPlanConfig.name}. `;
			
			if (isDowngrade) {
				// For downgrades, no refunds or credits are issued (per no-refund policy)
				detailedMessage += `You will continue to have access to your current ${currentPlanConfig.name} features until your next billing cycle. `;
				detailedMessage += `Starting from your next billing date, you will be charged ₹${formattedNewPrice} for the ${newPlanConfig.name} plan instead of ₹${formattedCurrentPrice}.`;
			} else {
				// For upgrades, user pays difference immediately
				if (proratedInfo.requiresPayment) {
					detailedMessage += `You will be charged ₹${formattedProratedAmount} immediately for the remaining ${daysRemaining} days of your billing cycle. `;
					detailedMessage += `This is calculated as (₹${formattedNewPrice} - ₹${formattedCurrentPrice}) × ${daysRemaining}/${totalDays} days = ₹${formattedProratedAmount}.`;
				} else {
					detailedMessage += `No additional charges apply for this billing period.`;
				}
			}

			res.json({
				success: true,
				message: detailedMessage,
				data: {
					subscriptionId: currentSubscription.id,
					razorpaySubscriptionId: currentSubscription.razorpay_subscription_id,
					currentPlan: currentPlanConfig.name,
					newPlan: newPlanConfig.name,
					currentPlanPrice,
					newPlanPrice,
					currency: newPlanConfig.price_currency || 'INR',
					billingCycle: currentSubscription.billing_cycle,
					upgradeProcessedAt: new Date().toISOString(),
					proration: {
						proratedAmount: proratedInfo.proratedAmount,
						daysRemaining,
						totalDays,
						daysUsed: proratedInfo.daysUsed,
						isUpgrade: proratedInfo.isUpgrade,
						isDowngrade: proratedInfo.isDowngrade,
						requiresPayment: proratedInfo.requiresPayment,
						creditAmount: proratedInfo.creditAmount,
						priceDifference: proratedInfo.priceDifference,
						// User-friendly formatted amounts
						formattedProratedAmount: `₹${formattedProratedAmount}`,
						formattedCurrentPrice: `₹${formattedCurrentPrice}`,
						formattedNewPrice: `₹${formattedNewPrice}`,
						formattedPriceDifference: `₹${formattedPriceDifference}`,
						// Detailed calculation breakdown
						calculationDetails: {
							formula: isDowngrade
								? 'No proration for downgrades (no-refund policy)'
								: proratedInfo.requiresPayment 
									? `(₹${formattedNewPrice} - ₹${formattedCurrentPrice}) × ${daysRemaining}/${totalDays} = ₹${formattedProratedAmount}`
									: 'No proration required',
							explanation: isDowngrade
								? `Downgrades take effect from your next billing cycle. You keep access to current plan features until then.`
								: proratedInfo.requiresPayment
									? `You pay the price difference for the remaining ${daysRemaining} days of your current billing cycle.`
									: 'Plans have the same price or no time remaining in current cycle.'
						}
					},
					billing: {
						immediateCharge: proratedInfo.requiresPayment && !isDowngrade, // No immediate charges for downgrades
						chargeAmount: (proratedInfo.requiresPayment && !isDowngrade) ? proratedInfo.proratedAmount : 0,
						chargeDescription: (proratedInfo.requiresPayment && !isDowngrade)
							? `Prorated upgrade from ${currentPlanConfig.name} to ${newPlanConfig.name}` 
							: null,
						creditAmount: isDowngrade ? 0 : proratedInfo.creditAmount, // No credits for downgrades (no-refund policy)
						creditDescription: isDowngrade ? null : (proratedInfo.creditAmount > 0 
							? `Unused portion of ${currentPlanConfig.name} plan` 
							: null),
						nextBillingAmount: newPlanPrice,
						nextBillingDate: currentSubscription.current_period_end,
						noRefundPolicy: isDowngrade ? true : false // Explicitly indicate no-refund policy for downgrades
					},
					requiresPayment: false, // Razorpay handles proration automatically
					hasProration: true,
					transactionId: transactionId,
				},
			});
		} catch (subscriptionUpdateError) {
			console.error('Razorpay subscription update failed:', {
				userId: userId,
				subscriptionId: currentSubscription.id,
				razorpaySubscriptionId: currentSubscription.razorpay_subscription_id,
				currentPlan: currentSubscription.plan_code,
				newPlan: newPlanCode,
				statusCode: subscriptionUpdateError.statusCode,
				errorMessage: subscriptionUpdateError.message,
				errorDescription: subscriptionUpdateError.error?.description,
				errorCode: subscriptionUpdateError.error?.code,
				timestamp: new Date().toISOString()
			});

			// Check for rate limiting errors
			if (subscriptionUpdateError.statusCode === 429) {
				console.warn('Razorpay rate limit hit for subscription update');
				throw new Error('Too many upgrade requests. Please wait a moment and try again.');
			}

			// Check for authentication errors
			if (subscriptionUpdateError.statusCode === 401) {
				console.error('Razorpay authentication failed - check API credentials');
				throw new Error('Payment gateway configuration error. Please contact support.');
			}

			// Check if subscription doesn't exist in Razorpay
			if (subscriptionUpdateError.statusCode === 404) {
				console.error('Razorpay subscription not found:', currentSubscription.razorpay_subscription_id);
				throw new Error('Subscription not found in payment gateway. Please contact support.');
			}

			// Check for plan configuration errors
			if (subscriptionUpdateError.statusCode === 400) {
				const errorDescription = subscriptionUpdateError.error?.description || '';
				if (errorDescription.includes('plan') || errorDescription.includes('Plan')) {
					console.error('Plan configuration error during upgrade:', errorDescription);
					throw new Error('Plan configuration error. Please contact support.');
				}
				if (errorDescription.includes('subscription') || errorDescription.includes('Subscription')) {
					console.error('Subscription state error during upgrade:', errorDescription);
					throw new Error('Current subscription cannot be upgraded at this time. Please contact support.');
				}
			}

			// Check for specific Razorpay errors
			const errorDescription =
				subscriptionUpdateError.error?.description || subscriptionUpdateError.message || 'Unknown error';
			console.error('Razorpay subscription update error details:', {
				description: errorDescription,
				errorCode: subscriptionUpdateError.error?.code,
				field: subscriptionUpdateError.error?.field,
				reason: subscriptionUpdateError.error?.reason
			});

			throw new Error('Subscription upgrade processing failed. Please try again or contact support if the issue persists.');
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Upgrade subscription failed:', errorMessage);

		res.status(500).json({
			success: false,
			message: errorMessage.includes('Payment processing')
				? errorMessage
				: 'Failed to process subscription upgrade. Please try again later.',
			code: 'SUBSCRIPTION_UPGRADE_FAILED',
		});
	} finally {
		console.debug('Upgrade subscription process completed');
	}
}

/**
 * Cancel subscription (moves to cancelled status)
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
async function cancelSubscription(req, res) {
	try {
		const userId = /** @type {number | undefined} */ (req.user?.id);
		const { immediate = false, reason, feedback } = req.body;


		if (!userId) {
			res.status(401).json({
				success: false,
				message: 'Please log in to cancel your subscription.',
				code: 'AUTHENTICATION_REQUIRED',
			});
			return;
		}

		const db = getDb();

		// Get current subscription (including cancelled ones that are still active until period end)
		const getCurrentSubscription = db.prepare(`
            SELECT us.*
            FROM user_subscriptions us
            WHERE us.user_id = ? AND (
                us.status IN ('created', 'active', 'authenticated') OR 
                (us.status = 'cancelled' AND us.cancel_at_period_end = 1 AND us.current_period_end > CURRENT_TIMESTAMP)
            )
            ORDER BY us.created_at DESC
            LIMIT 1
        `);
		const subscription = /** @type {DatabaseSubscription | undefined} */ (getCurrentSubscription.get(userId));

		if (!subscription) {
			res.status(404).json({
				success: false,
				message: 'No active subscription found to cancel.',
				code: 'NO_ACTIVE_SUBSCRIPTION',
			});
			return;
		}

		// Get plan configuration for the subscription
		const planConfig = getPlanByCode(subscription.plan_code);
		if (!planConfig) {
			res.status(500).json({
				success: false,
				message: 'Plan configuration error. Please contact support.',
				code: 'PLAN_CONFIG_ERROR',
			});
			return;
		}

		// Check if already fully cancelled (not just scheduled to cancel at period end)
		if (subscription.status === 'cancelled' && subscription.cancel_at_period_end === 0) {
			res.status(400).json({
				success: false,
				message: 'This subscription is already cancelled.',
				code: 'SUBSCRIPTION_ALREADY_CANCELLED',
			});
			return;
		}

		const currentDate = new Date();
		const periodEnd = new Date(subscription.current_period_end);

		// Handle Razorpay subscription cancellation if it exists
		console.log('SUBSCRIPTION: ', subscription);
		if (subscription.razorpay_subscription_id) {
			try {
				const cancelResult = await cancelRazorpaySubscription(subscription.razorpay_subscription_id, {
					cancel_at_cycle_end: !immediate, // Cancel immediately if immediate=true
					// Note: Razorpay cancel API does not support notes parameter
					// Cancellation details are tracked in our local database instead
				});

				// Check if this was a "created" status subscription that was handled locally
				if (cancelResult.notes?.cancelled_locally) {
					console.log(
						`Razorpay subscription ${subscription.razorpay_subscription_id} was in "created" status - handled locally without API call`
					);
				} else {
					console.log(
						`Razorpay subscription ${subscription.razorpay_subscription_id} cancelled successfully`
					);
				}
			} catch (razorpayError) {
				// Check for the specific "no billing cycle" error
				const isNoBillingCycleError =
					razorpayError.statusCode === 400 &&
					razorpayError.error?.description?.includes('no billing cycle is going on');

				if (isNoBillingCycleError) {
					console.warn(
						'Razorpay subscription cannot be cancelled - no billing cycle started. This is expected for "created" status subscriptions.'
					);
					console.log(
						`Proceeding with local cancellation for subscription ${subscription.razorpay_subscription_id}`
					);
				} else {
					console.error('Failed to cancel Razorpay subscription:', {
						subscriptionId: subscription.razorpay_subscription_id,
						error: razorpayError.message || razorpayError.error?.description || 'Unknown error',
						statusCode: razorpayError.statusCode,
						errorCode: razorpayError.error?.code,
						errorDescription: razorpayError.error?.description,
						fullErrorDetails: JSON.stringify(razorpayError, null, 2),
					});

					// Don't fail the entire operation if Razorpay cancellation fails
					// The subscription will be marked as cancelled in our database
					console.warn('Proceeding with local cancellation despite Razorpay error');
				}
			}
		} else {
			console.log('Legacy subscription without Razorpay ID - proceeding with local cancellation only');
		}

		// Update subscription status in database with transaction recording
		const cancelAtPeriodEnd = immediate ? 0 : 1;
		
		// Atomic transaction for cancellation with audit trail
		const cancellationTransaction = db.transaction(() => {
			const updateSubscription = db.prepare(`
				UPDATE user_subscriptions 
				SET status = 'cancelled',
					cancel_at_period_end = ?,
					cancelled_at = ?,
					cancellation_reason = ?,
					cancellation_feedback = ?,
					auto_renewal = 0,
					next_billing_date = NULL,
					updated_at = CURRENT_TIMESTAMP
				WHERE id = ?
			`);

			updateSubscription.run(
				cancelAtPeriodEnd,
				currentDate.toISOString(),
				reason || 'User requested cancellation',
				feedback || null,
				subscription.id
			);

			// Record cancellation transaction for audit trail
			const transactionId = recordSubscriptionTransaction(db, {
				userId: userId,
				subscriptionId: subscription.id,
				transactionType: 'adjustment',
				amount: 0,
				status: 'cancelled',
				description: `Subscription cancellation: ${planConfig.name} plan (${immediate ? 'immediate' : 'end of period'})`,
				method: subscription.razorpay_subscription_id ? 'razorpay_cancellation' : 'local_cancellation',
				methodDetails: {
					plan_code: subscription.plan_code,
					plan_name: planConfig.name,
					cancellation_type: immediate ? 'immediate' : 'end_of_period',
					cancel_at_period_end: cancelAtPeriodEnd,
					cancellation_reason: reason || 'User requested cancellation',
					cancellation_feedback: feedback || null,
					razorpay_subscription_id: subscription.razorpay_subscription_id || null,
					has_razorpay_subscription: !!subscription.razorpay_subscription_id
				}
			});

			return transactionId;
		});

		const transactionId = cancellationTransaction();

		// Determine when the subscription actually ends
		const accessEndsAt = immediate ? currentDate : periodEnd;
		const remainingDays = immediate
			? 0
			: Math.ceil((periodEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

		// Prepare success message based on cancellation type
		let successMessage;
		if (immediate) {
			successMessage = subscription.razorpay_subscription_id
				? 'Subscription cancelled immediately with Razorpay. You now have access to the Free plan.'
				: 'Subscription cancelled immediately. You now have access to the Free plan.';
		} else {
			successMessage = subscription.razorpay_subscription_id
				? `Subscription cancelled with Razorpay and will end at cycle completion. You'll continue to have ${
						planConfig.name
				  } access until ${periodEnd.toLocaleDateString()}, after which you'll be moved to the Free plan.`
				: `Subscription cancelled successfully. You'll continue to have ${
						planConfig.name
				  } access until ${periodEnd.toLocaleDateString()}, after which you'll be moved to the Free plan.`;
		}

		// After immediate cancellation, user gets free plan access
		if (immediate) {
			// Get free plan configuration
			const freePlan = getPlanByCode('free');
			if (!freePlan) {
				res.status(500).json({
					success: false,
					message: 'Free plan configuration error. Please contact support.',
					code: 'FREE_PLAN_CONFIG_ERROR',
				});
				return;
			}

			// Return free plan structure (same format as getUserSubscription for no subscription)
			res.json({
				success: true,
				message: 'Subscription cancelled immediately. You now have access to the Free plan.',
				data: {
					subscription: null,
					currentPlan: {
						plan_code: 'free',
						name: freePlan.name,
						description: freePlan.description,
						features: freePlan.features,
						limits: freePlan.limits,
						price_monthly: freePlan.price_monthly,
						trial_days: freePlan.trial_days,
					},
					accountCredits: 0,
					isActive: true,
					isTrialActive: null,
					isCancelledButActive: false,
					accessEndsAt: null,
					willRenew: false
				},
			});
		} else {
			// For scheduled cancellation, get updated subscription data
			const getUpdatedSubscription = db.prepare(`
				SELECT 
					us.*,
					sp.name as plan_name,
					sp.description as plan_description,
					sp.features,
					sp.limits,
					sp.price_monthly,
					sp.price_yearly,
					sp.price_currency,
					sp.trial_days,
					sp.is_featured
				FROM user_subscriptions us
				JOIN subscription_plans sp ON us.plan_code = sp.plan_code
				WHERE us.user_id = ? AND us.id = ?
			`);
			
			const updatedSub = /** @type {any} */ (getUpdatedSubscription.get(userId, subscription.id));
			
			if (updatedSub) {
				res.json({
					success: true,
					message: successMessage,
					data: {
						subscription: Object.assign({}, updatedSub, {
							features: JSON.parse(updatedSub.features || '[]'),
							limits: JSON.parse(updatedSub.limits || '{}')
						}),
						accountCredits: 0,
						isActive: true,
						isTrialActive: null,
						isCancelledButActive: true,
						accessEndsAt: accessEndsAt.toISOString(),
						willRenew: false
					},
				});
			} else {
				res.status(500).json({
					success: false,
					message: 'Failed to retrieve updated subscription data.',
					code: 'SUBSCRIPTION_UPDATE_ERROR',
				});
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Cancel subscription failed:', errorMessage);

		res.status(500).json({
			success: false,
			message: 'Failed to cancel subscription. Please try again later.',
			code: 'SUBSCRIPTION_CANCELLATION_FAILED',
		});
	} finally {
		console.debug('Cancel subscription process completed');
	}
}

/**
 * Get user's subscription transaction history
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
async function getSubscriptionHistory(req, res) {
	try {
		const userId = /** @type {number | undefined} */ (req.user?.id);
		const { page = 1, limit = 10, type, status, dateFrom, dateTo } = req.query;

		if (!userId) {
			res.status(401).json({
				success: false,
				message: 'Please log in to view your subscription history.',
				code: 'AUTHENTICATION_REQUIRED',
			});
			return;
		}

		const db = getDb();
		const offset = (parseInt(/** @type {string} */ (page)) - 1) * parseInt(/** @type {string} */ (limit));

		// Build query with optional type filter
		let query = `
            SELECT 
                st.*,
                us.status as subscription_status,
                us.plan_code
            FROM subscription_transactions st
            LEFT JOIN user_subscriptions us ON st.subscription_id = us.id
            WHERE st.user_id = ?
        `;

		const params = /** @type {any[]} */ ([userId]);

		if (type && ['subscription', 'refund', 'adjustment'].includes(/** @type {string} */ (type))) {
			query += ' AND st.transaction_type = ?';
			params.push(/** @type {string} */ (type));
		}

		// Add status filter
		if (status && ['captured', 'failed', 'pending', 'refunded', 'cancelled'].includes(/** @type {string} */ (status))) {
			query += ' AND st.status = ?';
			params.push(/** @type {string} */ (status));
		}

		// Add date range filters
		if (dateFrom) {
			query += ' AND st.created_at >= ?';
			params.push(/** @type {string} */ (dateFrom));
		}

		if (dateTo) {
			query += ' AND st.created_at <= ?';
			params.push(/** @type {string} */ (dateTo));
		}

		query += ' ORDER BY st.created_at DESC LIMIT ? OFFSET ?';
		params.push(parseInt(/** @type {string} */ (limit)), offset);

		const getTransactions = db.prepare(query);
		const transactions = /** @type {DatabaseTransaction[]} */ (getTransactions.all(...params));

		// Get total count for pagination
		let countQuery = 'SELECT COUNT(*) as total FROM subscription_transactions WHERE user_id = ?';
		const countParams = /** @type {any[]} */ ([userId]);

		if (type && ['subscription', 'refund', 'adjustment'].includes(/** @type {string} */ (type))) {
			countQuery += ' AND transaction_type = ?';
			countParams.push(/** @type {string} */ (type));
		}

		// Add status filter to count query
		if (status && ['captured', 'failed', 'pending', 'refunded', 'cancelled'].includes(/** @type {string} */ (status))) {
			countQuery += ' AND status = ?';
			countParams.push(/** @type {string} */ (status));
		}

		// Add date range filters to count query
		if (dateFrom) {
			countQuery += ' AND created_at >= ?';
			countParams.push(/** @type {string} */ (dateFrom));
		}

		if (dateTo) {
			countQuery += ' AND created_at <= ?';
			countParams.push(/** @type {string} */ (dateTo));
		}

		const getCount = db.prepare(countQuery);
		const countResult = /** @type {DatabaseCountResult} */ (getCount.get(...countParams));
		const { total } = countResult;

		// Parse JSON fields and format data with plan information
		const formattedTransactions = (transactions || []).map(transaction => {
			const planConfig = transaction.plan_code ? getPlanByCode(transaction.plan_code) : null;
			return {
				...transaction,
				plan_name: planConfig ? planConfig.name : 'Unknown Plan',
				method_details: transaction.method_details_json ? 
					(typeof transaction.method_details_json === 'string' ? JSON.parse(transaction.method_details_json) : transaction.method_details_json) : null,
				gateway_response: transaction.gateway_response_json
					? (typeof transaction.gateway_response_json === 'string' ? JSON.parse(transaction.gateway_response_json) : transaction.gateway_response_json)
					: null,
				amount_formatted: (transaction.amount / 100).toFixed(2), // Convert paise to rupees
				net_amount_formatted: (transaction.net_amount / 100).toFixed(2),
			};
		});

		const totalPages = Math.ceil(total / parseInt(/** @type {string} */ (limit)));

		res.json({
			success: true,
			message: 'Subscription history retrieved successfully',
			data: {
				data: {
					transactions: formattedTransactions,
					pagination: {
						currentPage: parseInt(/** @type {string} */ (page)),
						totalPages,
						totalRecords: total,
						hasNextPage: parseInt(/** @type {string} */ (page)) < totalPages,
						hasPreviousPage: parseInt(/** @type {string} */ (page)) > 1,
					},
				},
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Get subscription history failed:', errorMessage);

		res.status(500).json({
			success: false,
			message: 'Failed to retrieve subscription history. Please try again later.',
			code: 'HISTORY_FETCH_ERROR',
		});
	} finally {
		console.debug('Get subscription history process completed');
	}
}

/**
 * Get payment status and subscription state for polling
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
async function getPaymentStatus(req, res) {
	try {
		const userId = /** @type {number | undefined} */ (req.user?.id);
		const subscriptionId = parseInt(req.params.subscriptionId);

		if (!userId) {
			res.status(401).json({
				success: false,
				message: 'Please log in to check payment status.',
				code: 'AUTHENTICATION_REQUIRED',
			});
			return;
		}

		if (!subscriptionId || subscriptionId <= 0) {
			res.status(400).json({
				success: false,
				message: 'Valid subscription ID is required.',
				code: 'INVALID_SUBSCRIPTION_ID',
			});
			return;
		}

		const db = getDb();

		// Get subscription with transaction details
		const getSubscription = db.prepare(`
			SELECT 
				us.*,
				(
					SELECT COUNT(*) 
					FROM subscription_transactions st 
					WHERE st.subscription_id = us.id 
					AND st.status = 'captured'
				) as successful_payments,
				(
					SELECT COUNT(*) 
					FROM subscription_transactions st 
					WHERE st.subscription_id = us.id 
					AND st.status = 'failed'
				) as failed_payments,
				(
					SELECT st.razorpay_payment_id
					FROM subscription_transactions st 
					WHERE st.subscription_id = us.id 
					AND st.status = 'captured'
					ORDER BY st.created_at DESC
					LIMIT 1
				) as latest_payment_id,
				(
					SELECT st.processed_at
					FROM subscription_transactions st 
					WHERE st.subscription_id = us.id 
					AND st.status = 'captured'
					ORDER BY st.created_at DESC
					LIMIT 1
				) as latest_payment_date
			FROM user_subscriptions us
			WHERE us.id = ? AND us.user_id = ?
		`);

		const subscription = /** @type {DatabaseSubscription & {successful_payments: number, failed_payments: number, latest_payment_id: string | null, latest_payment_date: string | null} | undefined} */ (
			getSubscription.get(subscriptionId, userId)
		);

		if (!subscription) {
			res.status(404).json({
				success: false,
				message: 'Subscription not found or access denied.',
				code: 'SUBSCRIPTION_NOT_FOUND',
			});
			return;
		}

		// Get plan configuration
		const planConfig = getPlanByCode(subscription.plan_code);
		if (!planConfig) {
			res.status(500).json({
				success: false,
				message: 'Plan configuration error. Please contact support.',
				code: 'PLAN_CONFIG_ERROR',
			});
			return;
		}

		// Get recent transaction history for this subscription
		const getRecentTransactions = db.prepare(`
			SELECT 
				id,
				transaction_type,
				amount,
				status,
				method,
				description,
				razorpay_payment_id,
				razorpay_order_id,
				failure_reason,
				processed_at,
				created_at
			FROM subscription_transactions
			WHERE subscription_id = ?
			ORDER BY created_at DESC
			LIMIT 5
		`);

		const recentTransactions = /** @type {Array<{id: number, transaction_type: string, amount: number, status: string, method: string | null, description: string | null, razorpay_payment_id: string | null, razorpay_order_id: string | null, failure_reason: string | null, processed_at: string | null, created_at: string}>} */ (
			getRecentTransactions.all(subscriptionId)
		);

		// Determine subscription readiness and payment status
		const isActive = ['active', 'authenticated'].includes(subscription.status);
		const isPending = subscription.status === 'created';
		const isCancelled = subscription.status === 'cancelled';
		const isExpired = subscription.status === 'past_due' || subscription.status === 'halted';

		// Determine if waiting for payment
		const hasPendingPayment = isPending && subscription.total_amount > 0;
		const hasFailedRecentPayment = subscription.failed_payment_count > 0 && 
			(subscription.last_payment_attempt && 
			 new Date(subscription.last_payment_attempt).getTime() > Date.now() - (24 * 60 * 60 * 1000)); // Within 24 hours

		// Calculate subscription timing
		const now = new Date();
		const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
		const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
		const nextBilling = subscription.next_billing_date ? new Date(subscription.next_billing_date) : null;

		const isInTrial = trialEnd && trialEnd > now;
		const daysUntilExpiry = periodEnd ? Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
		const daysUntilBilling = nextBilling ? Math.ceil((nextBilling.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

		// Format transaction history
		const formattedTransactions = recentTransactions.map(transaction => ({
			...transaction,
			amount_formatted: (transaction.amount / 100).toFixed(2),
			created_at_formatted: new Date(transaction.created_at).toLocaleString(),
			processed_at_formatted: transaction.processed_at ? new Date(transaction.processed_at).toLocaleString() : null,
		}));

		// Determine overall payment status
		let paymentStatus = 'unknown';
		let paymentMessage = 'Unable to determine payment status';

		if (subscription.total_amount === 0) {
			paymentStatus = 'not_required';
			paymentMessage = 'No payment required for this plan';
		} else if (isActive) {
			paymentStatus = 'completed';
			paymentMessage = 'Payment completed successfully';
		} else if (hasPendingPayment) {
			paymentStatus = 'pending';
			paymentMessage = 'Waiting for payment completion';
		} else if (hasFailedRecentPayment) {
			paymentStatus = 'failed';
			paymentMessage = 'Recent payment attempt failed';
		} else if (isCancelled) {
			paymentStatus = 'cancelled';
			paymentMessage = 'Subscription has been cancelled';
		} else if (isExpired) {
			paymentStatus = 'expired';
			paymentMessage = 'Subscription has expired due to failed payments';
		}

		// Determine if polling should continue
		const shouldContinuePolling = isPending || hasFailedRecentPayment;
		const pollingIntervalSeconds = isPending ? 10 : hasFailedRecentPayment ? 30 : 0;

		res.json({
			success: true,
			message: 'Payment status retrieved successfully',
			data: {
				// Subscription details
				subscription: {
					id: subscription.id,
					status: subscription.status,
					plan_code: subscription.plan_code,
					plan_name: planConfig.name,
					billing_cycle: subscription.billing_cycle,
					total_amount: subscription.total_amount,
					total_amount_formatted: (subscription.total_amount / 100).toFixed(2),
					currency: 'INR',
					razorpay_subscription_id: subscription.razorpay_subscription_id,
					auto_renewal: subscription.auto_renewal,
					created_at: subscription.created_at,
					updated_at: subscription.updated_at,
				},

				// Payment status
				payment: {
					status: paymentStatus,
					message: paymentMessage,
					is_active: isActive,
					is_pending: isPending,
					is_cancelled: isCancelled,
					is_expired: isExpired,
					requires_payment: subscription.total_amount > 0,
					latest_payment_id: subscription.latest_payment_id,
					latest_payment_date: subscription.latest_payment_date,
					successful_payments: subscription.successful_payments,
					failed_payments: subscription.failed_payments,
					failed_payment_count: subscription.failed_payment_count,
					last_payment_attempt: subscription.last_payment_attempt,
				},

				// Timing information
				timing: {
					is_in_trial: isInTrial,
					trial_end: subscription.trial_end,
					current_period_start: subscription.current_period_start,
					current_period_end: subscription.current_period_end,
					next_billing_date: subscription.next_billing_date,
					days_until_expiry: daysUntilExpiry,
					days_until_billing: daysUntilBilling,
					cancel_at_period_end: subscription.cancel_at_period_end,
					cancelled_at: subscription.cancelled_at,
				},

				// Polling configuration
				polling: {
					should_continue: shouldContinuePolling,
					interval_seconds: pollingIntervalSeconds,
					max_attempts: 30, // Suggest max polling attempts
					recommended_timeout: 300, // 5 minutes total timeout
				},

				// Recent transaction history
				recent_transactions: formattedTransactions,

				// Additional metadata
				metadata: {
					checked_at: new Date().toISOString(),
					user_id: userId,
					plan_features: planConfig.features,
					plan_limits: planConfig.limits,
				},
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Get payment status failed:', errorMessage);

		res.status(500).json({
			success: false,
			message: 'Failed to retrieve payment status. Please try again later.',
			code: 'PAYMENT_STATUS_FETCH_ERROR',
		});
	} finally {
		console.debug('Get payment status process completed');
	}
}

/**
 * Verify Razorpay payment and update subscription status
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
async function verifyPayment(req, res) {
	try {
		const userId = /** @type {number | undefined} */ (req.user?.id);
		const { razorpay_payment_id, subscription_id } = req.body;

		if (!userId) {
			res.status(401).json({
				success: false,
				message: 'Please log in to verify payment.',
				code: 'AUTHENTICATION_REQUIRED',
			});
			return;
		}

		if (!razorpay_payment_id) {
			res.status(400).json({
				success: false,
				message: 'Missing required payment verification data.',
				code: 'MISSING_PAYMENT_DATA',
			});
			return;
		}

		const db = getDb();

		// Check if this payment has already been verified (idempotency check)
		const checkExistingVerification = db.prepare(`
			SELECT 
				st.id,
				st.status,
				st.subscription_id,
				us.status as subscription_status
			FROM subscription_transactions st
			LEFT JOIN user_subscriptions us ON st.subscription_id = us.id
			WHERE st.razorpay_payment_id = ? AND st.user_id = ?
			ORDER BY st.created_at DESC
			LIMIT 1
		`);

		const existingVerification = /** @type {{id: number, status: string, subscription_id: number | null, subscription_status: string | null} | undefined} */ (
			checkExistingVerification.get(razorpay_payment_id, userId)
		);

		if (existingVerification) {
			console.log('Payment already verified previously:', razorpay_payment_id, 'Transaction ID:', existingVerification.id);
			
			// If payment was already successfully processed
			if (existingVerification.status === 'captured') {
				// Get plan configuration for response
				let planName = 'Unknown Plan';
				if (existingVerification.subscription_id) {
					const getSubscriptionPlan = db.prepare(`
						SELECT plan_code FROM user_subscriptions WHERE id = ?
					`);
					const subscriptionPlan = /** @type {{plan_code: string} | undefined} */ (
						getSubscriptionPlan.get(existingVerification.subscription_id)
					);
					if (subscriptionPlan) {
						const planConfig = getPlanByCode(subscriptionPlan.plan_code);
						planName = planConfig ? planConfig.name : 'Unknown Plan';
					}
				}

				res.json({
					success: true,
					message: `Payment was already verified successfully! Your ${planName} subscription is ${existingVerification.subscription_status || 'active'}.`,
					data: {
						subscriptionId: existingVerification.subscription_id,
						paymentId: razorpay_payment_id,
						planName: planName,
						status: 'verified',
						note: 'Payment verification completed previously',
						isDuplicate: true,
						originalTransactionId: existingVerification.id,
					},
				});
				return;
			}
		}

		// Get payment details from Razorpay
		const paymentDetails = await fetchPaymentDetails(razorpay_payment_id);

		console.log('\n\nPayment Details: ' + JSON.stringify(paymentDetails, null, '\t') + '\n\n');

		if (paymentDetails.captured !== true) {
			res.status(400).json({
				success: false,
				message: 'Payment not captured successfully.',
				code: 'PAYMENT_NOT_CAPTURED',
			});
			return;
		}

		// Find subscription based on order ID or subscription ID
		let getSubscription;
		let subscription;

		if (subscription_id) {
			getSubscription = db.prepare(`
                SELECT us.*
                FROM user_subscriptions us
                WHERE us.id = ? AND us.user_id = ?
            `);
			subscription = /** @type {DatabaseSubscription | undefined} */ (
				getSubscription.get(subscription_id, userId)
			);
		} else {
			// Try to find by order notes or recent subscription
			getSubscription = db.prepare(`
                SELECT us.*
                FROM user_subscriptions us
                WHERE us.user_id = ? AND us.status = 'created'
                ORDER BY us.created_at DESC
                LIMIT 1
            `);
			subscription = /** @type {DatabaseSubscription | undefined} */ (getSubscription.get(userId));
		}

		if (!subscription) {
			res.status(404).json({
				success: false,
				message: 'Associated subscription not found.',
				code: 'SUBSCRIPTION_NOT_FOUND',
			});
			return;
		}

		// Get plan configuration for the subscription
		const planConfig = getPlanByCode(subscription.plan_code);
		if (!planConfig) {
			res.status(500).json({
				success: false,
				message: 'Plan configuration error. Please contact support.',
				code: 'PLAN_CONFIG_ERROR',
			});
			return;
		}

		// Note: Subscription activation is now handled by payment.authorized webhook
		// This function now only verifies the payment was captured successfully

		res.json({
			success: true,
			message: `Payment verified successfully! Your ${planConfig.name} subscription will be activated shortly.`,
			data: {
				subscriptionId: subscription.id,
				paymentId: razorpay_payment_id,
				amount: paymentDetails.amount,
				currency: paymentDetails.currency,
				planName: planConfig.name,
				status: 'verified',
				note: 'Subscription activation will be completed via webhook notification',
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Payment verification failed:', errorMessage);

		res.status(500).json({
			success: false,
			message: 'Payment verification failed. Please contact support if you were charged.',
			code: 'PAYMENT_VERIFICATION_FAILED',
		});
	} finally {
		console.debug('Payment verification process completed');
	}
}

// Export all functions
module.exports = {
	getAllPlans,
	getUserSubscription,
	createSubscription,
	upgradeSubscription,
	cancelSubscription,
	getSubscriptionHistory,
	verifyPayment,
	getPaymentStatus,
};
