/**
 * Authentication API routes with comprehensive security middleware
 * Defines all authentication endpoints with rate limiting, validation, and security logging
 * 
 * This module provides secure authentication endpoints including:
 * - User registration and email verification flows
 * - Login with password and OTP verification options
 * - Password reset and token refresh capabilities
 * - Profile management and session control
 * - Comprehensive error handling and security monitoring
 */

const express = require('express');

// Import authentication route handlers
const {
    handleSignup,
    handleLogin,
    handleSendOTP,
    handleVerifyOTP,
    handleForgotPassword,
    handleResetPassword,
    handleRefreshToken,
    handleLogout,
    handleGetProfile
} = require('../../functions/route_fns/auth');

// Import signup-related functions separately to avoid potential circular dependency
const { handleSignupVerification } = require('../../functions/route_fns/auth/signup-verification');
const { handleResendSignupOTP } = require('../../functions/route_fns/auth/signup');

// Import security middleware
const {
    authRateLimit,
    otpRateLimit,
    passwordResetRateLimit,
    validateSignup,
    validateLogin,
    validateEmail,
    validateOTP,
    validatePasswordReset,
    validateRefreshToken,
    handleValidationErrors,
    sanitizeInput,
    logSecurityEvent
} = require('../../functions/middleware/security');

// Import authentication middleware
const { authenticate } = require('../../functions/middleware/auth');



// Create Express router instance
const router = express.Router();


// Apply common security middleware to all authentication routes
router.use(sanitizeInput);



// Authentication route definitions with security middleware


/**
 * POST /api/auth/signup
 * Register a new user account with email verification
 * 
 * Security features:
 * - Rate limiting to prevent spam
 * - Input validation and sanitization
 * - Security event logging
 * - Duplicate email checking
 */
router.post('/signup',
    /** @type {import('express').RequestHandler} */ (authRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('SIGNUP_ATTEMPT')),
    ...validateSignup,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleSignup)
);


/**
 * POST /api/auth/signup/resend
 * Resend OTP for unverified signup users
 * 
 * Security features:
 * - Rate limiting to prevent spam
 * - Email validation
 * - Security event logging
 * - User verification status checking
 */
router.post('/signup/resend',
    /** @type {import('express').RequestHandler} */ (authRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('SIGNUP_OTP_RESEND')),
    ...validateEmail,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleResendSignupOTP)
);


/**
 * POST /api/auth/signup/verify
 * Verify email during signup process and complete account setup
 * 
 * Security features:
 * - OTP validation with attempt limits
 * - Automatic account verification
 * - Razorpay customer creation
 * - Automatic user login after verification
 */
router.post('/signup/verify',
    /** @type {import('express').RequestHandler} */ (authRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('SIGNUP_VERIFICATION')),
    ...validateOTP,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleSignupVerification)
);


/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login',
    /** @type {import('express').RequestHandler} */ (authRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('LOGIN_ATTEMPT')),
    ...validateLogin,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleLogin)
);


/**
 * POST /api/auth/send-otp
 * Send OTP code to user's email
 */
router.post('/send-otp',
    /** @type {import('express').RequestHandler} */ (otpRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('OTP_REQUEST')),
    ...validateEmail,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleSendOTP)
);


/**
 * POST /api/auth/verify-otp
 * Verify OTP code and complete email verification
 */
router.post('/verify-otp',
    /** @type {import('express').RequestHandler} */ (authRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('OTP_VERIFICATION')),
    ...validateOTP,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleVerifyOTP)
);


/**
 * POST /api/auth/forgot-password
 * Request password reset link
 */
router.post('/forgot-password',
    /** @type {import('express').RequestHandler} */ (passwordResetRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('PASSWORD_RESET_REQUEST')),
    ...validateEmail,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleForgotPassword)
);


/**
 * POST /api/auth/reset-password
 * Reset password using reset token
 */
router.post('/reset-password',
    /** @type {import('express').RequestHandler} */ (authRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('PASSWORD_RESET')),
    ...validatePasswordReset,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleResetPassword)
);


/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh',
    /** @type {import('express').RequestHandler} */ (authRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('TOKEN_REFRESH')),
    ...validateRefreshToken,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleRefreshToken)
);


/**
 * POST /api/auth/logout
 * Logout user and invalidate refresh token
 */
router.post('/logout',
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('LOGOUT')),
    /** @type {import('express').RequestHandler} */ (handleLogout)
);


/**
 * GET /api/auth/profile
 * Get authenticated user's profile
 */
router.get('/profile',
    authenticate,
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('PROFILE_ACCESS')),
    /** @type {import('express').RequestHandler} */ (handleGetProfile)
);



// Service health and monitoring endpoints

/**
 * GET /api/auth/health
 * Health check endpoint for authentication service monitoring
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends health status JSON response
 */
router.get('/health', (req, res) => {
    try {
        const healthData = {
            success: true,
            message: 'Authentication service is healthy',
            timestamp: new Date().toISOString(),
            service: 'auth-api',
            version: '1.0.0',
            uptime: process.uptime()
        };
        
        return res.json(healthData);
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Auth health check failed:', {
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
        
        return res.status(500).json({
            success: false,
            message: 'Authentication service health check failed',
            timestamp: new Date().toISOString()
        });
    } finally {
        console.debug('Auth health check process completed');
    }
});



// Comprehensive error handling middleware for authentication routes

/**
 * Error handling middleware for auth routes
 * Handles different error types with appropriate HTTP status codes
 * 
 * @param {Error} error - Error object
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>} Sends error response or calls next
 */
router.use((error, req, res, next) => {
    try {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const requestInfo = {
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        };
        
        console.error('Auth route error:', {
            error: errorMessage,
            request: requestInfo
        });
        
        // Handle specific error types with appropriate status codes
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Request validation failed',
                error: errorMessage
            });
        }
        
        if (error.name === 'UnauthorizedError') {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        if (error.name === 'ForbiddenError') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        // Generic server error with minimal information exposure
        return res.status(500).json({
            success: false,
            message: 'Internal server error occurred'
        });
        
    } catch (handlerError) {
        const handlerErrorMessage = handlerError instanceof Error ? handlerError.message : String(handlerError);
        console.error('Auth error handler failed:', {
            originalError: error instanceof Error ? error.message : String(error),
            handlerError: handlerErrorMessage,
            timestamp: new Date().toISOString()
        });
        
        return res.status(500).json({
            success: false,
            message: 'Critical system error'
        });
    } finally {
        console.debug('Auth error handling process completed');
    }
});



// Export configured authentication router
module.exports = router;