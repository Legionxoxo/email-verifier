/**
 * Simple authentication routes
 * Single admin user with credentials in .env file
 * No JWT, no database, no persistence
 */

const express = require('express');
const router = express.Router();

// Import simple auth middleware and handler
const { verifyAdminCredentials } = require('../../functions/middleware/simpleAuth');
const { handleSimpleLogin } = require('../../functions/route_fns/simpleAuth/login');


/**
 * POST /api/auth/login
 * Simple login with email and password
 * Verifies against ADMIN_EMAIL and ADMIN_PASSWORD from .env
 */
router.post('/login', verifyAdminCredentials, handleSimpleLogin);


/**
 * GET /api/auth/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Auth service is healthy',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            success: false,
            message: 'Health check failed'
        });
    }
});


module.exports = router;
