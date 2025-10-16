/**
 * Subscription management API routes
 * Defines all subscription and payment endpoints with comprehensive security
 *
 * @fileoverview Subscription API routes with payment processing
 */

const express = require('express');

const {
	getAllPlans,
	getUserSubscription,
	createSubscription,
	upgradeSubscription,
	cancelSubscription,
	getSubscriptionHistory,
	verifyPayment,
	getPaymentStatus,
} = require('../../functions/route_fns/subscriptions');

const { authenticate } = require('../../functions/middleware/auth');
const {
	authRateLimit,
	paymentRateLimit,
	subscriptionRateLimit,
	subscriptionViewRateLimit,
	validateEmail,
	handleValidationErrors,
	sanitizeInput,
	logSecurityEvent,
} = require('../../functions/middleware/security');

// Alias for stricter payment rate limiting
const paymentStrictRateLimit = subscriptionRateLimit;

const { body, query, param } = require('express-validator');

// Create router instance
const router = express.Router();

// Apply common middleware to all subscription routes
router.use(sanitizeInput);

// Validation middleware functions

/**
 * Validate subscription creation request
 */
const validateSubscriptionCreation = [
	body('planId').isInt({ min: 1 }).withMessage('Plan ID must be a positive integer'),
	body('billingCycle')
		.optional()
		.isIn(['monthly', 'yearly'])
		.withMessage('Billing cycle must be either monthly or yearly'),
	body('paymentMethod').optional().isString().withMessage('Payment method must be a string'),
	body('savePaymentMethod').optional().isBoolean().withMessage('Save payment method must be a boolean'),
];

/**
 * Validate subscription upgrade request
 */
const validateSubscriptionUpgrade = [
	body('newPlanCode').notEmpty().withMessage('New plan code is required')
		.isIn(['free', 'pro', 'plus']).withMessage('New plan code must be one of: free, pro, plus'),
];

/**
 * Validate subscription cancellation request
 */
const validateSubscriptionCancellation = [
	body('immediate').optional().isBoolean().withMessage('Immediate flag must be a boolean'),
	body('reason').optional().isLength({ max: 500 }).withMessage('Cancellation reason must not exceed 500 characters'),
	body('feedback').optional().isLength({ max: 1000 }).withMessage('Feedback must not exceed 1000 characters'),
];

/**
 * Validate payment verification request
 */
const validatePaymentVerification = [
	body('razorpay_payment_id').notEmpty().withMessage('Razorpay payment ID is required'),
	body('subscription_id').optional().isInt({ min: 1 }).withMessage('Subscription ID must be a positive integer'),
];

/**
 * Validate payment status query parameters
 */
const validatePaymentStatusParams = [
	param('subscriptionId').isInt({ min: 1 }).withMessage('Subscription ID must be a positive integer'),
];

/**
 * Validate subscription history query parameters
 */
const validateHistoryQuery = [
	query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
	query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
	query('type')
		.optional()
		.isIn(['subscription', 'refund', 'adjustment'])
		.withMessage('Type must be subscription, refund, or adjustment'),
	query('status')
		.optional()
		.isIn(['captured', 'failed', 'pending', 'refunded', 'cancelled'])
		.withMessage('Status must be captured, failed, pending, refunded, or cancelled'),
	query('dateFrom').optional().isISO8601().withMessage('dateFrom must be a valid ISO 8601 date'),
	query('dateTo').optional().isISO8601().withMessage('dateTo must be a valid ISO 8601 date'),
];

/**
 * Payment-specific rate limiting middleware (using alias from above)
 */

// Public subscription routes (no authentication required)

/**
 * GET /api/subscriptions/plans
 * Get all available subscription plans
 */
router.get(
	'/plans',
	/** @type {import('express').RequestHandler} */ (subscriptionViewRateLimit),
	/** @type {import('express').RequestHandler} */ (logSecurityEvent('PLANS_VIEW')),
	/** @type {import('express').RequestHandler} */ (getAllPlans)
);

