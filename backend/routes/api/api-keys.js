/**
 * API Keys routes
 * Defines endpoints for API key management
 */

const express = require('express');


// Import API key route handlers
const { handleCreateApiKey } = require('../../functions/route_fns/api-keys/create');
const { handleListApiKeys } = require('../../functions/route_fns/api-keys/list');
const { handleRevokeApiKey } = require('../../functions/route_fns/api-keys/revoke');


// Import authentication middleware
const { allowAll } = require('../../functions/middleware/simpleAuth');


// Create Express router instance
const router = express.Router();


// All API key routes allow all access (simple auth - single user)
router.use(allowAll);


/**
 * POST /api/api-keys/create
 * Create a new API key for the authenticated user
 */
router.post('/create',
    /** @type {import('express').RequestHandler} */ (handleCreateApiKey)
);


/**
 * GET /api/api-keys
 * List all API keys for the authenticated user
 */
router.get('/',
    /** @type {import('express').RequestHandler} */ (handleListApiKeys)
);


/**
 * DELETE /api/api-keys/:id/revoke
 * Revoke a specific API key
 */
router.delete('/:id/revoke',
    /** @type {import('express').RequestHandler} */ (handleRevokeApiKey)
);


// Export configured API keys router
module.exports = router;
