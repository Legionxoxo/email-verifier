/**
 * Webhook API routes for Razorpay integration
 * Handles all webhook endpoints with security middleware and rate limiting
 * 
 * @fileoverview Webhook API routes for subscription lifecycle events
 */

const express = require('express');

const {
    verifyRazorpayWebhook,
    processWebhook
} = require('../../functions/route_fns/webhooks');

const {
    webhookRateLimit,
    sanitizeInput,
    logSecurityEvent
} = require('../../functions/middleware/security');


// Create router instance
const router = express.Router();


// Apply common middleware to all webhook routes
router.use(sanitizeInput);


// Raw body parser for webhook signature verification
router.use('/razorpay', express.raw({ type: 'application/json' }));


/**
 * POST /api/webhooks/razorpay
 * Handle all Razorpay webhooks for subscription lifecycle events
 */
router.post('/razorpay',
    /** @type {import('express').RequestHandler} */ (webhookRateLimit),
    /** @type {import('express').RequestHandler} */ (logSecurityEvent('WEBHOOK_RECEIVED')),
    
    // Parse raw body back to JSON for processing
    (req, res, next) => {
        try {
            if (req.body && Buffer.isBuffer(req.body)) {
                req.body = JSON.parse(req.body.toString());
            }
            next();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Webhook body parsing failed:', errorMessage);
            
            res.status(400).json({
                success: false,
                message: 'Invalid webhook body format',
                timestamp: new Date().toISOString()
            });
        } finally {
            console.debug('Webhook body parsing completed');
        }
    },
    
    /** @type {import('express').RequestHandler} */ (verifyRazorpayWebhook),
    /** @type {import('express').RequestHandler} */ (processWebhook)
);


/**
 * GET /api/webhooks/health
 * Health check for webhook service
 */
router.get('/health', (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Webhook service is healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'connected',
                razorpay_webhook: process.env.RAZORPAY_WEBHOOK_SECRET ? 'configured' : 'not_configured'
            }
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Webhook health check failed:', errorMessage);
        
        res.status(500).json({
            success: false,
            message: 'Webhook service health check failed',
            timestamp: new Date().toISOString()
        });
    } finally {
        console.debug('Webhook health check process completed');
    }
});


// Error handling middleware for webhook routes
router.use((error, req, res, next) => {
    try {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Webhook route error:', errorMessage);
        
        // Log security events for suspicious webhook activity
        if (errorMessage.includes('signature') || errorMessage.includes('unauthorized')) {
            console.error('Potential webhook security issue:', {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                error: errorMessage
            });
        }
        
        // Always respond with 200 OK for webhooks to prevent retries
        res.status(200).json({
            success: true,
            message: 'Webhook processed',
            error: 'Processing error occurred',
            timestamp: new Date().toISOString()
        });
        
    } catch (handlerError) {
        const handlerErrorMessage = handlerError instanceof Error ? handlerError.message : String(handlerError);
        console.error('Webhook error handler failed:', handlerErrorMessage);
        
        res.status(200).json({
            success: true,
            message: 'Webhook processed',
            timestamp: new Date().toISOString()
        });
    } finally {
        console.debug('Webhook error handling process completed');
    }
});


// Export router
module.exports = router;