// Protected subscription routes (authentication required)

/**
 * GET /api/subscriptions/current
 * Get user's current subscription details
 */
router.get(
	'/current',
	/** @type {import('express').RequestHandler} */ (authenticate),
	/** @type {import('express').RequestHandler} */ (subscriptionViewRateLimit),
	/** @type {import('express').RequestHandler} */ (logSecurityEvent('SUBSCRIPTION_VIEW')),
	/** @type {import('express').RequestHandler} */ (getUserSubscription)
);

/**
 * POST /api/subscriptions/create
 * Create new subscription with payment processing
 */
router.post(
	'/create',
	/** @type {import('express').RequestHandler} */ (authenticate),
	/** @type {import('express').RequestHandler} */ (paymentStrictRateLimit),
	/** @type {import('express').RequestHandler} */ (logSecurityEvent('SUBSCRIPTION_CREATE_ATTEMPT')),
	...validateSubscriptionCreation,
	/** @type {import('express').RequestHandler} */ (handleValidationErrors),
	/** @type {import('express').RequestHandler} */ (createSubscription)
);

/**
 * POST /api/subscriptions/upgrade
 * Upgrade subscription plan with prorated billing
 */
router.post(
	'/upgrade',
	/** @type {import('express').RequestHandler} */ (authenticate),
	/** @type {import('express').RequestHandler} */ (paymentStrictRateLimit),
	/** @type {import('express').RequestHandler} */ (logSecurityEvent('SUBSCRIPTION_UPGRADE_ATTEMPT')),
	...validateSubscriptionUpgrade,
	/** @type {import('express').RequestHandler} */ (handleValidationErrors),
	/** @type {import('express').RequestHandler} */ (upgradeSubscription)
);

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription (immediate or at period end)
 */
router.post(
	'/cancel',
	/** @type {import('express').RequestHandler} */ (authenticate),
	/** @type {import('express').RequestHandler} */ (authRateLimit),
	/** @type {import('express').RequestHandler} */ (logSecurityEvent('SUBSCRIPTION_CANCEL_ATTEMPT')),
	...validateSubscriptionCancellation,
	/** @type {import('express').RequestHandler} */ (handleValidationErrors),
	/** @type {import('express').RequestHandler} */ (cancelSubscription)
);

/**
 * GET /api/subscriptions/history
 * Get user's subscription transaction history with pagination
 */
router.get(
	'/history',
	/** @type {import('express').RequestHandler} */ (authenticate),
	/** @type {import('express').RequestHandler} */ (subscriptionViewRateLimit),
	/** @type {import('express').RequestHandler} */ (logSecurityEvent('SUBSCRIPTION_HISTORY_VIEW')),
	...validateHistoryQuery,
	/** @type {import('express').RequestHandler} */ (handleValidationErrors),
	/** @type {import('express').RequestHandler} */ (getSubscriptionHistory)
);

/**
 * GET /api/subscriptions/:subscriptionId/payment-status
 * Get payment status and subscription state for polling
 */
router.get(
	'/:subscriptionId/payment-status',
	/** @type {import('express').RequestHandler} */ (authenticate),
	/** @type {import('express').RequestHandler} */ (subscriptionViewRateLimit),
	/** @type {import('express').RequestHandler} */ (logSecurityEvent('PAYMENT_STATUS_CHECK')),
	...validatePaymentStatusParams,
	/** @type {import('express').RequestHandler} */ (handleValidationErrors),
	/** @type {import('express').RequestHandler} */ (getPaymentStatus)
);

/**
 * POST /api/subscriptions/verify-payment
 * Verify Razorpay payment signature and activate subscription
 */
router.post(
	'/verify-payment',
	/** @type {import('express').RequestHandler} */ (authenticate),
	/** @type {import('express').RequestHandler} */ (paymentStrictRateLimit),
	/** @type {import('express').RequestHandler} */ (logSecurityEvent('PAYMENT_VERIFICATION_ATTEMPT')),
	...validatePaymentVerification,
	/** @type {import('express').RequestHandler} */ (handleValidationErrors),
	/** @type {import('express').RequestHandler} */ (verifyPayment)
);

