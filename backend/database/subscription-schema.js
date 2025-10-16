/**
 * Subscription system database schema
 * Implements three-tier subscription model (Free, Pro, Plus) with payment tracking
 * Payment-system-only implementation - no feature enforcement logic
 */


/**
 * Create subscription-related database tables
 * @param {import('better-sqlite3').Database} db - SQLite database instance
 * @returns {void}
 */
function createSubscriptionTables(db) {
    try {
        // Enable performance optimizations
        db.pragma('cache_size = 10000');
        db.pragma('temp_store = memory');
        
        // Note: subscription_plans table removed - using config-file-only approach
        
        // User Subscriptions Table - now uses plan_code instead of plan_id foreign key
        const createUserSubscriptionsTable = db.prepare(`
            CREATE TABLE IF NOT EXISTS user_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan_code TEXT NOT NULL CHECK (plan_code IN ('free', 'pro', 'plus')),
                razorpay_subscription_id TEXT UNIQUE,
                razorpay_customer_id TEXT,
                status TEXT NOT NULL CHECK (status IN ('created', 'authenticated', 'active', 'past_due', 'cancelled', 'completed', 'paused', 'halted', 'upgraded', 'replaced')),
                billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')) DEFAULT 'monthly',
                current_period_start DATETIME NOT NULL,
                current_period_end DATETIME NOT NULL,
                trial_start DATETIME,
                trial_end DATETIME,
                cancel_at_period_end BOOLEAN DEFAULT 0,
                cancelled_at DATETIME NULL,
                cancellation_reason TEXT,
                cancellation_feedback TEXT,
                pause_count INTEGER DEFAULT 0,
                paused_at DATETIME NULL,
                resume_at DATETIME NULL,
                next_billing_date DATETIME,
                proration_amount INTEGER DEFAULT 0,
                discount_amount INTEGER DEFAULT 0,
                tax_amount INTEGER DEFAULT 0,
                total_amount INTEGER NOT NULL,
                auto_renewal BOOLEAN DEFAULT 1,
                grace_period_days INTEGER DEFAULT 3,
                failed_payment_count INTEGER DEFAULT 0,
                last_payment_attempt DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                
                CHECK (current_period_end > current_period_start),
                CHECK (trial_end IS NULL OR trial_end > trial_start),
                CHECK (total_amount >= 0),
                CHECK (pause_count >= 0),
                CHECK (failed_payment_count >= 0)
            )
        `);
        
        // Subscription Transactions Table
        const createSubscriptionTransactionsTable = db.prepare(`
            CREATE TABLE IF NOT EXISTS subscription_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                subscription_id INTEGER,
                razorpay_payment_id TEXT UNIQUE,
                razorpay_order_id TEXT,
                transaction_type TEXT NOT NULL CHECK (transaction_type IN ('subscription', 'addon', 'refund', 'adjustment', 'fee')) DEFAULT 'subscription',
                amount INTEGER NOT NULL,
                tax_amount INTEGER DEFAULT 0,
                discount_amount INTEGER DEFAULT 0,
                fee_amount INTEGER DEFAULT 0,
                net_amount INTEGER NOT NULL,
                currency TEXT DEFAULT 'INR',
                exchange_rate REAL DEFAULT 1.0,
                status TEXT NOT NULL CHECK (status IN ('created', 'authorized', 'captured', 'refunded', 'failed', 'cancelled')),
                gateway_status TEXT,
                method TEXT,
                method_details_json TEXT,
                description TEXT,
                receipt_number TEXT UNIQUE,
                invoice_id TEXT,
                failure_reason TEXT,
                failure_code TEXT,
                gateway_response_json TEXT,
                retry_count INTEGER DEFAULT 0,
                parent_transaction_id INTEGER,
                processed_at DATETIME,
                settled_at DATETIME,
                refunded_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (subscription_id) REFERENCES user_subscriptions (id),
                FOREIGN KEY (parent_transaction_id) REFERENCES subscription_transactions (id),
                
                CHECK (amount >= 0 OR transaction_type = 'refund'),
                CHECK (net_amount >= 0 OR transaction_type = 'refund'),
                CHECK (retry_count >= 0),
                CHECK (exchange_rate > 0)
            )
        `);
        
        // Account Credits Table
        const createAccountCreditsTable = db.prepare(`
            CREATE TABLE IF NOT EXISTS account_credits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                subscription_id INTEGER,
                credit_amount INTEGER NOT NULL,
                remaining_amount INTEGER NOT NULL,
                credit_type TEXT NOT NULL CHECK (credit_type IN ('downgrade', 'refund', 'adjustment', 'promotional')),
                source_transaction_id INTEGER,
                description TEXT,
                expires_at DATETIME,
                is_active BOOLEAN DEFAULT 1,
                applied_count INTEGER DEFAULT 0,
                last_applied_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (subscription_id) REFERENCES user_subscriptions (id),
                FOREIGN KEY (source_transaction_id) REFERENCES subscription_transactions (id),
                
                CHECK (credit_amount > 0),
                CHECK (remaining_amount >= 0),
                CHECK (remaining_amount <= credit_amount),
                CHECK (applied_count >= 0)
            )
        `);
        
        // Execute table creation
        createUserSubscriptionsTable.run();
        createSubscriptionTransactionsTable.run();
        createAccountCreditsTable.run();
        
        console.log('Subscription tables created successfully');
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Subscription table creation failed:', errorMessage);
        throw error;
    } finally {
        console.debug('Subscription table creation process completed');
    }
}


