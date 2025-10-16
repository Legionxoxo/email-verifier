/**
 * Razorpay payment processing utility functions
 * Handles order creation, signature verification, and payment operations
 *
 * @fileoverview Razorpay integration utilities for subscription management
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require('../../data/env');

/**
 * Razorpay instance (singleton)
 * @type {Razorpay|null}
 */
let razorpayInstance = null;

/**
 * Initialize Razorpay instance with credentials
 * @returns {Razorpay} Razorpay instance
 * @throws {Error} If credentials are missing
 */
function initializeRazorpay() {
	try {
		if (razorpayInstance) {
			return razorpayInstance;
		}

		const keyId = RAZORPAY_KEY_ID;
		const keySecret = RAZORPAY_KEY_SECRET;

		if (!keyId || !keySecret) {
			throw new Error('Razorpay credentials not configured');
		}

		razorpayInstance = new Razorpay({
			key_id: keyId,
			key_secret: keySecret,
		});

		console.log('Razorpay instance initialized successfully');
		return razorpayInstance;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Razorpay initialization failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Razorpay initialization process completed');
	}
}

/**
 * Create a Razorpay order for payment processing
 * @param {Object} orderData - Order creation data
 * @param {number} orderData.amount - Amount in paise
 * @param {string} orderData.currency - Currency code (default: INR)
 * @param {string} orderData.receipt - Unique receipt identifier
 * @param {Object} [orderData.notes] - Additional notes
 * @returns {Promise<Object>} Razorpay order object
 * @throws {Error} If order creation fails
 */
async function createRazorpayOrder(orderData) {
	try {
		const { amount, currency = 'INR', receipt, notes = {} } = orderData;

		// Validate required fields
		if (!amount || !receipt) {
			throw new Error('Amount and receipt are required for order creation');
		}

		// Validate amount (must be positive integer)
		if (!Number.isInteger(amount) || amount <= 0) {
			throw new Error('Amount must be a positive integer in paise');
		}

		const razorpay = initializeRazorpay();

		const orderOptions = {
			amount,
			currency,
			receipt,
			notes,
			payment_capture: 1, // Auto-capture payments
		};

		const order = await razorpay.orders.create(orderOptions);

		console.log('Razorpay order created successfully:', order.id);
		return order;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Razorpay order creation failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Razorpay order creation process completed');
	}
}

/**
 * Calculate prorated amount for plan changes
 * @param {Object} calculationData - Proration calculation data
 * @param {number} calculationData.currentPlanPrice - Current plan price in paise
 * @param {number} calculationData.newPlanPrice - New plan price in paise
 * @param {number} calculationData.daysRemaining - Days remaining in current period
 * @param {number} calculationData.totalDays - Total days in billing period
 * @returns {Object} Proration calculation result
 */
function calculateProratedAmount(calculationData) {
	try {
		const { currentPlanPrice, newPlanPrice, daysRemaining, totalDays } = calculationData;

		// Validate input data
		if (typeof currentPlanPrice !== 'number' || typeof newPlanPrice !== 'number') {
			throw new Error('Plan prices must be numbers');
		}

		if (typeof daysRemaining !== 'number' || typeof totalDays !== 'number') {
			throw new Error('Days must be numbers');
		}

		// Validate basic requirements
		if (totalDays <= 0) {
			throw new Error('Total days must be positive');
		}
		
		if (daysRemaining < 0) {
			throw new Error('Days remaining cannot be negative');
		}
		
		// Allow some flexibility in days remaining vs total days
		// Real billing cycles might be 28-31 days for monthly, 360-366 for yearly
		const maxAllowedDays = totalDays === 30 ? 35 : (totalDays === 365 ? 370 : totalDays + 5);
		if (daysRemaining > maxAllowedDays) {
			throw new Error(`Days remaining (${daysRemaining}) exceeds maximum allowed (${maxAllowedDays})`);
		}

		const priceDifference = newPlanPrice - currentPlanPrice;
		const proratedAmount = Math.round((priceDifference * daysRemaining) / totalDays);

		const result = {
			proratedAmount,
			isUpgrade: priceDifference > 0,
			isDowngrade: priceDifference < 0,
			requiresPayment: proratedAmount > 0,
			creditAmount: proratedAmount < 0 ? Math.abs(proratedAmount) : 0,
			priceDifference,
			daysUsed: totalDays - daysRemaining,
			daysRemaining,
			totalDays,
		};

		console.log('Proration calculation completed:', result);
		return result;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Proration calculation failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Proration calculation process completed');
	}
}

