/**
 * Razorpay webhook handlers for subscription lifecycle events
 * Handles all webhook events to keep local subscription data in sync with Razorpay
 *
 * @fileoverview Comprehensive webhook handlers for Razorpay subscription events
 */

const crypto = require('crypto');
const { getDb } = require('../../database/connection');
const { capturePayment } = require('../utils/razorpay');

/**
 * @typedef {Object} DatabaseSubscription
 * @property {number} id - Subscription ID
 * @property {number} user_id - User ID
 * @property {string} status - Subscription status
 * @property {string} plan_code - Plan code
 * @property {number} total_amount - Total amount
 * @property {string} [razorpay_subscription_id] - Razorpay subscription ID
 * @property {number} [failed_payment_count] - Failed payment count
 * @property {number} [pause_count] - Pause count
 */

/**
 * Verify Razorpay webhook signature for security
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
async function verifyRazorpayWebhook(req, res, next) {
	try {
		const webhookSignature = req.headers['x-razorpay-signature'];
		const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

		if (!webhookSecret) {
			console.error('Razorpay webhook secret not configured');
			res.status(500).json({
				success: false,
				message: 'Webhook configuration error',
				timestamp: new Date().toISOString(),
			});
			return;
		}

		if (!webhookSignature) {
			console.error('Missing webhook signature in request');
			res.status(400).json({
				success: false,
				message: 'Missing webhook signature',
				timestamp: new Date().toISOString(),
			});
			return;
		}

		// Verify webhook signature
		const body = JSON.stringify(req.body);
		const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

		// Handle array of signatures (some webhooks send multiple)
		const signatureToVerify = Array.isArray(webhookSignature) ? webhookSignature[0] : webhookSignature;
		
		// Remove 'sha256=' prefix if present
		const cleanSignature = signatureToVerify.replace('sha256=', '');

		const isValid = crypto.timingSafeEqual(
			Buffer.from(cleanSignature, 'hex'),
			Buffer.from(expectedSignature, 'hex')
		);

		if (!isValid) {
			console.error('Invalid webhook signature detected');
			res.status(401).json({
				success: false,
				message: 'Invalid webhook signature',
				timestamp: new Date().toISOString(),
			});
			return;
		}

		console.log('Webhook signature verified successfully');
		next();
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Webhook signature verification failed:', errorMessage);

		res.status(500).json({
			success: false,
			message: 'Webhook signature verification failed',
			timestamp: new Date().toISOString(),
		});
	} finally {
		console.debug('Webhook signature verification process completed');
	}
}

/**
 * Handle subscription.authenticated event
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Processing result
 * @throws {Error} If processing fails
 */
