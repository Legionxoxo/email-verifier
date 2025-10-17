/**
 * Security middleware for rate limiting, validation, and headers
 * Provides protection against common attacks and abuse
 */

const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

// Import environment variables
const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, CORS_ORIGIN, NODE_ENV } = require('../../data/env');

// Rate limiting configurations

/**
 * Creates a no-op middleware for testing
 * @returns {Function} Express middleware that does nothing
 */
function createTestRateLimit() {
	return (req, res, next) => {
		next();
	};
}

/**
 * Determines if we should use rate limiting based on environment
 * @returns {boolean} True if rate limiting should be enabled
 */
function shouldEnableRateLimit() {
	return NODE_ENV !== 'test' && process.env.NODE_ENV !== 'test' && process.env.JEST_WORKER_ID === undefined;
}

/**
 * General API rate limiter
 */
const generalRateLimit = shouldEnableRateLimit()
	? rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: RATE_LIMIT_MAX,
			message: {
				success: false,
				message: 'Too many requests from this IP, please try again later.',
			},
			standardHeaders: true,
			legacyHeaders: false,
	  })
	: createTestRateLimit();

/**
 * Rate limiter for authentication endpoints - generous enough for normal use
 */
const authRateLimit = shouldEnableRateLimit()
	? rateLimit({
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 20, // Limit each IP to 20 auth requests per 15 minutes (allows for normal retries)
			message: {
				success: false,
				message: 'Too many authentication attempts, please try again later.',
			},
			standardHeaders: true,
			legacyHeaders: false,
	  })
	: createTestRateLimit();

/**
 * Rate limiter for OTP requests - prevents spam but allows legitimate use
 */
const otpRateLimit = shouldEnableRateLimit()
	? rateLimit({
			windowMs: 5 * 60 * 1000, // 5 minutes
			max: 5, // Limit each IP to 5 OTP requests per 5 minutes (allows for retries)
			message: {
				success: false,
				message: 'Too many OTP requests, please wait before requesting again.',
			},
			standardHeaders: true,
			legacyHeaders: false,
	  })
	: createTestRateLimit();

/**
 * Rate limiter for password reset requests
 */
const passwordResetRateLimit = shouldEnableRateLimit()
	? rateLimit({
			windowMs: 60 * 60 * 1000, // 1 hour
			max: 5, // Limit each IP to 5 password reset requests per hour
			message: {
				success: false,
				message: 'Too many password reset attempts, please try again later.',
			},
			standardHeaders: true,
			legacyHeaders: false,
	  })
	: createTestRateLimit();

// Security headers configuration

/**
 * Configure helmet for security headers
 */
const helmetConfig = /** @type {import('express').RequestHandler} */ (
	/** @type {any} */ (helmet)({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				scriptSrc: ["'self'"],
				imgSrc: ["'self'", 'data:', 'https:'],
				connectSrc: ["'self'"],
				fontSrc: ["'self'"],
				objectSrc: ["'none'"],
				mediaSrc: ["'self'"],
				frameSrc: ["'none'"],
			},
		},
		crossOriginEmbedderPolicy: false,
	})
);

// CORS configuration

/**
 * Configure CORS for cross-origin requests
 */
const corsConfig = cors({
	origin: function (origin, callback) {
		// Allow requests with no origin (same-origin, mobile apps, Postman, etc.)
		if (!origin) return callback(null, true);

		// In production, replace with your actual frontend domains
		const allowedOrigins = [
			'http://localhost:3000',
			'http://localhost:5000',
			'http://localhost:5173',
			CORS_ORIGIN,
		].filter(Boolean); // Remove falsy values

		if (allowedOrigins.includes(origin)) {
			callback(null, true);
		} else {
			callback(new Error('Not allowed by CORS'));
		}
	},
	credentials: true,
	optionsSuccessStatus: 200,
});

// Validation rules

/**
 * Validation rules for user registration
 */