/**
 * Process refund to account credits for downgrades
 * @param {Object} refundData - Refund processing data
 * @param {number} refundData.userId - User ID
 * @param {number} refundData.subscriptionId - Subscription ID
 * @param {number} refundData.creditAmount - Credit amount in paise
 * @param {string} refundData.reason - Reason for credit
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {Object} Credit processing result
 * @throws {Error} If credit processing fails
 */
function processRefundToCredits(refundData, db) {
	try {
		const { userId, subscriptionId, creditAmount, reason } = refundData;

		// Validate input data with specific error messages
		if (!userId) {
			throw new Error('User ID is required');
		}
		
		if (!subscriptionId) {
			throw new Error('Subscription ID is required');
		}
		
		if (typeof creditAmount !== 'number') {
			throw new Error('Credit amount is required');
		}
		
		if (!reason) {
			throw new Error('Reason is required');
		}

		if (creditAmount <= 0) {
			throw new Error('Credit amount must be positive');
		}

		// Calculate expiry date (1 year from now)
		const expiresAt = new Date();
		expiresAt.setFullYear(expiresAt.getFullYear() + 1);

		// Insert account credit record
		const insertCredit = db.prepare(`
            INSERT INTO account_credits (
                user_id, subscription_id, credit_amount, credit_type, description, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `);

		const creditResult = insertCredit.run(
			userId,
			subscriptionId,
			creditAmount,
			'credit',
			reason,
			expiresAt.toISOString()
		);

		const result = {
			success: true,
			creditAmount,
			transactionId: creditResult.lastInsertRowid || Date.now()
		};

		console.log('Account credit processed successfully:', result);
		return result;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Account credit processing failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Account credit processing completed');
	}
}

/**
 * Handle failed payment scenarios with retry logic
 * @param {Object} failureData - Payment failure data
 * @param {string} failureData.paymentId - Payment ID
 * @param {string} failureData.orderId - Order ID
 * @param {string} failureData.errorCode - Error code from Razorpay
 * @param {string} failureData.errorDescription - Error description
 * @param {number} failureData.subscriptionId - Subscription ID
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {Object} Failure handling result
 * @throws {Error} If failure handling fails
 */
