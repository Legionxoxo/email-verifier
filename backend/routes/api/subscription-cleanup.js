/**
 * Subscription cleanup routes
 * Handles subscription timeout and cleanup operations
 */

const express = require('express');
const { runSubscriptionCleanup, expireUnpaidSubscriptions } = require('../../functions/utils/subscription-cleanup');
const { authenticateToken } = require('../../functions/middleware/auth');

const router = express.Router();

/**
 * Manual cleanup trigger (admin only)
 * POST /api/subscription-cleanup/run
 */
router.post('/run', authenticateToken, async (req, res) => {
    try {
        // In a production environment, you might want to add admin role check here
        // For now, any authenticated user can trigger cleanup (mainly for testing)
        
        console.log(`Subscription cleanup triggered by user ${req.user?.id}`);
        
        const result = await runSubscriptionCleanup();
        
        res.json({
            success: true,
            message: 'Subscription cleanup completed successfully',
            data: {
                expired: result.expired,
                cleaned: result.cleaned,
                errors: result.errors
            }
        });

    } catch (error) {
        console.error('Cleanup endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to run subscription cleanup',
            error: error.message
        });
    }
});

/**
 * Expire unpaid subscriptions only
 * POST /api/subscription-cleanup/expire-unpaid
 */
router.post('/expire-unpaid', authenticateToken, async (req, res) => {
    try {
        console.log(`Unpaid subscription expiry triggered by user ${req.user?.id}`);
        
        const result = await expireUnpaidSubscriptions();
        
        res.json({
            success: true,
            message: 'Unpaid subscriptions processed successfully',
            data: {
                expired: result.expired,
                errors: result.errors
            }
        });

    } catch (error) {
        console.error('Expire unpaid endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to expire unpaid subscriptions',
            error: error.message
        });
    }
});

/**
 * Health check for cleanup service
 * GET /api/subscription-cleanup/health
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Subscription cleanup service is healthy',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;