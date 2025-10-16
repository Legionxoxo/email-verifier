/**
 * Subscription cleanup utilities
 * Handles automatic expiration of unpaid subscriptions and general cleanup tasks
 */

/**
 * @typedef {Object} ExpiredSubscription
 * @property {number} id - Subscription ID
 * @property {number} user_id - User ID
 * @property {string} plan_code - Plan code
 * @property {string} razorpay_subscription_id - Razorpay subscription ID
 * @property {number} total_amount - Total amount in paise
 * @property {string} created_at - Creation timestamp
 * @property {string} plan_name - Plan name
 */

const { getDb } = require('../../database/connection');

/**
 * Configuration for subscription cleanup
 */
const SUBSCRIPTION_TIMEOUT_MINUTES = 20; // 20 minutes timeout for created subscriptions
const CLEANUP_BATCH_SIZE = 100; // Process subscriptions in batches

/**
 * Expire unpaid subscriptions that have been in 'created' status for more than 20 minutes
 * @returns {Promise<{expired: number, errors: string[]}>} Cleanup result
 */
async function expireUnpaidSubscriptions() {
    try {
        console.log('🧹 Starting cleanup of expired unpaid subscriptions...');
        
        const db = getDb();
        const errors = [];
        let totalExpired = 0;

        // Find subscriptions that are 'created' for more than 20 minutes
        // Only target paid subscriptions (amount > 0) that haven't been activated
        const findExpiredSubscriptions = db.prepare(`
            SELECT 
                us.id,
                us.user_id,
                us.plan_code,
                us.razorpay_subscription_id,
                us.total_amount,
                us.created_at,
                us.plan_code as plan_name
            FROM user_subscriptions us
            WHERE us.status = 'created'
            AND us.total_amount > 0
            AND datetime(us.created_at, '+${SUBSCRIPTION_TIMEOUT_MINUTES} minutes') < datetime('now')
            ORDER BY us.created_at ASC
            LIMIT ${CLEANUP_BATCH_SIZE}
        `);

        const expiredSubscriptions = /** @type {ExpiredSubscription[]} */ (findExpiredSubscriptions.all());
        
        console.log(`Found ${expiredSubscriptions.length} expired subscriptions to process`);

        if (expiredSubscriptions.length === 0) {
            console.log('✅ No expired subscriptions found');
            return { expired: 0, errors: [] };
        }

        // Process each expired subscription
        for (const subscription of expiredSubscriptions) {
            try {
                console.log(`Processing expired subscription ID: ${subscription.id} (User: ${subscription.user_id}, Plan: ${subscription.plan_code})`);
                
                // Mark subscription as expired in database
                const expireTransaction = db.transaction(() => {
                    // Update subscription status
                    const updateSubscription = db.prepare(`
                        UPDATE user_subscriptions 
                        SET 
                            status = 'expired',
                            cancelled_at = CURRENT_TIMESTAMP,
                            cancellation_reason = 'payment_timeout',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `);
                    updateSubscription.run(subscription.id);

                    // Record expiration transaction for audit trail
                    const insertTransaction = db.prepare(`
                        INSERT INTO subscription_transactions (
                            user_id, subscription_id, transaction_type, amount, net_amount,
                            status, method, description, method_details_json,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    `);

                    const transactionResult = insertTransaction.run(
                        subscription.user_id,
                        subscription.id,
                        'adjustment',
                        0, // No amount for expiration
                        0,
                        'expired',
                        'system_expiry',
                        `Subscription expired due to payment timeout (${SUBSCRIPTION_TIMEOUT_MINUTES} minutes)`,
                        JSON.stringify({
                            plan_code: subscription.plan_code,
                            plan_name: subscription.plan_name,
                            original_amount: subscription.total_amount,
                            timeout_minutes: SUBSCRIPTION_TIMEOUT_MINUTES,
                            razorpay_subscription_id: subscription.razorpay_subscription_id,
                            expiry_reason: 'payment_timeout'
                        })
                    );

                    return transactionResult.lastInsertRowid;
                });

                const transactionId = expireTransaction();
                totalExpired++;
                
                console.log(`✅ Successfully expired subscription ${subscription.id} (Transaction ID: ${transactionId})`);

            } catch (subscriptionError) {
                const errorMessage = `Failed to expire subscription ${subscription.id}: ${subscriptionError.message}`;
                console.error(`❌ ${errorMessage}`);
                errors.push(errorMessage);
            }
        }

        console.log(`🎯 Cleanup completed: ${totalExpired} subscriptions expired, ${errors.length} errors`);
        
        return {
            expired: totalExpired,
            errors: errors
        };

    } catch (error) {
        console.error('❌ Fatal error during subscription cleanup:', error);
        throw new Error(`Subscription cleanup failed: ${error.message}`);
    }
}

/**
 * Clean up old expired and replaced subscriptions to keep database tidy
 * Removes subscriptions that have been expired/replaced for more than 30 days
 * @returns {Promise<{cleaned: number}>} Cleanup result
 */
async function cleanupOldSubscriptions() {
    try {
        console.log('🧹 Starting cleanup of old expired/replaced subscriptions...');
        
        const db = getDb();
        
        // Clean up subscriptions that have been expired/replaced for more than 30 days
        const cleanupOld = db.prepare(`
            DELETE FROM user_subscriptions 
            WHERE status IN ('expired', 'replaced')
            AND datetime(cancelled_at, '+30 days') < datetime('now')
        `);

        const result = cleanupOld.run();
        
        console.log(`✅ Cleaned up ${result.changes} old subscriptions`);
        
        return { cleaned: result.changes };

    } catch (error) {
        console.error('❌ Error during old subscription cleanup:', error);
        throw new Error(`Old subscription cleanup failed: ${error.message}`);
    }
}

/**
 * Comprehensive subscription cleanup - runs all cleanup tasks
 * @returns {Promise<{expired: number, cleaned: number, errors: string[]}>} Complete cleanup result
 */
async function runSubscriptionCleanup() {
    try {
        console.log('🚀 Starting comprehensive subscription cleanup...');
        
        const expiredResult = await expireUnpaidSubscriptions();
        const cleanedResult = await cleanupOldSubscriptions();
        
        const result = {
            expired: expiredResult.expired,
            cleaned: cleanedResult.cleaned,
            errors: expiredResult.errors
        };
        
        console.log('🎉 Subscription cleanup completed:', result);
        
        return result;

    } catch (error) {
        console.error('❌ Comprehensive subscription cleanup failed:', error);
        throw error;
    }
}

module.exports = {
    expireUnpaidSubscriptions,
    cleanupOldSubscriptions,
    runSubscriptionCleanup,
    SUBSCRIPTION_TIMEOUT_MINUTES
};