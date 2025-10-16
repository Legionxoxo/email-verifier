/**
 * Database cleanup utilities for maintenance operations
 * Handles cleanup of stale data like unverified users, expired tokens, etc.
 * 
 * This module provides comprehensive database cleanup functionality:
 * - Removes unverified users after specified time periods
 * - Cleans up expired authentication tokens
 * - Provides comprehensive cleanup orchestration
 * - Includes detailed logging and error handling
 */

const { getDatabase } = require('../../database/connection');


// Cleanup configuration constants

const CLEANUP_CONFIG = {
    DEFAULT_UNVERIFIED_USER_HOURS: 24,
    LOG_EMOJI: {
        SUCCESS: '✅',
        CLEANING: '🧹',
        WARNING: '⚠️'
    }
};


/**
 * Clean up unverified users older than specified time period
 * Removes users who never verified their email and have no successful login attempts
 * 
 * @param {number} [olderThanHours=24] - Remove users unverified for more than this many hours
 * @returns {Promise<{success: boolean, deletedUsers: number, deletedTokens: number, message: string, error?: string}>} Cleanup result with counts and status
 * @throws {Error} If database operations fail critically
 */
async function cleanupUnverifiedUsers(olderThanHours = CLEANUP_CONFIG.DEFAULT_UNVERIFIED_USER_HOURS) {
    try {
        const db = getDatabase();
        
        // First, get count of users that will be deleted for logging
        const countQuery = db.prepare(`
            SELECT COUNT(*) as count
            FROM users 
            WHERE is_verified = 0 
            AND created_at < datetime('now', '-${olderThanHours} hours')
            AND id NOT IN (
                SELECT DISTINCT user_id 
                FROM auth_tokens 
                WHERE token_type = 'otp' 
                AND is_used = 1
                AND user_id IS NOT NULL
            )
        `);
        
        const countResult = /** @type {{count: number} | undefined} */ (countQuery.get());
        const beforeCount = countResult?.count || 0;
        
        if (beforeCount === 0) {
            console.log(`${CLEANUP_CONFIG.LOG_EMOJI.SUCCESS} No unverified users found for cleanup`);
            return {
                success: true,
                deletedUsers: 0,
                deletedTokens: 0,
                message: 'No unverified users require cleanup'
            };
        }
        
        // Delete associated auth tokens first (foreign key constraint)
        const deleteTokensQuery = db.prepare(`
            DELETE FROM auth_tokens 
            WHERE user_id IN (
                SELECT id FROM users 
                WHERE is_verified = 0 
                AND created_at < datetime('now', '-${olderThanHours} hours')
                AND id NOT IN (
                    SELECT DISTINCT user_id 
                    FROM auth_tokens 
                    WHERE token_type = 'otp' 
                    AND is_used = 1
                    AND user_id IS NOT NULL
                )
            )
        `);
        
        const tokensResult = deleteTokensQuery.run();
        const deletedTokens = tokensResult.changes || 0;
        
        // Now delete the unverified users
        const deleteUsersQuery = db.prepare(`
            DELETE FROM users 
            WHERE is_verified = 0 
            AND created_at < datetime('now', '-${olderThanHours} hours')
            AND id NOT IN (
                SELECT DISTINCT user_id 
                FROM auth_tokens 
                WHERE token_type = 'otp' 
                AND is_used = 1
                AND user_id IS NOT NULL
            )
        `);
        
        const usersResult = deleteUsersQuery.run();
        const deletedUsers = usersResult.changes || 0;
        
        console.log(`${CLEANUP_CONFIG.LOG_EMOJI.CLEANING} Cleanup completed successfully:`);
        console.log(`   - Deleted ${deletedUsers} unverified users older than ${olderThanHours} hours`);
        console.log(`   - Deleted ${deletedTokens} associated auth tokens`);
        console.log(`   - Total records cleaned: ${deletedUsers + deletedTokens}`);
        
        return {
            success: true,
            deletedUsers,
            deletedTokens,
            message: `Cleaned up ${deletedUsers} unverified users and ${deletedTokens} tokens`
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Cleanup of unverified users failed:', errorMessage);
        
        return {
            success: false,
            deletedUsers: 0,
            deletedTokens: 0,
            error: errorMessage,
            message: 'Cleanup failed'
        };
    } finally {
        console.debug('Unverified users cleanup process completed');
    }
}


/**
 * Clean up all expired authentication tokens
 * Removes tokens that have passed their expiry time across all token types
 * 
 * @returns {Promise<{success: boolean, deletedTokens: number, message: string, error?: string}>} Cleanup result with count and status
 * @throws {Error} If database operations fail critically
 */
async function cleanupExpiredTokens() {
    try {
        const db = getDatabase();
        
        // Delete expired tokens
        const deleteExpiredQuery = db.prepare(`
            DELETE FROM auth_tokens 
            WHERE expires_at < datetime('now')
        `);
        
        const result = deleteExpiredQuery.run();
        const deletedTokens = result.changes || 0;
        
        if (deletedTokens > 0) {
            console.log(`${CLEANUP_CONFIG.LOG_EMOJI.CLEANING} Cleaned up ${deletedTokens} expired auth tokens`);
        } else {
            console.log(`${CLEANUP_CONFIG.LOG_EMOJI.SUCCESS} No expired tokens found to clean up`);
        }
        
        return {
            success: true,
            deletedTokens,
            message: deletedTokens > 0 ? `Cleaned up ${deletedTokens} expired tokens` : 'No expired tokens found'
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Cleanup of expired tokens failed:', errorMessage);
        
        return {
            success: false,
            deletedTokens: 0,
            error: errorMessage,
            message: 'Token cleanup failed'
        };
    } finally {
        console.debug('Expired tokens cleanup process completed');
    }
}


/**
 * Run comprehensive database cleanup operation
 * Orchestrates all cleanup functions in parallel for efficiency
 * 
 * @param {Object} [options={}] - Cleanup configuration options
 * @param {number} [options.unverifiedUserHours=24] - Hours after which to remove unverified users
 * @returns {Promise<{success: boolean, results: Object, totalDeleted: number, message: string, summary?: Object, error?: string}>} Combined cleanup results with detailed breakdown
 * @throws {Error} If critical cleanup operations fail
 */
async function runDatabaseCleanup(options = {}) {
    try {
        const { unverifiedUserHours = CLEANUP_CONFIG.DEFAULT_UNVERIFIED_USER_HOURS } = options;
        
        console.log(`${CLEANUP_CONFIG.LOG_EMOJI.CLEANING} Starting comprehensive database cleanup...`);
        console.log(`   - Unverified user threshold: ${unverifiedUserHours} hours`);
        console.log(`   - Running cleanup tasks in parallel for efficiency`);
        
        // Run all cleanup tasks
        const [usersResult, tokensResult] = await Promise.all([
            cleanupUnverifiedUsers(unverifiedUserHours),
            cleanupExpiredTokens()
        ]);
        
        const totalDeleted = usersResult.deletedUsers + tokensResult.deletedTokens;
        
        console.log(`${CLEANUP_CONFIG.LOG_EMOJI.SUCCESS} Database cleanup completed successfully:`);
        console.log(`   - Total records removed: ${totalDeleted}`);
        console.log(`   - Unverified users cleaned: ${usersResult.deletedUsers}`);
        console.log(`   - Expired tokens cleaned: ${tokensResult.deletedTokens}`);
        
        return {
            success: true,
            results: {
                unverifiedUsers: usersResult,
                expiredTokens: tokensResult
            },
            totalDeleted,
            message: `Database cleanup completed successfully: ${totalDeleted} total records removed`,
            summary: {
                unverifiedUsersDeleted: usersResult.deletedUsers,
                expiredTokensDeleted: tokensResult.deletedTokens,
                totalRecordsDeleted: totalDeleted,
                cleanupDuration: new Date().toISOString()
            }
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Database cleanup failed:', errorMessage);
        
        return {
            success: false,
            results: null,
            totalDeleted: 0,
            error: errorMessage,
            message: 'Database cleanup failed'
        };
    } finally {
        console.debug('Database cleanup process completed');
    }
}



// Export all cleanup utility functions
module.exports = {
    // Individual cleanup operations
    cleanupUnverifiedUsers,
    cleanupExpiredTokens,
    
    // Orchestrated cleanup
    runDatabaseCleanup
};