// Health check endpoint for subscription service

/**
 * GET /api/subscriptions/health
 * Health check for subscription service
 */
router.get('/health', (req, res) => {
	try {
		res.json({
			success: true,
			message: 'Subscription service is healthy',
			timestamp: new Date().toISOString(),
			services: {
				database: 'connected',
				razorpay: process.env.RAZORPAY_KEY_ID ? 'configured' : 'not_configured',
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Subscription health check failed:', errorMessage);

		res.status(500).json({
			success: false,
			message: 'Subscription service health check failed',
			timestamp: new Date().toISOString(),
		});
	} finally {
		console.debug('Subscription health check process completed');
	}
});

// Error handling middleware for subscription routes

router.use((error, req, res, next) => {
	try {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Subscription route error:', errorMessage);

		// Map specific error messages to user-friendly responses

		// Payment-related errors
		if (errorMessage.includes('Razorpay') || errorMessage.includes('payment')) {
			return res.status(402).json({
				success: false,
				message: 'Payment processing failed. Please check your payment details and try again.',
				code: 'PAYMENT_PROCESSING_ERROR',
			});
		}

		// Plan-related errors
		if (errorMessage.includes('plan') || errorMessage.includes('Plan')) {
			return res.status(400).json({
				success: false,
				message: 'Invalid subscription plan selected. Please choose a valid plan.',
				code: 'INVALID_PLAN_ERROR',
			});
		}

		// Subscription status errors
		if (errorMessage.includes('subscription') || errorMessage.includes('Subscription')) {
			return res.status(400).json({
				success: false,
				message: 'Subscription operation failed. Please check your current subscription status.',
				code: 'SUBSCRIPTION_OPERATION_ERROR',
			});
		}

		// Authentication errors
		if (error.name === 'UnauthorizedError' || errorMessage.includes('authentication')) {
			return res.status(401).json({
				success: false,
				message: 'Please log in to access subscription features.',
				code: 'AUTHENTICATION_REQUIRED',
			});
		}

		// Validation errors
		if (error.name === 'ValidationError' || errorMessage.includes('validation')) {
			return res.status(400).json({
				success: false,
				message: 'Invalid data provided. Please check your information and try again.',
				code: 'VALIDATION_ERROR',
				details: error.details || errorMessage,
			});
		}

		// Database errors
		if (errorMessage.includes('database') || errorMessage.includes('SQLITE')) {
			return res.status(500).json({
				success: false,
				message: 'Database error occurred. Please try again in a few moments.',
				code: 'DATABASE_ERROR',
			});
		}

		// Rate limiting errors
		if (error.name === 'TooManyRequestsError' || errorMessage.includes('rate limit')) {
			return res.status(429).json({
				success: false,
				message: 'You have made too many subscription requests recently. Please wait a moment before trying again.',
				code: 'SUBSCRIPTION_RATE_LIMIT_EXCEEDED',
				retryAfter: '60 seconds'
			});
		}

		// Network/timeout errors
		if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
			return res.status(504).json({
				success: false,
				message: 'Service temporarily unavailable. Please try again later.',
				code: 'SERVICE_TIMEOUT',
			});
		}

		// Generic server error
		res.status(500).json({
			success: false,
			message: 'An unexpected error occurred. Please try again later.',
			code: 'INTERNAL_SERVER_ERROR',
		});
	} catch (handlerError) {
		const handlerErrorMessage = handlerError instanceof Error ? handlerError.message : String(handlerError);
		console.error('Subscription error handler failed:', handlerErrorMessage);

		res.status(500).json({
			success: false,
			message: 'Critical error occurred. Please contact support.',
			code: 'CRITICAL_ERROR',
		});
	} finally {
		console.debug('Subscription error handling process completed');
	}
});

// Export router
module.exports = router;