function handleFailedPayments(failureData, db) {
	try {
		const { paymentId, orderId, errorCode, errorDescription, subscriptionId } = failureData;

		// Validate input data with specific error messages
		if (!paymentId) {
			throw new Error('Payment ID is required');
		}
		
		if (!orderId) {
			throw new Error('Order ID is required');
		}
		
		if (!subscriptionId) {
			throw new Error('Subscription ID is required');
		}

		// Get current subscription details
		const getSubscription = db.prepare(`
            SELECT * FROM user_subscriptions WHERE id = ?
        `);
		/** @type {any} */
		const subscription = getSubscription.get(subscriptionId);

		if (!subscription) {
			throw new Error('Subscription not found');
		}

		// Update failed payment count
		const updateSubscription = db.prepare(`
            UPDATE user_subscriptions 
            SET failed_payment_count = failed_payment_count + 1,
                last_payment_attempt = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

		updateSubscription.run(subscriptionId);

		// Check if maximum failures reached
		const maxFailures = 3; // Configure this value
		const currentFailureCount = subscription.failed_payment_count || 0;
		const newFailureCount = currentFailureCount + 1;

		// Create retry date (24 hours from now)
		const retryAfter = new Date();
		retryAfter.setHours(retryAfter.getHours() + 24);

		let result;
		if (newFailureCount >= maxFailures) {
			// Move subscription to cancelled status
			const markCancelled = db.prepare(`
                UPDATE user_subscriptions 
                SET status = 'cancelled',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
			markCancelled.run(subscriptionId);

			result = {
				action: 'subscription_cancelled',
				failureCount: newFailureCount,
				maxFailures,
				reason: 'Maximum payment failures reached'
			};
		} else {
			result = {
				action: 'retry_allowed',
				failureCount: newFailureCount,
				maxFailures,
				retryAfter
			};
		}

		// Log the transaction failure
		const insertFailedTransaction = db.prepare(`
            INSERT INTO subscription_transactions (
                user_id, subscription_id, razorpay_payment_id, razorpay_order_id,
                transaction_type, amount, net_amount, currency, status,
                failure_reason, failure_code, gateway_response_json, retry_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

		insertFailedTransaction.run(
			subscription.user_id,
			subscriptionId,
			paymentId,
			orderId,
			'subscription',
			subscription.total_amount || 0,
			subscription.total_amount || 0,
			'INR',
			'failed',
			errorDescription,
			errorCode,
			JSON.stringify(failureData),
			newFailureCount
		);

		console.log('Payment failure handled:', result);
		return result;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Payment failure handling failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Payment failure handling process completed');
	}
}

/**
 * Fetch payment details from Razorpay
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<import('razorpay/dist/types/payments').Payments.RazorpayPayment>} Payment details
 * @throws {Error} If payment fetch fails
 */
async function fetchPaymentDetails(paymentId) {
	try {
		if (!paymentId) {
			throw new Error('Payment ID is required');
		}

		const razorpay = initializeRazorpay();
		const payment = await razorpay.payments.fetch(paymentId);

		console.log('Payment details fetched successfully:', paymentId);
		return payment;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Payment details fetch failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Payment details fetch process completed');
	}
}

/**
 * Capture an authorized payment
 * @param {string} paymentId - Payment ID to capture
 * @param {number} amount - Amount to capture in paise
 * @param {string} [currency] - Currency code (default: INR)
 * @returns {Promise<Object>} Captured payment details
 * @throws {Error} If capture fails
 */
async function capturePayment(paymentId, amount, currency = 'INR') {
	try {
		if (!paymentId) {
			throw new Error('Payment ID is required');
		}

		if (!amount || !Number.isInteger(amount) || amount <= 0) {
			throw new Error('Amount must be a positive integer in paise');
		}

		const razorpay = initializeRazorpay();
		const capturedPayment = await razorpay.payments.capture(paymentId, amount, currency);

		console.log('Payment captured successfully:', paymentId, JSON.stringify(capturedPayment, null, '\t'));
		return capturedPayment;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Payment capture failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Payment capture process completed');
	}
}

/**
 * Create a refund for a payment
 * @param {Object} refundData - Refund data
 * @param {string} refundData.paymentId - Payment ID to refund
 * @param {number} [refundData.amount] - Amount to refund (full refund if not specified)
 * @param {string} [refundData.reason] - Reason for refund
 * @returns {Promise<Object>} Refund details
 * @throws {Error} If refund fails
 */
async function createRefund(refundData) {
	try {
		const { paymentId, amount, reason } = refundData;

		if (!paymentId) {
			throw new Error('Payment ID is required for refund');
		}

		const razorpay = initializeRazorpay();

		const refundOptions = {
			payment_id: paymentId,
			...(amount && { amount }),
			...(reason && { notes: { reason } }),
		};

		const refund = await razorpay.payments.refund(paymentId, refundOptions);

		console.log('Refund created successfully:', refund.id);
		return refund;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Refund creation failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Refund creation process completed');
	}
}

/**
 * Create a Razorpay subscription plan for recurring billing
 * @param {Object} planData - Plan creation data
 * @param {string} planData.period - Billing period (weekly, monthly, yearly)
 * @param {number} planData.interval - Billing interval (1 for every period)
 * @param {Object} planData.item - Plan item details
 * @param {string} planData.item.name - Plan name
 * @param {string} planData.item.description - Plan description
 * @param {number} planData.item.amount - Plan amount in paise
 * @param {string} planData.item.currency - Currency code (default: INR)
 * @param {Object} [planData.notes] - Additional notes
 * @returns {Promise<Object>} Razorpay plan object
 * @throws {Error} If plan creation fails
 */
async function createRazorpayPlan(planData) {
	try {
		const { period, interval = 1, item, notes = {} } = planData;

		// Validate required fields
		if (!period || !item || !item.name || !item.amount) {
			throw new Error('Period, item name, and amount are required for plan creation');
		}

		// Validate period
		const validPeriods = /** @type {const} */ (['weekly', 'monthly', 'yearly', 'daily']);
		if (!validPeriods.includes(/** @type {any} */ (period))) {
			throw new Error('Period must be one of: weekly, monthly, yearly, daily');
		}

		// Validate amount (must be positive integer)
		if (!Number.isInteger(item.amount) || item.amount <= 0) {
			throw new Error('Amount must be a positive integer in paise');
		}

		const razorpay = initializeRazorpay();

		const planOptions = {
			period,
			interval,
			item: {
				name: item.name,
				description: item.description || '',
				amount: item.amount,
				currency: item.currency || 'INR',
			},
			notes,
		};

		const plan = await razorpay.plans.create(/** @type {any} */ (planOptions));

		console.log('Razorpay plan created successfully:', /** @type {any} */ (plan).id);
		return plan;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Razorpay plan creation failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Razorpay plan creation process completed');
	}
}

/**
 * Create a Razorpay subscription for recurring billing
 * @param {Object} subscriptionData - Subscription creation data
 * @param {string} subscriptionData.plan_id - Razorpay plan ID
 * @param {string} [subscriptionData.customer_id] - Razorpay customer ID
 * @param {number} [subscriptionData.total_count] - Total billing cycles (12 for yearly, omit for unlimited)
 * @param {number} [subscriptionData.quantity] - Quantity of plan (default: 1)
 * @param {number} [subscriptionData.customer_notify] - Notify customer (default: 1)
 * @param {Date} [subscriptionData.start_at] - Subscription start date
 * @param {Object} [subscriptionData.addons] - Additional charges
 * @param {Object} [subscriptionData.notes] - Additional notes
 * @returns {Promise<Object>} Razorpay subscription object
 * @throws {Error} If subscription creation fails
 */
async function createRazorpaySubscription(subscriptionData) {
	try {
		const {
			plan_id,
			customer_id,
			total_count,
			quantity = 1,
			customer_notify = 1,
			start_at,
			addons = [],
			notes = {},
		} = subscriptionData;

		// Validate required fields
		if (!plan_id) {
			throw new Error('Plan ID is required for subscription creation');
		}

		// Validate quantity
		if (!Number.isInteger(quantity) || quantity <= 0) {
			throw new Error('Quantity must be a positive integer');
		}

		const razorpay = initializeRazorpay();

		const subscriptionOptions = /** @type {any} */ ({
			plan_id,
			quantity,
			customer_notify,
			notes,
		});

		// Add customer_id if provided
		if (customer_id) {
			subscriptionOptions.customer_id = customer_id;
		}

		// Add optional fields if provided
		if (total_count) {
			subscriptionOptions.total_count = total_count;
		}

		if (start_at) {
			subscriptionOptions.start_at = Math.floor(start_at.getTime() / 1000);
		}

		if (addons && addons.length > 0) {
			subscriptionOptions.addons = addons;
		}

		const subscription = await razorpay.subscriptions.create(subscriptionOptions);

		console.log('Razorpay subscription created successfully:', /** @type {any} */ (subscription).id);
		return subscription;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Razorpay subscription creation failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Razorpay subscription creation process completed');
	}
}

/**
 * Update a Razorpay subscription (plan changes, quantity, etc.)
 * @param {string} subscriptionId - Razorpay subscription ID
 * @param {Object} updateData - Subscription update data
 * @param {string} [updateData.plan_id] - New plan ID for upgrades/downgrades
 * @param {number} [updateData.quantity] - New quantity
 * @param {string} [updateData.schedule_change_at] - When to apply changes ('now' or 'cycle_end')
 * @param {Object} [updateData.addons] - Additional charges
 * @param {boolean} [updateData.prorate] - (Ignored) Razorpay handles proration automatically
 * @param {Object} [updateData.notes] - (Ignored) Notes not supported in update API
 * @returns {Promise<Object>} Updated Razorpay subscription object
 * @throws {Error} If subscription update fails
 */
async function updateRazorpaySubscription(subscriptionId, updateData) {
	try {
		if (!subscriptionId) {
			throw new Error('Subscription ID is required for update');
		}

		const { plan_id, quantity, schedule_change_at = 'cycle_end', prorate = true, addons, notes } = updateData;

		// Validate at least one update field is provided
		if (!plan_id && !quantity && !addons) {
			throw new Error('At least one update field must be provided');
		}

		// Validate schedule_change_at
		const validScheduleOptions = /** @type {const} */ (['now', 'cycle_end']);
		if (schedule_change_at && !validScheduleOptions.includes(/** @type {any} */ (schedule_change_at))) {
			throw new Error('schedule_change_at must be either "now" or "cycle_end"');
		}

		const razorpay = initializeRazorpay();

		const updateOptions = /** @type {any} */ ({});

		// Add required fields for schedule changes
		if (schedule_change_at) {
			updateOptions.schedule_change_at = schedule_change_at;
		}

		// Add fields that are being updated
		if (plan_id) {
			updateOptions.plan_id = plan_id;
		}

		if (quantity) {
			if (!Number.isInteger(quantity) || quantity <= 0) {
				throw new Error('Quantity must be a positive integer');
			}
			updateOptions.quantity = quantity;
		}

		if (addons) {
			updateOptions.addons = addons;
		}

		// Note: prorate and notes parameters are not supported by Razorpay subscription update API
		// Razorpay handles proration automatically when plan_id is changed
		// Notes should be managed separately if needed

		const subscription = await razorpay.subscriptions.update(subscriptionId, updateOptions);

		console.log('Razorpay subscription updated successfully:', subscriptionId);
		return subscription;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Razorpay subscription update failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Razorpay subscription update process completed');
	}
}

/**
 * Cancel a Razorpay subscription
 * @param {string} subscriptionId - Razorpay subscription ID
 * @param {Object} [cancelData] - Cancellation data
 * @param {boolean} [cancelData.cancel_at_cycle_end] - Cancel at end of current cycle (default: false)
 * @returns {Promise<Object>} Cancelled Razorpay subscription object
 * @throws {Error} If subscription cancellation fails
 * @note The cancel API only supports cancel_at_cycle_end parameter. Notes are not supported.
 */
async function cancelRazorpaySubscription(subscriptionId, cancelData) {
	try {
		console.log('Cancelling subscription!');
		if (!subscriptionId) {
			throw new Error('Subscription ID is required for cancellation');
		}

		const { cancel_at_cycle_end = false } = cancelData;

		const razorpay = initializeRazorpay();

		// First, fetch the subscription to check its current status
		let currentSubscription;
		try {
			currentSubscription = await razorpay.subscriptions.fetch(subscriptionId);
			console.log(`Current subscription status: ${currentSubscription.status}`);
		} catch (fetchError) {
			console.warn(
				'Could not fetch subscription status before cancellation:',
				fetchError.error?.description || fetchError.message
			);
		}

		// Check if subscription is already cancelled or in a non-cancellable state
		if (currentSubscription && ['cancelled', 'completed', 'expired'].includes(currentSubscription.status)) {
			console.log(
				`Subscription ${subscriptionId} is already in ${currentSubscription.status} state - skipping cancellation`
			);
			return currentSubscription;
		}

		// Check if subscription is in "created" status with no billing cycles (cannot be cancelled via API)
		if (currentSubscription && currentSubscription.status === 'created' && currentSubscription.paid_count === 0) {
			console.warn(
				`Subscription ${subscriptionId} is in "created" status with no billing cycles - cannot be cancelled via Razorpay API`
			);

			// Return a mock cancelled response for consistency
			return {
				...currentSubscription,
				status: 'cancelled',
				cancelled_at: Math.floor(Date.now() / 1000),
				cancel_at_cycle_end: cancel_at_cycle_end,
				notes: {
					cancellation_reason: 'Subscription cancelled before first billing cycle',
					original_status: 'created',
					cancelled_locally: true,
				},
			};
		}

		const subscription = await razorpay.subscriptions.cancel(subscriptionId, cancel_at_cycle_end);

		console.log('Razorpay subscription cancelled successfully:', subscriptionId);
		return subscription;
	} catch (error) {
		// Better error logging to avoid "[object Object]"
		const errorMessage = error.message || error.error?.description || 'Unknown error';
		console.error(
			JSON.stringify(
				{
					subscriptionId,
					error: errorMessage,
					statusCode: error.statusCode,
					errorCode: error.error?.code,
					errorDescription: error.error?.description,
					fullError: JSON.stringify(error, null, 2),
				},
				null,
				2
			)
		);

		console.error('Razorpay subscription cancellation failed:', {
			subscriptionId,
			error: errorMessage,
			statusCode: error.statusCode,
			errorCode: error.error?.code,
			errorDescription: error.error?.description,
			fullError: JSON.stringify(error, null, 2),
		});
		throw error;
	} finally {
		console.debug('Razorpay subscription cancellation process completed');
	}
}

/**
 * Fetch Razorpay subscription details
 * @param {string} subscriptionId - Razorpay subscription ID
 * @returns {Promise<Object>} Razorpay subscription details
 * @throws {Error} If subscription fetch fails
 */
async function fetchRazorpaySubscription(subscriptionId) {
	try {
		if (!subscriptionId) {
			throw new Error('Subscription ID is required');
		}

		const razorpay = initializeRazorpay();
		const subscription = await razorpay.subscriptions.fetch(subscriptionId);

		console.log('Razorpay subscription details fetched successfully:', subscriptionId);
		return subscription;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Razorpay subscription fetch failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Razorpay subscription fetch process completed');
	}
}

/**
 * Verify Razorpay subscription payment signature for webhooks
 * @param {Object} webhookData - Webhook verification data
 * @param {string} webhookData.razorpay_subscription_id - Subscription ID from Razorpay
 * @param {string} webhookData.razorpay_payment_id - Payment ID from Razorpay
 * @param {string} webhookData.razorpay_signature - Webhook signature from Razorpay
 * @param {string} [webhookData.webhook_secret] - Webhook secret for verification
 * @returns {boolean} True if signature is valid
 * @throws {Error} If verification fails
 */
function verifySubscriptionPaymentSignature(webhookData) {
	try {
		const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature, webhook_secret } = webhookData;

		// Validate input data with specific error messages
		if (!razorpay_payment_id) {
			throw new Error('Payment ID is required');
		}
		
		if (!razorpay_subscription_id) {
			throw new Error('Subscription ID is required');
		}
		
		if (!razorpay_signature) {
			throw new Error('Signature is required');
		}

		const keySecret = webhook_secret || process.env.RAZORPAY_KEY_SECRET;
		if (!keySecret) {
			throw new Error('Webhook secret is required');
		}

		// Create expected signature for subscription payments
		const body = razorpay_payment_id + '|' + razorpay_subscription_id;
		const expectedSignature = crypto.createHmac('sha256', keySecret).update(body.toString()).digest('hex');

		// Compare signatures using timing-safe comparison
		let isValid = false;
		try {
			const signatureBuffer = Buffer.from(razorpay_signature, 'hex');
			const expectedBuffer = Buffer.from(expectedSignature, 'hex');
			
			// Ensure buffers have the same length for timing-safe comparison
			if (signatureBuffer.length === expectedBuffer.length) {
				isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
			}
		} catch (error) {
			// If buffer creation or comparison fails, signature is invalid
			isValid = false;
		}

		if (isValid) {
			console.log('Subscription payment signature verified successfully');
		} else {
			console.warn('Subscription payment signature verification failed');
		}

		return isValid;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Subscription payment signature verification failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Subscription payment signature verification process completed');
	}
}

/**
 * Pause a Razorpay subscription
 * @param {string} subscriptionId - Razorpay subscription ID
 * @param {Object} [pauseData] - Pause data
 * @param {Date} [pauseData.pause_at] - When to pause (default: now)
 * @param {Object} [pauseData.notes] - Pause notes
 * @returns {Promise<Object>} Paused Razorpay subscription object
 * @throws {Error} If subscription pause fails
 */
async function pauseRazorpaySubscription(subscriptionId, pauseData = {}) {
	try {
		if (!subscriptionId) {
			throw new Error('Subscription ID is required for pausing');
		}

		const { pause_at, notes = {} } = pauseData;

		const razorpay = initializeRazorpay();

		const pauseOptions = /** @type {any} */ ({
			notes,
		});

		if (pause_at) {
			pauseOptions.pause_at = Math.floor(pause_at.getTime() / 1000);
		} else {
			pauseOptions.pause_at = 'now';
		}

		const subscription = await razorpay.subscriptions.pause(subscriptionId, pauseOptions);

		console.log('Razorpay subscription paused successfully:', subscriptionId);
		return subscription;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Razorpay subscription pause failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Razorpay subscription pause process completed');
	}
}

/**
 * Resume a paused Razorpay subscription
 * @param {string} subscriptionId - Razorpay subscription ID
 * @param {Object} [resumeData] - Resume data
 * @param {Date} [resumeData.resume_at] - When to resume (default: now)
 * @param {Object} [resumeData.notes] - Resume notes
 * @returns {Promise<Object>} Resumed Razorpay subscription object
 * @throws {Error} If subscription resume fails
 */
async function resumeRazorpaySubscription(subscriptionId, resumeData = {}) {
	try {
		if (!subscriptionId) {
			throw new Error('Subscription ID is required for resuming');
		}

		const { resume_at, notes = {} } = resumeData;

		const razorpay = initializeRazorpay();

		const resumeOptions = /** @type {any} */ ({
			notes,
		});

		if (resume_at) {
			resumeOptions.resume_at = Math.floor(resume_at.getTime() / 1000);
		} else {
			resumeOptions.resume_at = 'now';
		}

		const subscription = await razorpay.subscriptions.resume(subscriptionId, resumeOptions);

		console.log('Razorpay subscription resumed successfully:', subscriptionId);
		return subscription;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Razorpay subscription resume failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Razorpay subscription resume process completed');
	}
}

/**
 * Create a Razorpay customer (with built-in duplicate prevention)
 * @param {Object} customerData - Customer creation data
 * @param {string} customerData.name - Customer full name
 * @param {string} customerData.email - Customer email address
 * @param {string} [customerData.contact] - Customer phone number
 * @param {"0" | "1"} [customerData.fail_existing] - Fail if customer already exists (default: false)
 * @param {Object} [customerData.notes] - Additional notes
 * @returns {Promise<Object>} Razorpay customer object with isNew flag
 * @throws {Error} If customer creation fails
 */
async function createRazorpayCustomer(customerData) {
	try {
		const { name, email, contact, fail_existing = '0', notes = {} } = customerData;

		// Validate required fields
		if (!name || !email) {
			throw new Error('Name and email are required for customer creation');
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			throw new Error('Invalid email format');
		}

		const razorpay = initializeRazorpay();

		const customerOptions = {
			name,
			email,
			fail_existing: '0',
			notes,
		};

		// Add optional contact if provided
		if (contact) {
			customerOptions.contact = contact;
		}

		const customer = await razorpay.customers.create(/** @type {any} */ (customerOptions));
		// const customer = await razorpay.customers.create({
		// 	name,
		// 	email,
		// 	fail_existing: 0,
		// 	notes,
		// });

		console.log('Razorpay customer created successfully:', customer.id);

		// Add isNew flag for compatibility (assume new if created within last 5 seconds)
		return {
			...customer,
			isNew: !customer.created_at || Date.now() - customer.created_at * 1000 < 5000,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Razorpay customer creation failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Razorpay customer creation process completed');
	}
}

/**
 * Fetch Razorpay customer details
 * @param {string} customerId - Razorpay customer ID
 * @returns {Promise<Object>} Razorpay customer details
 * @throws {Error} If customer fetch fails
 */
async function fetchRazorpayCustomer(customerId) {
	try {
		if (!customerId) {
			throw new Error('Customer ID is required');
		}

		const razorpay = initializeRazorpay();
		const customer = await razorpay.customers.fetch(customerId);

		console.log('Razorpay customer details fetched successfully:', customerId);
		return customer;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Razorpay customer fetch failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Razorpay customer fetch process completed');
	}
}

/**
 * Update Razorpay customer details
 * @param {string} customerId - Razorpay customer ID
 * @param {Object} updateData - Customer update data
 * @param {string} [updateData.name] - Updated customer name
 * @param {string} [updateData.email] - Updated customer email
 * @param {string} [updateData.contact] - Updated customer phone
 * @param {Object} [updateData.notes] - Updated customer notes
 * @returns {Promise<Object>} Updated Razorpay customer object
 * @throws {Error} If customer update fails
 */
async function updateRazorpayCustomer(customerId, updateData) {
	try {
		if (!customerId) {
			throw new Error('Customer ID is required for update');
		}

		const { name, email, contact, notes } = updateData;

		// Validate at least one update field is provided
		if (!name && !email && !contact && !notes) {
			throw new Error('At least one update field must be provided');
		}

		// Validate email format if provided
		if (email) {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(email)) {
				throw new Error('Invalid email format');
			}
		}

		const razorpay = initializeRazorpay();

		const updateOptions = {};

		// Add fields that are being updated
		if (name) {
			updateOptions.name = name;
		}

		if (email) {
			updateOptions.email = email;
		}

		if (contact) {
			updateOptions.contact = contact;
		}

		if (notes) {
			updateOptions.notes = notes;
		}

		const customer = await razorpay.customers.edit(customerId, updateOptions);

		console.log('Razorpay customer updated successfully:', customerId);
		return customer;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Razorpay customer update failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Razorpay customer update process completed');
	}
}

/**
 * Reset Razorpay instance (for testing purposes only)
 * @private
 */
function _resetRazorpayInstance() {
	try {
		razorpayInstance = null;
	} catch (error) {
		// Ignore errors during reset
	} finally {
		// Always reset
	}
}

// Export all functions
module.exports = {
	// Initialization
	initializeRazorpay,

	// Customer management
	createRazorpayCustomer,
	fetchRazorpayCustomer,
	updateRazorpayCustomer,

	// Order-based payments (for one-time payments)
	createRazorpayOrder,
	fetchPaymentDetails,
	capturePayment,
	createRefund,

	// Subscription-based payments (recurring billing)
	createRazorpayPlan,
	createRazorpaySubscription,
	updateRazorpaySubscription,
	cancelRazorpaySubscription,
	fetchRazorpaySubscription,
	verifySubscriptionPaymentSignature,
	pauseRazorpaySubscription,
	resumeRazorpaySubscription,

	// Utilities
	calculateProratedAmount,
	processRefundToCredits,
	handleFailedPayments,

	// Test helper (should not be used in production)
	_resetRazorpayInstance,
};