/**
 * Create performance indexes for subscription tables
 * @param {import('better-sqlite3').Database} db - SQLite database instance
 * @returns {void}
 */
function createSubscriptionIndexes(db) {
    try {
        // Note: subscription_plans indexes removed - using config-file-only approach
        
        // Check if user_subscriptions table exists and get its column information
        const checkTable = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='user_subscriptions'
        `);
        const tableExists = checkTable.get();
        
        if (!tableExists) {
            console.log('📝 user_subscriptions table does not exist, skipping indexes');
            return;
        }
        
        // Check what columns exist in user_subscriptions table
        const checkColumns = db.prepare("PRAGMA table_info(user_subscriptions)");
        const columns = /** @type {Array<{name: string}>} */ (checkColumns.all());
        const columnNames = columns.map(col => col.name);
        
        console.log('🔍 user_subscriptions table columns:', columnNames);
        
        // Base indexes that should always exist
        const baseIndexes = [
            'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions (user_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions (status)',
            'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active_user ON user_subscriptions (user_id, status) WHERE status = \'active\'',
            'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_billing_date ON user_subscriptions (next_billing_date) WHERE status = \'active\'',
            'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_razorpay_id ON user_subscriptions (razorpay_subscription_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_razorpay_customer_id ON user_subscriptions (razorpay_customer_id)'
        ];
        
        // Conditional indexes based on available columns
        const conditionalIndexes = [];
        
        // Only create plan_code index if plan_code column exists
        if (columnNames.includes('plan_code')) {
            conditionalIndexes.push('CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_code ON user_subscriptions (plan_code)');
            console.log('✅ Will create plan_code index');
        } else {
            console.log('⚠️ plan_code column not found, skipping plan_code index');
        }
        
        // Only create plan_id index if plan_id column exists (for backwards compatibility)
        if (columnNames.includes('plan_id')) {
            conditionalIndexes.push('CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON user_subscriptions (plan_id)');
            console.log('⚠️ Found legacy plan_id column, creating index for backwards compatibility');
        }
        
        // Subscription Transactions indexes
        const transactionIndexes = [
            'CREATE INDEX IF NOT EXISTS idx_subscription_transactions_user_id ON subscription_transactions (user_id)',
            'CREATE INDEX IF NOT EXISTS idx_subscription_transactions_status ON subscription_transactions (status)',
            'CREATE INDEX IF NOT EXISTS idx_subscription_transactions_user_date ON subscription_transactions (user_id, created_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_subscription_transactions_subscription ON subscription_transactions (subscription_id)',
            'CREATE INDEX IF NOT EXISTS idx_subscription_transactions_razorpay_id ON subscription_transactions (razorpay_payment_id)',
            'CREATE INDEX IF NOT EXISTS idx_subscription_transactions_type ON subscription_transactions (transaction_type, created_at DESC)'
        ];
        
        // Account Credits indexes
        const creditIndexes = [
            'CREATE INDEX IF NOT EXISTS idx_account_credits_user_id ON account_credits (user_id)',
            'CREATE INDEX IF NOT EXISTS idx_account_credits_active ON account_credits (user_id, is_active) WHERE is_active = 1',
            'CREATE INDEX IF NOT EXISTS idx_account_credits_subscription ON account_credits (subscription_id)',
            'CREATE INDEX IF NOT EXISTS idx_account_credits_expires ON account_credits (expires_at) WHERE is_active = 1 AND expires_at IS NOT NULL'
        ];
        
        // Execute index creation with error handling for each index
        const allIndexes = [
            ...baseIndexes,
            ...conditionalIndexes,
            ...transactionIndexes,
            ...creditIndexes
        ];
        
        let successCount = 0;
        let errorCount = 0;
        
        allIndexes.forEach((indexSql, index) => {
            try {
                db.prepare(indexSql).run();
                successCount++;
            } catch (indexError) {
                errorCount++;
                const errorMessage = indexError instanceof Error ? indexError.message : String(indexError);
                console.warn(`⚠️ Failed to create index ${index + 1}: ${errorMessage}`);
                console.warn(`   SQL: ${indexSql}`);
                
                // Don't throw error for index creation failures - they're not critical
                // The application can work without indexes, just with reduced performance
            } finally {
                // Continue with next index
            }
        });
        
        console.log(`✅ Subscription indexes creation completed: ${successCount} created, ${errorCount} failed`);
        
        if (errorCount > 0) {
            console.warn(`⚠️ Some indexes failed to create - application will work but performance may be reduced`);
        }
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Subscription index creation failed:', errorMessage);
        // Don't throw error - index creation failures shouldn't stop the application
        console.warn('⚠️ Continuing without some indexes - performance may be reduced');
    } finally {
        console.debug('Subscription index creation process completed');
    }
}


/**
 * Note: insertDefaultPlans function removed - using config-file-only approach
 * Plan data is now managed in backend/data/razorpay-plans.js configuration file
 */


/**
 * Initialize complete subscription schema
 * @param {import('better-sqlite3').Database} db - SQLite database instance
 * @returns {void}
 */
function initializeSubscriptionSchema(db) {
    try {
        createSubscriptionTables(db);
        createSubscriptionIndexes(db);
        
        console.log('Subscription schema initialized successfully (config-file-only approach)');
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Subscription schema initialization failed:', errorMessage);
        throw error;
    } finally {
        console.debug('Subscription schema initialization process completed');
    }
}


// Export functions
module.exports = {
    createSubscriptionTables,
    createSubscriptionIndexes,
    initializeSubscriptionSchema
};