async function handleSubscriptionAuthenticated(payload) {
	try {
		const { subscription } = payload;

		if (!subscription || !subscription.id) {
			throw new Error('Invalid subscription data in authenticated webhook');
		}

		const db = getDb();

		// Find subscription by Razorpay ID
		const getSubscription = db.prepare(`
            SELECT id, user_id, status FROM user_subscriptions 
            WHERE razorpay_subscription_id = ?
        `);
		const localSubscription = /** @type {DatabaseSubscription | undefined} */ (
			getSubscription.get(subscription.id)
		);

		if (!localSubscription) {
			console.warn('Subscription not found for authenticated event:', subscription.id);
			return { success: false, reason: 'Subscription not found' };
		}

		// Update subscription to authenticated status
		const updateSubscription = db.prepare(`
            UPDATE user_subscriptions 
            SET status = 'authenticated',
                updated_at = CURRENT_TIMESTAMP
            WHERE razorpay_subscription_id = ?
        `);

		const result = updateSubscription.run(subscription.id);

		console.log('Subscription authenticated successfully:', subscription.id);
		return {
			success: true,
			subscriptionId: localSubscription.id,
			razorpayId: subscription.id,
			changesApplied: result.changes,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Handle subscription authenticated failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Handle subscription authenticated process completed');
	}
}

/**
 * Handle subscription.activated event
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Processing result
 * @throws {Error} If processing fails
 */
async function handleSubscriptionActivated(payload) {
	try {
		const { subscription } = payload;

		if (!subscription || !subscription.id) {
			throw new Error('Invalid subscription data in activated webhook');
		}

		const db = getDb();

		// Find subscription by Razorpay ID
		const getSubscription = db.prepare(`
            SELECT id, user_id, status FROM user_subscriptions 
            WHERE razorpay_subscription_id = ?
        `);
		const localSubscription = /** @type {DatabaseSubscription | undefined} */ (
			getSubscription.get(subscription.id)
		);

		if (!localSubscription) {
			console.warn('Subscription not found for activated event:', subscription.id);
			return { success: false, reason: 'Subscription not found' };
		}

		// Update subscription details from Razorpay
		const currentPeriodStart = subscription.current_start
			? new Date(subscription.current_start * 1000).toISOString()
			: new Date().toISOString();

		const currentPeriodEnd = subscription.current_end
			? new Date(subscription.current_end * 1000).toISOString()
			: null;

		const nextBillingDate = subscription.charge_at
			? new Date(subscription.charge_at * 1000).toISOString()
			: currentPeriodEnd;

		const updateSubscription = db.prepare(`
            UPDATE user_subscriptions 
            SET status = 'active',
                current_period_start = ?,
                current_period_end = ?,
                next_billing_date = ?,
                failed_payment_count = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE razorpay_subscription_id = ?
        `);

		const result = updateSubscription.run(currentPeriodStart, currentPeriodEnd, nextBillingDate, subscription.id);

		console.log('Subscription activated successfully:', subscription.id);
		return {
			success: true,
			subscriptionId: localSubscription.id,
			razorpayId: subscription.id,
			changesApplied: result.changes,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Handle subscription activated failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Handle subscription activated process completed');
	}
}

/**
 * Handle subscription.charged event
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Processing result
 * @throws {Error} If processing fails
 */
async function handleSubscriptionCharged(payload) {
	try {
		const { subscription, payment } = payload;

		if (!subscription || !subscription.id || !payment) {
			throw new Error('Invalid subscription or payment data in charged webhook');
		}

		const db = getDb();

		// Find subscription by Razorpay ID
		const getSubscription = db.prepare(`
            SELECT id, user_id, status FROM user_subscriptions 
            WHERE razorpay_subscription_id = ?
        `);
		const localSubscription = /** @type {DatabaseSubscription | undefined} */ (
			getSubscription.get(subscription.id)
		);

		if (!localSubscription) {
			console.warn('Subscription not found for charged event:', subscription.id);
			return { success: false, reason: 'Subscription not found' };
		}

		// Start database transaction for atomic updates
		const transaction = db.transaction(() => {
			// Reset failed payment count on successful charge
			const updateSubscription = db.prepare(`
                UPDATE user_subscriptions 
                SET failed_payment_count = 0,
                    last_payment_attempt = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE razorpay_subscription_id = ?
            `);
			updateSubscription.run(subscription.id);

			// Record successful transaction
			const insertTransaction = db.prepare(`
                INSERT INTO subscription_transactions (
                    user_id, subscription_id, razorpay_payment_id, razorpay_order_id,
                    transaction_type, amount, net_amount, currency, status,
                    method, method_details_json, gateway_response_json, processed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

			const transactionId = insertTransaction.run(
				localSubscription.user_id,
				localSubscription.id,
				payment.id,
				payment.order_id || null,
				'subscription',
				payment.amount || 0,
				payment.amount || 0,
				payment.currency || 'INR',
				'captured',
				payment.method || 'unknown',
				JSON.stringify(payment),
				JSON.stringify({ subscription, payment }),
				new Date().toISOString()
			);

			return transactionId.lastInsertRowid;
		});

		const transactionId = transaction();

		console.log('Subscription charged successfully:', subscription.id, 'Transaction:', transactionId);
		return {
			success: true,
			subscriptionId: localSubscription.id,
			razorpayId: subscription.id,
			transactionId,
			amount: payment.amount,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Handle subscription charged failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Handle subscription charged process completed');
	}
}

/**
 * Handle subscription.updated event
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Processing result
 * @throws {Error} If processing fails
 */
async function handleSubscriptionUpdated(payload) {
	try {
		const { subscription } = payload;

		if (!subscription || !subscription.id) {
			throw new Error('Invalid subscription data in updated webhook');
		}

		const db = getDb();

		// Find subscription by Razorpay ID
		const getSubscription = db.prepare(`
            SELECT id, user_id, status FROM user_subscriptions 
            WHERE razorpay_subscription_id = ?
        `);
		const localSubscription = /** @type {DatabaseSubscription | undefined} */ (
			getSubscription.get(subscription.id)
		);

		if (!localSubscription) {
			console.warn('Subscription not found for updated event:', subscription.id);
			return { success: false, reason: 'Subscription not found' };
		}

		// Update subscription details from Razorpay
		const currentPeriodStart = subscription.current_start
			? new Date(subscription.current_start * 1000).toISOString()
			: null;

		const currentPeriodEnd = subscription.current_end
			? new Date(subscription.current_end * 1000).toISOString()
			: null;

		const nextBillingDate = subscription.charge_at
			? new Date(subscription.charge_at * 1000).toISOString()
			: currentPeriodEnd;

		const updateFields = [];
		const updateValues = [];

		if (currentPeriodStart) {
			updateFields.push('current_period_start = ?');
			updateValues.push(currentPeriodStart);
		}

		if (currentPeriodEnd) {
			updateFields.push('current_period_end = ?');
			updateValues.push(currentPeriodEnd);
		}

		if (nextBillingDate) {
			updateFields.push('next_billing_date = ?');
			updateValues.push(nextBillingDate);
		}

		updateFields.push('updated_at = CURRENT_TIMESTAMP');
		updateValues.push(subscription.id);

		const updateSubscription = db.prepare(`
            UPDATE user_subscriptions 
            SET ${updateFields.join(', ')}
            WHERE razorpay_subscription_id = ?
        `);

		const result = updateSubscription.run(...updateValues);

		console.log('Subscription updated successfully:', subscription.id);
		return {
			success: true,
			subscriptionId: localSubscription.id,
			razorpayId: subscription.id,
			changesApplied: result.changes,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Handle subscription updated failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Handle subscription updated process completed');
	}
}

/**
 * Handle subscription.cancelled event
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Processing result
 * @throws {Error} If processing fails
 */
async function handleSubscriptionCancelled(payload) {
	try {
		const { subscription } = payload;

		if (!subscription || !subscription.id) {
			throw new Error('Invalid subscription data in cancelled webhook');
		}

		const db = getDb();

		// Find subscription by Razorpay ID
		const getSubscription = db.prepare(`
            SELECT id, user_id, status FROM user_subscriptions 
            WHERE razorpay_subscription_id = ?
        `);
		const localSubscription = /** @type {DatabaseSubscription | undefined} */ (
			getSubscription.get(subscription.id)
		);

		if (!localSubscription) {
			console.warn('Subscription not found for cancelled event:', subscription.id);
			return { success: false, reason: 'Subscription not found' };
		}

		// Update subscription to cancelled status
		const cancelledAt = subscription.cancelled_at
			? new Date(subscription.cancelled_at * 1000).toISOString()
			: new Date().toISOString();

		const updateSubscription = db.prepare(`
            UPDATE user_subscriptions 
            SET status = 'cancelled',
                cancelled_at = ?,
                auto_renewal = 0,
                next_billing_date = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE razorpay_subscription_id = ?
        `);

		const result = updateSubscription.run(cancelledAt, subscription.id);

		console.log('Subscription cancelled successfully:', subscription.id);
		return {
			success: true,
			subscriptionId: localSubscription.id,
			razorpayId: subscription.id,
			cancelledAt,
			changesApplied: result.changes,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Handle subscription cancelled failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Handle subscription cancelled process completed');
	}
}

/**
 * Handle subscription.paused event
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Processing result
 * @throws {Error} If processing fails
 */
async function handleSubscriptionPaused(payload) {
	try {
		const { subscription } = payload;

		if (!subscription || !subscription.id) {
			throw new Error('Invalid subscription data in paused webhook');
		}

		const db = getDb();

		// Find subscription by Razorpay ID
		const getSubscription = db.prepare(`
            SELECT id, user_id, status, pause_count FROM user_subscriptions 
            WHERE razorpay_subscription_id = ?
        `);
		const localSubscription = getSubscription.get(subscription.id);

		if (!localSubscription) {
			console.warn('Subscription not found for paused event:', subscription.id);
			return { success: false, reason: 'Subscription not found' };
		}

		// Update subscription to paused status
		const pausedAt = subscription.paused_at
			? new Date(subscription.paused_at * 1000).toISOString()
			: new Date().toISOString();

		const resumeAt = subscription.resume_at ? new Date(subscription.resume_at * 1000).toISOString() : null;

		const updateSubscription = db.prepare(`
            UPDATE user_subscriptions 
            SET status = 'paused',
                pause_count = pause_count + 1,
                paused_at = ?,
                resume_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE razorpay_subscription_id = ?
        `);

		const result = updateSubscription.run(pausedAt, resumeAt, subscription.id);

		console.log('Subscription paused successfully:', subscription.id);
		return {
			success: true,
			subscriptionId: /** @type {DatabaseSubscription} */ (localSubscription).id,
			razorpayId: subscription.id,
			pausedAt,
			resumeAt,
			changesApplied: result.changes,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Handle subscription paused failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Handle subscription paused process completed');
	}
}

/**
 * Handle subscription.resumed event
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Processing result
 * @throws {Error} If processing fails
 */
async function handleSubscriptionResumed(payload) {
	try {
		const { subscription } = payload;

		if (!subscription || !subscription.id) {
			throw new Error('Invalid subscription data in resumed webhook');
		}

		const db = getDb();

		// Find subscription by Razorpay ID
		const getSubscription = db.prepare(`
            SELECT id, user_id, status FROM user_subscriptions 
            WHERE razorpay_subscription_id = ?
        `);
		const localSubscription = /** @type {DatabaseSubscription | undefined} */ (
			getSubscription.get(subscription.id)
		);

		if (!localSubscription) {
			console.warn('Subscription not found for resumed event:', subscription.id);
			return { success: false, reason: 'Subscription not found' };
		}

		// Update subscription to active status
		const updateSubscription = db.prepare(`
            UPDATE user_subscriptions 
            SET status = 'active',
                paused_at = NULL,
                resume_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE razorpay_subscription_id = ?
        `);

		const result = updateSubscription.run(subscription.id);

		console.log('Subscription resumed successfully:', subscription.id);
		return {
			success: true,
			subscriptionId: localSubscription.id,
			razorpayId: subscription.id,
			changesApplied: result.changes,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Handle subscription resumed failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Handle subscription resumed process completed');
	}
}

/**
 * Handle payment.failed event
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Processing result
 * @throws {Error} If processing fails
 */
async function handlePaymentFailed(payload) {
	try {
		const { payment } = payload;

		if (!payment || !payment.id) {
			throw new Error('Invalid payment data in failed webhook');
		}

		const db = getDb();

		// Find subscription by payment notes or subscription ID
		let localSubscription = /** @type {DatabaseSubscription | null} */ (null);

		if (payment.notes && payment.notes.subscription_id) {
			const getSubscriptionByRazorpayId = db.prepare(`
                SELECT id, user_id, status, failed_payment_count FROM user_subscriptions 
                WHERE razorpay_subscription_id = ?
            `);
			localSubscription =
				/** @type {DatabaseSubscription | undefined} */ (
					getSubscriptionByRazorpayId.get(payment.notes.subscription_id)
				) || null;
		}

		if (!localSubscription && payment.order_id) {
			// Try to find by recent transaction
			const getSubscriptionByOrder = db.prepare(`
                SELECT us.id, us.user_id, us.status, us.failed_payment_count
                FROM user_subscriptions us
                INNER JOIN subscription_transactions st ON us.id = st.subscription_id
                WHERE st.razorpay_order_id = ?
                ORDER BY st.created_at DESC
                LIMIT 1
            `);
			localSubscription =
				/** @type {DatabaseSubscription | undefined} */ (getSubscriptionByOrder.get(payment.order_id)) || null;
		}

		if (!localSubscription) {
			console.warn('Subscription not found for payment failed event:', payment.id);
			return { success: false, reason: 'Subscription not found' };
		}

		// Start database transaction for atomic updates
		const transaction = db.transaction(() => {
			// Increment failed payment count
			const updateSubscription = db.prepare(`
                UPDATE user_subscriptions 
                SET failed_payment_count = failed_payment_count + 1,
                    last_payment_attempt = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
			updateSubscription.run(localSubscription.id);

			// Record failed transaction
			const insertTransaction = db.prepare(`
                INSERT INTO subscription_transactions (
                    user_id, subscription_id, razorpay_payment_id, razorpay_order_id,
                    transaction_type, amount, net_amount, currency, status,
                    method, failure_reason, failure_code, gateway_response_json,
                    retry_count, processed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

			const transactionId = insertTransaction.run(
				localSubscription.user_id,
				localSubscription.id,
				payment.id,
				payment.order_id || null,
				'subscription',
				payment.amount || 0,
				payment.amount || 0,
				payment.currency || 'INR',
				'failed',
				payment.method || 'unknown',
				payment.error_description || 'Payment failed',
				payment.error_code || 'PAYMENT_FAILED',
				JSON.stringify(payment),
				localSubscription.failed_payment_count + 1,
				new Date().toISOString()
			);

			return transactionId.lastInsertRowid;
		});

		const transactionId = transaction();

		console.log('Payment failed recorded successfully:', payment.id, 'Transaction:', transactionId);
		return {
			success: true,
			subscriptionId: localSubscription.id,
			paymentId: payment.id,
			transactionId,
			failureCount: localSubscription.failed_payment_count + 1,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Handle payment failed failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Handle payment failed process completed');
	}
}

/**
 * Handle payment.authorized event
 * Captures the authorized payment and activates the associated subscription
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Processing result
 * @throws {Error} If processing fails
 */
async function handlePaymentAuthorized(payload) {
	try {
		// Extract payment data - it's nested under payload.payment.entity
		const payment = payload.payment?.entity;

		if (!payment || !payment.id) {
			console.error('Payment data structure:', JSON.stringify(payload, null, 2));
			throw new Error('Invalid payment data in authorized webhook');
		}

		const db = getDb();

		console.log('Payment details for subscription lookup:', {
			paymentId: payment.id,
			email: payment.email,
			contact: payment.contact,
			amount: payment.amount,
			description: payment.description,
			notes: payment.notes,
			order_id: payment.order_id
		});

		// Find subscription by payment notes or order details
		let localSubscription = /** @type {DatabaseSubscription | null} */ (null);

		// Try to find subscription through various methods
		if (payment.notes && payment.notes.subscription_id) {
			console.log('Attempting to find subscription by notes.subscription_id:', payment.notes.subscription_id);
			const getSubscriptionByRazorpayId = db.prepare(`
                SELECT id, user_id, status, plan_code, total_amount, razorpay_subscription_id 
                FROM user_subscriptions 
                WHERE razorpay_subscription_id = ?
            `);
			localSubscription =
				/** @type {DatabaseSubscription | undefined} */ (
					getSubscriptionByRazorpayId.get(payment.notes.subscription_id)
				) || null;
		}

		if (!localSubscription && payment.notes && payment.notes.user_id) {
			console.log('Attempting to find subscription by notes.user_id:', payment.notes.user_id);
			// Try to find by user ID and created status
			const getSubscriptionByUserId = db.prepare(`
                SELECT id, user_id, status, plan_code, total_amount, razorpay_subscription_id 
                FROM user_subscriptions 
                WHERE user_id = ? AND status = 'created'
                ORDER BY created_at DESC
                LIMIT 1
            `);
			localSubscription =
				/** @type {DatabaseSubscription | undefined} */ (
					getSubscriptionByUserId.get(parseInt(payment.notes.user_id))
				) || null;
		}

		if (!localSubscription && payment.order_id) {
			console.log('Attempting to find subscription by order_id:', payment.order_id);
			// Try to find by recent transaction
			const getSubscriptionByOrder = db.prepare(`
                SELECT us.id, us.user_id, us.status, us.plan_code, us.total_amount, us.razorpay_subscription_id
                FROM user_subscriptions us
                INNER JOIN subscription_transactions st ON us.id = st.subscription_id
                WHERE st.razorpay_order_id = ?
                ORDER BY st.created_at DESC
                LIMIT 1
            `);
			localSubscription =
				/** @type {DatabaseSubscription | undefined} */ (getSubscriptionByOrder.get(payment.order_id)) || null;
		}

		// If still not found, try to find by email and amount (fallback method)
		if (!localSubscription && payment.email) {
			console.log('Attempting to find subscription by email and amount:', payment.email, payment.amount);
			const getSubscriptionByEmailAndAmount = db.prepare(`
                SELECT us.id, us.user_id, us.status, us.plan_code, us.total_amount, us.razorpay_subscription_id
                FROM user_subscriptions us
                INNER JOIN users u ON us.user_id = u.id
                WHERE u.email = ? AND us.total_amount = ? AND us.status = 'created'
                ORDER BY us.created_at DESC
                LIMIT 1
            `);
			localSubscription =
				/** @type {DatabaseSubscription | undefined} */ (
					getSubscriptionByEmailAndAmount.get(payment.email, payment.amount)
				) || null;
		}


		if (!localSubscription) {
			// Check if this is an upgrade payment (doesn't need subscription activation)
			const isUpgradePayment = payment.description && 
				(payment.description.includes('Updating Subscription') || 
				 payment.description.includes('Upgrade') ||
				 payment.description.includes('upgrade'));
			
			if (isUpgradePayment) {
				console.log('Payment authorized for upgrade - no subscription activation needed:', payment.id);
				
				// For upgrade payments, try to find any active subscription for this user
				const getActiveSubscription = db.prepare(`
					SELECT us.id, us.user_id, us.status, us.plan_code, us.total_amount, us.razorpay_subscription_id
					FROM user_subscriptions us
					INNER JOIN users u ON us.user_id = u.id
					WHERE u.email = ? AND us.status = 'active'
					ORDER BY us.updated_at DESC
					LIMIT 1
				`);
				const activeSubscription = /** @type {DatabaseSubscription | undefined} */ (getActiveSubscription.get(payment.email));
				
				if (activeSubscription) {
					// Check for duplicate upgrade payment transaction
					const checkDuplicateTransaction = db.prepare(`
						SELECT id FROM subscription_transactions
						WHERE razorpay_payment_id = ? AND user_id = ?
					`);
					const existingTransaction = /** @type {{id: number} | undefined} */ (checkDuplicateTransaction.get(payment.id, activeSubscription.user_id));
					
					if (existingTransaction) {
						console.log('Duplicate upgrade payment detected for payment ID:', payment.id);
						return { 
							success: true, 
							reason: 'Duplicate upgrade payment - already processed',
							subscriptionId: activeSubscription.id,
							transactionId: existingTransaction.id
						};
					}
					
					// Record the upgrade payment as a transaction
					const recordTransaction = db.prepare(`
						INSERT INTO subscription_transactions (
							user_id, subscription_id, transaction_type, method, status,
							amount, currency, description, razorpay_payment_id, razorpay_order_id,
							created_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
					`);
					
					recordTransaction.run(
						activeSubscription.user_id,
						activeSubscription.id,
						'adjustment', // This is an upgrade adjustment payment
						payment.method || 'unknown',
						'captured',
						payment.amount,
						payment.currency || 'INR',
						payment.description || 'Subscription upgrade payment',
						payment.id,
						payment.order_id || null
					);
					
					console.log('Upgrade payment transaction recorded for subscription:', activeSubscription.id);
					return { 
						success: true, 
						reason: 'Upgrade payment processed',
						subscriptionId: activeSubscription.id 
					};
				}
			}
			
			// Debug: List recent subscriptions to help identify the issue  
			const recentSubscriptions = db.prepare(`
                SELECT us.id, us.user_id, us.status, us.plan_code, us.total_amount, us.razorpay_subscription_id, u.email
                FROM user_subscriptions us
                INNER JOIN users u ON us.user_id = u.id
                WHERE us.created_at > datetime('now', '-1 hour')
                ORDER BY us.created_at DESC
                LIMIT 10
            `).all();
			
			console.warn('Subscription not found for payment authorized event:', payment.id);
			console.warn('Recent subscriptions in database:', recentSubscriptions);
			console.warn('Payment email:', payment.email, 'Payment amount:', payment.amount);
			
			return { success: false, reason: 'Subscription not found' };
		}

		// Check if subscription is already active (duplicate prevention)
		if (localSubscription.status === 'active') {
			console.log('Subscription already active, checking if this is a duplicate payment authorization:', localSubscription.id);
			
			// Check if we already have a successful transaction for this payment
			const checkExistingTransaction = db.prepare(`
				SELECT id, status FROM subscription_transactions
				WHERE razorpay_payment_id = ? AND subscription_id = ?
			`);
			const existingTransaction = /** @type {{id: number, status: string} | undefined} */ (checkExistingTransaction.get(payment.id, localSubscription.id));
			
			if (existingTransaction) {
				console.log('Duplicate payment.authorized event detected for payment ID:', payment.id, 'existing transaction:', existingTransaction.id);
				return { 
					success: true, 
					reason: 'Duplicate payment authorization - already processed',
					subscriptionId: localSubscription.id,
					transactionId: existingTransaction.id,
					subscriptionStatus: 'active'
				};
			}
		}

		// For subscription payments, check if payment is already captured
		// If it's already captured, use the payment as-is; otherwise capture it
		let capturedPayment = payment;
		
		if (payment.status === 'authorized' && !payment.captured) {
			console.log('Payment is authorized but not captured, capturing manually...');
			capturedPayment = await capturePayment(payment.id, payment.amount, payment.currency || 'INR');

			if (capturedPayment.status !== 'captured') {
				throw new Error(`Payment capture failed. Status: ${capturedPayment.status}`);
			}
		} else if (payment.status === 'captured' || payment.captured === true) {
			console.log('Payment is already captured, proceeding with subscription activation...');
			capturedPayment = payment;
		} else {
			throw new Error(`Payment is in unexpected status: ${payment.status}`);
		}

		// Start database transaction for atomic subscription activation
		const transaction = db.transaction(() => {
			// Update subscription status to active
			const updateSubscription = db.prepare(`
                UPDATE user_subscriptions 
                SET status = 'active',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
			const updateResult = updateSubscription.run(localSubscription.id);
			console.log('Subscription status update result:', updateResult.changes, 'rows changed for subscription ID:', localSubscription.id);

			// Insert transaction record
			const insertTransaction = db.prepare(`
                INSERT INTO subscription_transactions (
                    user_id, subscription_id, razorpay_payment_id, razorpay_order_id,
                    transaction_type, amount, net_amount, currency, status,
                    method, method_details_json, gateway_response_json, processed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

			const transactionId = insertTransaction.run(
				localSubscription.user_id,
				localSubscription.id,
				capturedPayment.id,
				capturedPayment.order_id || null,
				'subscription',
				capturedPayment.amount,
				capturedPayment.amount,
				capturedPayment.currency,
				'captured',
				capturedPayment.method || 'unknown',
				JSON.stringify(capturedPayment),
				JSON.stringify({ payment: capturedPayment }),
				new Date().toISOString()
			);

			return transactionId.lastInsertRowid;
		});

		const transactionId = transaction();

		console.log(
			'Payment authorized and captured successfully:',
			payment.id,
			'Subscription activated:',
			localSubscription.id,
			'Transaction:',
			transactionId
		);

		return {
			success: true,
			subscriptionId: localSubscription.id,
			paymentId: capturedPayment.id,
			transactionId,
			amount: capturedPayment.amount,
			status: 'captured',
			subscriptionStatus: 'active',
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Handle payment authorized failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Handle payment authorized process completed');
	}
}

/**
 * Handle payment.captured event
 * Activates the associated subscription when payment is captured
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Processing result
 * @throws {Error} If processing fails
 */
async function handlePaymentCaptured(payload) {
	try {
		// Extract payment data - it's nested under payload.payment.entity
		const payment = payload.payment?.entity;

		if (!payment || !payment.id) {
			console.error('Payment data structure:', JSON.stringify(payload, null, 2));
			throw new Error('Invalid payment data in captured webhook');
		}

		console.log('Payment captured event received:', {
			paymentId: payment.id,
			email: payment.email,
			amount: payment.amount,
			status: payment.status,
			captured: payment.captured
		});

		const db = getDb();

		// Find subscription by payment details (same logic as payment.authorized)
		let localSubscription = /** @type {DatabaseSubscription | null} */ (null);

		// Try to find subscription through various methods
		if (payment.notes && payment.notes.subscription_id) {
			console.log('Attempting to find subscription by notes.subscription_id:', payment.notes.subscription_id);
			const getSubscriptionByRazorpayId = db.prepare(`
                SELECT id, user_id, status, plan_code, total_amount, razorpay_subscription_id 
                FROM user_subscriptions 
                WHERE razorpay_subscription_id = ?
            `);
			localSubscription =
				/** @type {DatabaseSubscription | undefined} */ (
					getSubscriptionByRazorpayId.get(payment.notes.subscription_id)
				) || null;
		}

		if (!localSubscription && payment.notes && payment.notes.user_id) {
			console.log('Attempting to find subscription by notes.user_id:', payment.notes.user_id);
			const getSubscriptionByUserId = db.prepare(`
                SELECT id, user_id, status, plan_code, total_amount, razorpay_subscription_id 
                FROM user_subscriptions 
                WHERE user_id = ? AND status = 'created'
                ORDER BY created_at DESC
                LIMIT 1
            `);
			localSubscription =
				/** @type {DatabaseSubscription | undefined} */ (
					getSubscriptionByUserId.get(parseInt(payment.notes.user_id))
				) || null;
		}

		if (!localSubscription && payment.email) {
			console.log('Attempting to find subscription by email and amount:', payment.email, payment.amount);
			const getSubscriptionByEmailAndAmount = db.prepare(`
                SELECT us.id, us.user_id, us.status, us.plan_code, us.total_amount, us.razorpay_subscription_id
                FROM user_subscriptions us
                INNER JOIN users u ON us.user_id = u.id
                WHERE u.email = ? AND us.total_amount = ? AND us.status = 'created'
                ORDER BY us.created_at DESC
                LIMIT 1
            `);
			localSubscription =
				/** @type {DatabaseSubscription | undefined} */ (
					getSubscriptionByEmailAndAmount.get(payment.email, payment.amount)
				) || null;
		}

		if (!localSubscription) {
			// Check if this is an upgrade payment (doesn't need subscription activation)
			const isUpgradePayment = payment.description && 
				(payment.description.includes('Updating Subscription') || 
				 payment.description.includes('Upgrade') ||
				 payment.description.includes('upgrade'));
			
			if (isUpgradePayment) {
				console.log('Payment captured for upgrade - no subscription activation needed:', payment.id);
				
				// For upgrade payments, try to find any active subscription for this user
				const getActiveSubscription = db.prepare(`
					SELECT us.id, us.user_id, us.status, us.plan_code, us.total_amount, us.razorpay_subscription_id
					FROM user_subscriptions us
					INNER JOIN users u ON us.user_id = u.id
					WHERE u.email = ? AND us.status = 'active'
					ORDER BY us.updated_at DESC
					LIMIT 1
				`);
				const activeSubscription = /** @type {DatabaseSubscription | undefined} */ (getActiveSubscription.get(payment.email));
				
				if (activeSubscription) {
					// Check for duplicate upgrade payment transaction
					const checkDuplicateTransaction = db.prepare(`
						SELECT id FROM subscription_transactions
						WHERE razorpay_payment_id = ? AND user_id = ?
					`);
					const existingTransaction = /** @type {{id: number} | undefined} */ (checkDuplicateTransaction.get(payment.id, activeSubscription.user_id));
					
					if (existingTransaction) {
						console.log('Duplicate upgrade payment captured event detected for payment ID:', payment.id);
						return { 
							success: true, 
							reason: 'Duplicate upgrade payment captured - already processed',
							subscriptionId: activeSubscription.id,
							transactionId: existingTransaction.id
						};
					}
					
					// Record the upgrade payment as a transaction
					const recordTransaction = db.prepare(`
						INSERT INTO subscription_transactions (
							user_id, subscription_id, transaction_type, method, status,
							amount, currency, description, razorpay_payment_id, razorpay_order_id,
							created_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
					`);
					
					recordTransaction.run(
						activeSubscription.user_id,
						activeSubscription.id,
						'adjustment', // This is an upgrade adjustment payment
						payment.method || 'unknown',
						'captured',
						payment.amount,
						payment.currency || 'INR',
						payment.description || 'Subscription upgrade payment',
						payment.id,
						payment.order_id || null
					);
					
					console.log('Upgrade payment transaction recorded for subscription:', activeSubscription.id);
					return { 
						success: true, 
						reason: 'Upgrade payment processed',
						subscriptionId: activeSubscription.id 
					};
				}
			}
			
			console.warn('Subscription not found for payment captured event:', payment.id);
			return { success: false, reason: 'Subscription not found' };
		}

		console.log('Found subscription for captured payment:', {
			subscriptionId: localSubscription.id,
			currentStatus: localSubscription.status,
			razorpaySubscriptionId: localSubscription.razorpay_subscription_id
		});

		// Check if subscription is already active or if payment already processed (duplicate prevention)
		if (localSubscription.status === 'active') {
			console.log('Subscription already active, checking if this is a duplicate payment captured event:', localSubscription.id);
			
			// Check if we already have a transaction for this payment
			const checkExistingTransaction = db.prepare(`
				SELECT id, status FROM subscription_transactions
				WHERE razorpay_payment_id = ? AND subscription_id = ?
			`);
			const existingTransaction = /** @type {{id: number, status: string} | undefined} */ (checkExistingTransaction.get(payment.id, localSubscription.id));
			
			if (existingTransaction) {
				console.log('Duplicate payment.captured event detected for payment ID:', payment.id, 'existing transaction:', existingTransaction.id);
				return { 
					success: true, 
					reason: 'Duplicate payment captured - already processed',
					subscriptionId: localSubscription.id,
					transactionId: existingTransaction.id,
					subscriptionStatus: 'active'
				};
			}
		}

		// Only activate if subscription is still in 'created' status
		if (localSubscription.status !== 'created') {
			console.log('Subscription already processed, status:', localSubscription.status);
			return { success: true, reason: 'Subscription already processed' };
		}

		// Start database transaction for atomic subscription activation
		const transaction = db.transaction(() => {
			// Update subscription status to active
			const updateSubscription = db.prepare(`
                UPDATE user_subscriptions 
                SET status = 'active',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
			const updateResult = updateSubscription.run(localSubscription.id);
			console.log('Subscription status update result:', updateResult.changes, 'rows changed for subscription ID:', localSubscription.id);

			// Insert transaction record
			const insertTransaction = db.prepare(`
                INSERT INTO subscription_transactions (
                    user_id, subscription_id, razorpay_payment_id, razorpay_order_id,
                    transaction_type, amount, net_amount, currency, status,
                    method, method_details_json, gateway_response_json, processed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

			const transactionId = insertTransaction.run(
				localSubscription.user_id,
				localSubscription.id,
				payment.id,
				payment.order_id || null,
				'subscription',
				payment.amount,
				payment.amount,
				payment.currency,
				'captured',
				payment.method || 'unknown',
				JSON.stringify(payment),
				JSON.stringify({ payment }),
				new Date().toISOString()
			);

			return transactionId.lastInsertRowid;
		});

		const transactionId = transaction();

		console.log(
			'Payment captured and subscription activated:',
			payment.id,
			'Subscription ID:',
			localSubscription.id,
			'Transaction:',
			transactionId
		);

		return {
			success: true,
			subscriptionId: localSubscription.id,
			paymentId: payment.id,
			transactionId,
			amount: payment.amount,
			status: 'captured',
			subscriptionStatus: 'active',
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Handle payment captured failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Handle payment captured process completed');
	}
}

/**
 * Handle order.paid event
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Processing result
 * @throws {Error} If processing fails
 */
async function handleOrderPaid(payload) {
	try {
		const { payment, order } = payload;

		if (!payment || !order) {
			throw new Error('Invalid payment or order data in order.paid webhook');
		}

		console.log('Order paid event received:', {
			orderId: order.id,
			paymentId: payment.id,
			amount: payment.amount,
			status: payment.status
		});

		// For order.paid events, we typically just log them as they're usually 
		// already handled by payment.captured events. Order.paid is more of a 
		// confirmation that the entire order (which may have multiple payments) is complete.
		
		// Check if this is an upgrade payment
		const isUpgradePayment = payment.description && 
			(payment.description.includes('Updating Subscription') || 
			 payment.description.includes('Upgrade') ||
			 payment.description.includes('upgrade'));
		
		if (isUpgradePayment) {
			console.log('Order paid for upgrade - already handled by payment events');
			return { 
				success: true, 
				reason: 'Upgrade order payment already processed',
				paymentId: payment.id,
				orderId: order.id
			};
		}

		// For regular orders, log the completion
		console.log('Order completed successfully:', order.id);
		
		return {
			success: true,
			reason: 'Order paid event processed',
			paymentId: payment.id,
			orderId: order.id,
			amount: payment.amount
		};
		
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Handle order paid failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Handle order paid process completed');
	}
}

/**
 * Main webhook processor that routes to specific handlers
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
async function processWebhook(req, res) {
	try {
		const { event, payload } = req.body;

		if (!event || !payload) {
			res.status(400).json({
				success: false,
				message: 'Invalid webhook data',
				timestamp: new Date().toISOString(),
			});
			return;
		}

		console.log('Processing webhook event: ', event, JSON.stringify(req.body, null, '\t'));

		let result = null;

		// Route to appropriate handler based on event type
		switch (event) {
			case 'subscription.authenticated':
				result = await handleSubscriptionAuthenticated(payload);
				break;

			case 'subscription.activated':
				result = await handleSubscriptionActivated(payload);
				break;

			case 'subscription.charged':
				result = await handleSubscriptionCharged(payload);
				break;

			case 'subscription.updated':
				result = await handleSubscriptionUpdated(payload);
				break;

			case 'subscription.cancelled':
				result = await handleSubscriptionCancelled(payload);
				break;

			case 'subscription.paused':
				result = await handleSubscriptionPaused(payload);
				break;

			case 'subscription.resumed':
				result = await handleSubscriptionResumed(payload);
				break;

			case 'payment.authorized':
				result = await handlePaymentAuthorized(payload);
				break;

			case 'payment.captured':
				result = await handlePaymentCaptured(payload);
				break;

			case 'payment.failed':
				result = await handlePaymentFailed(payload);
				break;

			case 'order.paid':
				result = await handleOrderPaid(payload);
				break;

			default:
				console.log('Unhandled webhook event:', event);
				result = { success: true, reason: 'Event not handled' };
				break;
		}

		// Always respond with 200 OK to prevent Razorpay retries
		res.status(200).json({
			success: true,
			message: 'Webhook processed successfully',
			event,
			result,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Webhook processing failed:', errorMessage);

		// Always respond with 200 OK even on errors to prevent retries
		res.status(200).json({
			success: true,
			message: 'Webhook processed successfully',
			event: req.body?.event || 'unknown',
			error: errorMessage,
			timestamp: new Date().toISOString(),
		});
	} finally {
		console.debug('Webhook processing completed');
	}
}

// Export all functions
module.exports = {
	verifyRazorpayWebhook,
	handleSubscriptionAuthenticated,
	handleSubscriptionActivated,
	handleSubscriptionCharged,
	handleSubscriptionUpdated,
	handleSubscriptionCancelled,
	handleSubscriptionPaused,
	handleSubscriptionResumed,
	handlePaymentAuthorized,
	handlePaymentCaptured,
	handlePaymentFailed,
	processWebhook,
};
