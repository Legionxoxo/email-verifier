/**
 * Settings API routes with comprehensive security middleware
 * Defines all settings endpoints with rate limiting, validation, and security logging
 * 
 * This module provides secure settings endpoints including:
 * - Password reset and change functionality
 * - Email change with verification flows
 * - Profile management and settings update
 * - Comprehensive error handling and security monitoring
 */

const express = require('express');

// Import settings route handlers
const {
    handleForgotPassword,
    handleResetPassword
} = require('../../functions/route_fns/settings/forgot-password');

const {
    handleChangeEmail,
    handleVerifyEmailChange
} = require('../../functions/route_fns/settings/change-email');

const {
    handleGetProfile,
    handleUpdateProfile
} = require('../../functions/route_fns/settings/profile');

// Import security middleware
const {
    authRateLimit,
    otpRateLimit,
    passwordResetRateLimit,
    validateEmail,
    validateOTP,
    validatePasswordReset,
    handleValidationErrors,
    sanitizeInput,
    logSecurityEvent
} = require('../../functions/middleware/security');

// Import authentication middleware
const { authenticate } = require('../../functions/middleware/auth');

// Import validation for settings-specific operations
const { body } = require('express-validator');


// Create Express router instance
const router = express.Router();


// Apply common security middleware to all settings routes
router.use(sanitizeInput);


// Settings validation rules

/**
 * Validation rules for password confirmation (sensitive operations)
 */
const validatePasswordConfirmation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required for sensitive operations')
];

/**
 * Validation rules for email change requests
 */
const validateEmailChange = [
    body('newEmail')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid new email address')
        .normalizeEmail()
        .isLength({ max: 255 })
        .withMessage('Email must be less than 255 characters'),
    
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required to change email')
];

/**
 * Validation rules for profile updates
 */
const validateProfileUpdate = [
    body('firstName')
        .optional()
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
        .withMessage('Last name can only contain letters and spaces')
];


// Password management routes

/**
 * POST /api/settings/forgot-password
 * Request password reset via email
 * 
 * Security features:
 * - Rate limiting to prevent spam
 * - Email validation and sanitization
 * - Security event logging
 * - OTP generation and email delivery
 */
router.post('/forgot-password',
    /** @type {import('express').RequestHandler} */ (passwordResetRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('SETTINGS_PASSWORD_RESET_REQUEST')),
    ...validateEmail,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleForgotPassword)
);


/**
 * POST /api/settings/reset-password
 * Complete password reset with OTP + new password
 * 
 * Security features:
 * - OTP validation with attempt limits
 * - Strong password requirements
 * - Automatic invalidation of all user sessions
 * - Security event logging
 */
router.post('/reset-password',
    /** @type {import('express').RequestHandler} */ (authRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('SETTINGS_PASSWORD_RESET')),
    ...validatePasswordReset,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleResetPassword)
);


// Email management routes

/**
 * POST /api/settings/change-email
 * Request email change with current password
 * 
 * Security features:
 * - Authentication required
 * - Current password verification
 * - New email validation
 * - OTP generation for new email
 * - Rate limiting and security logging
 */
router.post('/change-email',
    authenticate,
    /** @type {import('express').RequestHandler} */ (authRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('SETTINGS_EMAIL_CHANGE_REQUEST')),
    ...validateEmailChange,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleChangeEmail)
);


/**
 * POST /api/settings/verify-email-change
 * Verify new email with OTP
 * 
 * Security features:
 * - Authentication required
 * - OTP validation with expiry
 * - Transaction-based email update
 * - Automatic session refresh
 * - Security event logging
 */
router.post('/verify-email-change',
    authenticate,
    /** @type {import('express').RequestHandler} */ (authRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('SETTINGS_EMAIL_CHANGE_VERIFICATION')),
    ...validateOTP,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleVerifyEmailChange)
);


// Profile management routes

/**
 * GET /api/settings/profile
 * Get current user profile settings
 * 
 * Security features:
 * - Authentication required
 * - User data verification
 * - Security event logging
 */
router.get('/profile',
    authenticate,
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('SETTINGS_PROFILE_ACCESS')),
    /** @type {import('express').RequestHandler} */ (handleGetProfile)
);


/**
 * PUT /api/settings/profile
 * Update user profile information
 * 
 * Security features:
 * - Authentication required
 * - Input validation and sanitization
 * - Profile update logging
 * - Rate limiting to prevent abuse
 */
router.put('/profile',
    authenticate,
    /** @type {import('express').RequestHandler} */ (authRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('SETTINGS_PROFILE_UPDATE')),
    ...validateProfileUpdate,
    /** @type {import('express').RequestHandler} */ (handleValidationErrors),
    /** @type {import('express').RequestHandler} */ (handleUpdateProfile)
);


// Service health and monitoring endpoints

/**
 * GET /api/settings/health
 * Health check endpoint for settings service monitoring
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends health status JSON response
 */
router.get('/health', (req, res) => {
    try {
        const healthData = {
            success: true,
            message: 'Settings service is healthy',
            timestamp: new Date().toISOString(),
            service: 'settings-api',
            version: '1.0.0',
            uptime: process.uptime()
        };
        
        return res.json(healthData);
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Settings health check failed:', {
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
        
        return res.status(500).json({
            success: false,
            message: 'Settings service health check failed',
            timestamp: new Date().toISOString()
        });
    } finally {
        console.debug('Settings health check process completed');
    }
});


// Comprehensive error handling middleware for settings routes

/**
 * Error handling middleware for settings routes
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
        
        console.error('Settings route error:', {
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
        
        if (error.name === 'ConflictError') {
            return res.status(409).json({
                success: false,
                message: 'Resource conflict occurred',
                error: errorMessage
            });
        }
        
        // Generic server error with minimal information exposure
        return res.status(500).json({
            success: false,
            message: 'Internal server error occurred'
        });
        
    } catch (handlerError) {
        const handlerErrorMessage = handlerError instanceof Error ? handlerError.message : String(handlerError);
        console.error('Settings error handler failed:', {
            originalError: error instanceof Error ? error.message : String(error),
            handlerError: handlerErrorMessage,
            timestamp: new Date().toISOString()
        });
        
        return res.status(500).json({
            success: false,
            message: 'Critical system error'
        });
    } finally {
        console.debug('Settings error handling process completed');
    }
});


// Export configured settings router
module.exports = router;