const validateSignup = [
	body('firstName')
		.trim()
		.isLength({ min: 1, max: 50 })
		.withMessage('First name must be between 1 and 50 characters')
		.matches(/^[a-zA-Z\s]+$/)
		.withMessage('First name can only contain letters and spaces'),

	body('lastName')
		.optional({ nullable: true, checkFalsy: true })
		.trim()
		.isLength({ min: 0, max: 50 })
		.withMessage('Last name must be between 0 and 50 characters')
		.matches(/^[a-zA-Z\s]*$/)
		.withMessage('Last name can only contain letters and spaces'),

	body('email')
		.trim()
		.isEmail()
		.withMessage('Please provide a valid email address')
		.normalizeEmail()
		.isLength({ max: 255 })
		.withMessage('Email must be less than 255 characters'),

	body('password')
		.isLength({ min: 8, max: 128 })
		.withMessage('Password must be between 8 and 128 characters')
		.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
		.withMessage(
			'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
		),
];

/**
 * Validation rules for user login
 */
const validateLogin = [
	body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),

	body('password').notEmpty().withMessage('Password is required'),
];

/**
 * Validation rules for email-only requests (OTP, forgot password)
 */
const validateEmail = [
	body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
];

/**
 * Validation rules for OTP verification
 */
const validateOTP = [
	body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),

	body('otp')
		.isLength({ min: 6, max: 6 })
		.withMessage('OTP must be exactly 6 digits')
		.isNumeric()
		.withMessage('OTP must contain only numbers'),
];

/**
 * Validation rules for password reset
 */
const validatePasswordReset = [
	body('email')
		.trim()
		.isEmail()
		.withMessage('Please provide a valid email address')
		.normalizeEmail()
		.isLength({ max: 255 })
		.withMessage('Email must be less than 255 characters'),

	body('otp')
		.notEmpty()
		.withMessage('OTP verification code is required')
		.isLength({ min: 6, max: 6 })
		.withMessage('OTP must be exactly 6 digits')
		.isNumeric()
		.withMessage('OTP must contain only numbers'),

	body('newPassword')
		.isLength({ min: 8, max: 128 })
		.withMessage('Password must be between 8 and 128 characters')
		.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
		.withMessage(
			'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
		),
];

/**
 * Validation rules for refresh token
 */
const validateRefreshToken = [body('refreshToken').notEmpty().withMessage('Refresh token is required')];

/**
 * Middleware to handle validation errors
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
function handleValidationErrors(req, res, next) {
	try {
		const errors = validationResult(req);

		if (!errors.isEmpty()) {
			res.status(400).json({
				success: false,
				message: 'Validation failed',
				errors: errors.array(),
			});
			return;
		}

		next();
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Validation error handling failed:', errorMessage);

		res.status(500).json({
			success: false,
			message: 'Validation processing error',
		});
		return;
	} finally {
		console.debug('Validation error handling process completed');
	}
}

/**
 * Middleware to sanitize request body
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
function sanitizeInput(req, res, next) {
	try {
		if (req.body && typeof req.body === 'object') {
			for (const key in req.body) {
				if (typeof req.body[key] === 'string') {
					// Remove any potentially dangerous characters
					req.body[key] = req.body[key]
						.replace(/[<>]/g, '') // Remove < and >
						.trim(); // Remove leading/trailing whitespace
				}
			}
		}

		next();
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Input sanitization failed:', errorMessage);

		res.status(500).json({
			success: false,
			message: 'Input processing error',
		});
		return;
	} finally {
		console.debug('Input sanitization process completed');
	}
}

/**
 * Middleware to log security events
 * @param {string} eventType - Type of security event
 * @returns {Function} Express middleware function
 */
function logSecurityEvent(eventType) {
	return (req, res, next) => {
		try {
			const clientIP = req.ip || req.connection.remoteAddress;
			const userAgent = req.get('User-Agent') || 'Unknown';
			const timestamp = new Date().toISOString();

			console.log(`[SECURITY] ${timestamp} - ${eventType} - IP: ${clientIP} - UserAgent: ${userAgent}`);

			next();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error('Security logging failed:', errorMessage);

			// Continue processing even if logging fails
			next();
		} finally {
			console.debug('Security logging process completed');
		}
	};
}

// Export middleware and configurations
module.exports = {
	// Rate limiters
	generalRateLimit,
	authRateLimit,
	otpRateLimit,
	passwordResetRateLimit,

	// Security headers and CORS
	helmetConfig,
	corsConfig,

	// Validation rules
	validateSignup,
	validateLogin,
	validateEmail,
	validateOTP,
	validatePasswordReset,
	validateRefreshToken,

	// Utility middleware
	handleValidationErrors,
	sanitizeInput,
	logSecurityEvent,
};
