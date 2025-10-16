/**
 * Plan Configuration Validation Utility
 * Validates that all required Razorpay plan IDs are configured in the config file before server startup
 * @fileoverview Server startup validation for config-based subscription plan configuration
 */

const { SUBSCRIPTION_PLANS } = require('../../data/subscription-plans');


/**
 * Validate that all required Razorpay plan IDs are configured in the config file
 * Checks paid plans (pro, plus) for both monthly and yearly billing cycles
 * Free plan doesn't require Razorpay plan IDs since it's free
 * @returns {void}
 * @throws {Error} If any required plan IDs are missing from configuration
 */
function validatePlanConfiguration() {
    try {
        const missingPlanIds = [];
        
        // Get all plans that require Razorpay configuration (exclude free plan)
        const paidPlans = Object.entries(SUBSCRIPTION_PLANS)
            .filter(([planCode, plan]) => planCode !== 'free' && plan.is_active);
        
        if (paidPlans.length === 0) {
            console.log('✅ No paid plans configured - validation passed');
            return;
        }
        
        // Check each paid plan for required Razorpay plan IDs
        for (const [planCode, plan] of paidPlans) {
            try {
                // Check monthly plan ID
                if (!plan.razorpay_plan_id_monthly || plan.razorpay_plan_id_monthly === null || plan.razorpay_plan_id_monthly.trim() === '') {
                    missingPlanIds.push({
                        plan: plan.name,
                        planCode: planCode,
                        billing: 'monthly',
                        field: 'razorpay_plan_id_monthly'
                    });
                }
                
                // Check yearly plan ID
                if (!plan.razorpay_plan_id_yearly || plan.razorpay_plan_id_yearly === null || plan.razorpay_plan_id_yearly.trim() === '') {
                    missingPlanIds.push({
                        plan: plan.name,
                        planCode: planCode,
                        billing: 'yearly',
                        field: 'razorpay_plan_id_yearly'
                    });
                }
                
            } catch (planError) {
                const planErrorMessage = planError instanceof Error ? planError.message : String(planError);
                console.error(`Error validating plan ${planCode}:`, planErrorMessage);
                throw new Error(`Plan validation failed for ${planCode}: ${planErrorMessage}`);
            }
        }
        
        // If any plan IDs are missing, throw descriptive error
        if (missingPlanIds.length > 0) {
            console.error('\n❌ STARTUP ERROR: Missing Razorpay Plan Configuration');
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            // Log each missing plan ID with clear details
            missingPlanIds.forEach(missing => {
                const capitalizedBilling = missing.billing.charAt(0).toUpperCase() + missing.billing.slice(1);
                console.error(`❌ STARTUP ERROR: Missing Razorpay plan ID for ${missing.plan} plan (${missing.billing} billing)`);
                console.error(`   Field: ${missing.field} in data/subscription-plans.js`);
            });
            
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('📋 Please configure the missing plan IDs in data/subscription-plans.js configuration file');
            console.error('💡 Get your Razorpay plan IDs from your Razorpay Dashboard > Payment Links > Plans');
            console.error('🔗 https://dashboard.razorpay.com/app/payment-links');
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            // Create comprehensive error message
            const errorDetails = missingPlanIds.map(missing => 
                `${missing.plan} plan (${missing.billing} billing)`
            ).join(', ');
            
            throw new Error(`Missing Razorpay plan IDs for: ${errorDetails}. Please configure all required plan IDs in data/subscription-plans.js configuration file before starting the server.`);
        }
        
        // All validations passed
        console.log(`✅ Plan configuration validation passed - all ${paidPlans.length} paid plan(s) have required Razorpay IDs configured`);
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // If this is a validation error we threw, re-throw it as-is
        if (errorMessage.includes('Missing Razorpay plan IDs')) {
            throw error;
        }
        
        // For unexpected errors, wrap them
        console.error('Plan configuration validation failed:', errorMessage);
        throw new Error(`Plan configuration validation failed: ${errorMessage}`);
    } finally {
        console.debug('Plan configuration validation process completed');
    }
}


/**
 * Get detailed validation status for diagnostic purposes
 * @returns {Object} Validation status with plan details
 */
function getPlanValidationStatus() {
    try {
        const validationStatus = {
            isValid: true,
            totalPlans: 0,
            paidPlans: 0,
            configuredPlans: 0,
            missingConfigurations: [],
            planDetails: {}
        };
        
        const allPlans = Object.entries(SUBSCRIPTION_PLANS);
        validationStatus.totalPlans = allPlans.length;
        
        for (const [planCode, plan] of allPlans) {
            const planDetail = {
                name: plan.name,
                isFree: planCode === 'free',
                isActive: plan.is_active,
                monthlyConfigured: false,
                yearlyConfigured: false
            };
            
            if (planCode !== 'free' && plan.is_active) {
                validationStatus.paidPlans++;
                
                // Check monthly configuration
                if (plan.razorpay_plan_id_monthly && plan.razorpay_plan_id_monthly !== null && plan.razorpay_plan_id_monthly.trim() !== '') {
                    planDetail.monthlyConfigured = true;
                }
                
                // Check yearly configuration
                if (plan.razorpay_plan_id_yearly && plan.razorpay_plan_id_yearly !== null && plan.razorpay_plan_id_yearly.trim() !== '') {
                    planDetail.yearlyConfigured = true;
                }
                
                // Count as configured if both monthly and yearly are set
                if (planDetail.monthlyConfigured && planDetail.yearlyConfigured) {
                    validationStatus.configuredPlans++;
                } else {
                    validationStatus.isValid = false;
                    if (!planDetail.monthlyConfigured) {
                        validationStatus.missingConfigurations.push(`${plan.name} (monthly)`);
                    }
                    if (!planDetail.yearlyConfigured) {
                        validationStatus.missingConfigurations.push(`${plan.name} (yearly)`);
                    }
                }
            }
            
            validationStatus.planDetails[planCode] = planDetail;
        }
        
        return validationStatus;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to get plan validation status:', errorMessage);
        throw error;
    } finally {
        console.debug('Plan validation status check completed');
    }
}


module.exports = {
    validatePlanConfiguration,
    getPlanValidationStatus
};