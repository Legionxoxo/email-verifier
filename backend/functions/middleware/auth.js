/**
 * Authentication middleware for protected routes
 * Validates JWT tokens and sets user context
 */

const { verifyAccessToken } = require('../utils/jwt');
const { getDatabase } = require('../../database/connection');


/**
 * Middleware to verify JWT access token
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : null;
        
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Access token is required'
            });
            return;
        }
        
        // Verify the token
        const decoded = verifyAccessToken(token);
        
        // Add user information to request object
        req.user = {
            id: decoded.userId,
            userId: decoded.userId,
            email: decoded.email
        };
        
        next();
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Token authentication failed:', errorMessage);
        
        // Only set X-Clear-Auth header for specific token failures that indicate user deletion
        // Don't set it for routine expiry or validation errors
        const isUserDeletionError = errorMessage.includes('user not found') || 
                                    errorMessage.includes('user deleted') ||
                                    errorMessage.includes('account inactive');
        
        if (isUserDeletionError) {
            res.setHeader('X-Clear-Auth', 'true');
        }
        
        if (errorMessage.includes('expired')) {
            res.status(401).json({
                success: false,
                message: 'Access token has expired'
            });
            return;
        }
        
        if (errorMessage.includes('invalid') || 
            errorMessage.includes('malformed') ||
            errorMessage.includes('signature') ||
            errorMessage.includes('JsonWebTokenError')) {
            res.status(401).json({
                success: false,
                message: 'Invalid access token'
            });
            return;
        }
        
        res.status(401).json({
            success: false,
            message: 'Token verification failed'
        });
        return;
        
    } finally {
        console.debug('Token authentication process completed');
    }
}


/**
 * Middleware to verify user exists and is active
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
function verifyUserExists(req, res, next) {
    try {
        if (!req.user || !req.user.userId) {
            res.status(401).json({
                success: false,
                message: 'User authentication required'
            });
            return;
        }
        
        const db = getDatabase();
        const user = /** @type {import('../utils/jwt').UserRecord | undefined} */ (db.prepare(`
            SELECT id, email, first_name, last_name, is_verified, created_at
            FROM users 
            WHERE id = ? AND email = ?
        `).get(req.user.userId, req.user.email));
        
        if (!user) {
            // User not found in database - likely deleted
            // Tell frontend to clear authentication data
            res.setHeader('X-Clear-Auth', 'true');
            
            res.status(401).json({
                success: false,
                message: 'User not found or inactive'
            });
            return;
        }
        
        // Add full user data to request
        req.user = {
            ...req.user,
            firstName: user.first_name,
            lastName: user.last_name,
            isVerified: Boolean(user.is_verified),
            createdAt: user.created_at
        };
        
        next();
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('User verification failed:', errorMessage);
        
        res.status(500).json({
            success: false,
            message: 'User verification error'
        });
        return;
        
    } finally {
        console.debug('User verification process completed');
    }
}


/**
 * Middleware to require verified email
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
function requireVerifiedEmail(req, res, next) {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'User authentication required'
            });
            return;
        }
        
        if (!req.user.isVerified) {
            res.status(403).json({
                success: false,
                message: 'Email verification required to access this resource'
            });
            return;
        }
        
        next();
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Email verification check failed:', errorMessage);
        
        res.status(500).json({
            success: false,
            message: 'Verification check error'
        });
        return;
        
    } finally {
        console.debug('Email verification check process completed');
    }
}


/**
 * Optional authentication middleware (doesn't fail if no token)
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : null;
        
        if (!token) {
            req.user = null;
            return next();
        }
        
        try {
            const decoded = verifyAccessToken(token);
            req.user = {
                id: decoded.userId,
                userId: decoded.userId,
                email: decoded.email
            };
        } catch (tokenError) {
            // Token is invalid, but we continue without authentication
            req.user = null;
        }
        
        next();
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Optional authentication failed:', errorMessage);
        
        // Continue without authentication on error
        req.user = null;
        next();
        
    } finally {
        console.debug('Optional authentication process completed');
    }
}


/**
 * Combined authentication middleware (token + user verification)
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
function authenticate(req, res, next) {
    try {
        authenticateToken(req, res, (tokenError) => {
            if (tokenError) return;
            
            verifyUserExists(req, res, (userError) => {
                if (userError) return;
                next();
            });
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Combined authentication failed:', errorMessage);
        
        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
        return;
        
    } finally {
        console.debug('Combined authentication process completed');
    }
}


/**
 * Full authentication with email verification requirement
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
function authenticateVerified(req, res, next) {
    try {
        authenticate(req, res, (authError) => {
            if (authError) return;
            
            requireVerifiedEmail(req, res, next);
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Verified authentication failed:', errorMessage);
        
        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
        return;
        
    } finally {
        console.debug('Verified authentication process completed');
    }
}


// Export middleware functions
module.exports = {
    authenticateToken,
    verifyUserExists,
    requireVerifiedEmail,
    optionalAuth,
    authenticate,
    authenticateVerified
};