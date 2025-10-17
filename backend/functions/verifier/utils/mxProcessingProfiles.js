/**
 * @typedef {Object} ProcessingConfig
 * @property {string} method - Verification method to use
 * @property {number} batchSize - Number of emails to process per batch
 * @property {number} parallelConnections - Number of parallel SMTP connections
 * @property {number} delayBetweenBatches - Delay in milliseconds between batches
 * @property {number} maxRetries - Maximum number of retry attempts
 * @property {number} timeout - Timeout in milliseconds for connections
 * @property {Object} rateLimit - Rate limiting configuration
 * @property {number} rateLimit.requestsPerSecond - Requests per second allowed
 * @property {number} rateLimit.burstLimit - Burst limit for requests
 * @property {string} groupBy - How to group requests (organization, mx_domain, domain)
 */

/**
 * MX Processing Profiles
 * Defines processing configurations for different MX organizations
 * Optimized for rate limiting and avoiding blacklisting
 */
class MXProcessingProfiles {
    constructor() {
        this.profiles = this.initializeProfiles();
    }

    /**
     * Helper method to safely get error message
     * @param {unknown} error - The error object
     * @returns {string}
     */
    getErrorMessage(error) {
        return error instanceof Error ? error.message : String(error);
    }

    /**
     * Initialize all processing profiles
     * @returns {Object} Processing profiles mapped by profile name
     */
    initializeProfiles() {
        return {
            // Google Workspace / Gmail - Aggressive but respectful
            'google_workspace_smtp': {
                method: 'smtp_verification',
                batchSize: 20,
                parallelConnections: 3,
                delayBetweenBatches: 500,
                maxRetries: 3,
                timeout: 12000,
                rateLimit: { requestsPerSecond: 5, burstLimit: 10 },
                groupBy: 'organization'
            },

            // Microsoft Exchange / Office 365 - Use login method
            'microsoft_exchange_smtp': {
                method: 'microsoft_login_verification',
                batchSize: 15,
                parallelConnections: 2,
                delayBetweenBatches: 1000,
                maxRetries: 2,
                timeout: 15000,
                rateLimit: { requestsPerSecond: 2, burstLimit: 5 },
                groupBy: 'organization'
            },

            // Yahoo Mail - Conservative approach
            'yahoo_smtp_alternate': {
                method: 'yahoo_alternate_verification',
                batchSize: 10,
                parallelConnections: 1,
                delayBetweenBatches: 2000,
                maxRetries: 2,
                timeout: 18000,
                rateLimit: { requestsPerSecond: 1, burstLimit: 2 },
                groupBy: 'organization'
            },

            // Apple iCloud - Conservative
            'apple_icloud_smtp': {
                method: 'smtp_verification',
                batchSize: 8,
                parallelConnections: 1,
                delayBetweenBatches: 1500,
                maxRetries: 2,
                timeout: 15000,
                rateLimit: { requestsPerSecond: 1.5, burstLimit: 3 },
                groupBy: 'organization'
            },

            // ProtonMail - Privacy-focused, conservative
            'protonmail_smtp': {
                method: 'smtp_verification',
                batchSize: 5,
                parallelConnections: 1,
                delayBetweenBatches: 3000,
                maxRetries: 2,
                timeout: 20000,
                rateLimit: { requestsPerSecond: 0.5, burstLimit: 1 },
                groupBy: 'organization'
            },

            // Fastmail - Business-friendly
            'fastmail_business_smtp': {
                method: 'smtp_verification',
                batchSize: 15,
                parallelConnections: 2,
                delayBetweenBatches: 1000,
                maxRetries: 3,
                timeout: 12000,
                rateLimit: { requestsPerSecond: 3, burstLimit: 6 },
                groupBy: 'organization'
            },

            // Zoho - Business provider
            'zoho_business_smtp': {
                method: 'smtp_verification',
                batchSize: 12,
                parallelConnections: 2,
                delayBetweenBatches: 1200,
                maxRetries: 3,
                timeout: 15000,
                rateLimit: { requestsPerSecond: 2.5, burstLimit: 5 },
                groupBy: 'organization'
            },

            // Yandex - Regional provider, conservative
            'yandex_regional_smtp': {
                method: 'smtp_verification',
                batchSize: 8,
                parallelConnections: 1,
                delayBetweenBatches: 2000,
                maxRetries: 2,
                timeout: 18000,
                rateLimit: { requestsPerSecond: 1, burstLimit: 2 },
                groupBy: 'organization'
            },

            // Mail.ru - Regional provider, conservative
            'mailru_regional_smtp': {
                method: 'smtp_verification',
                batchSize: 6,
                parallelConnections: 1,
                delayBetweenBatches: 2500,
                maxRetries: 2,
                timeout: 20000,
                rateLimit: { requestsPerSecond: 0.8, burstLimit: 2 },
                groupBy: 'organization'
            },

            // GMX - European provider
            'gmx_european_smtp': {
                method: 'smtp_verification',
                batchSize: 10,
                parallelConnections: 2,
                delayBetweenBatches: 1500,
                maxRetries: 2,
                timeout: 15000,
                rateLimit: { requestsPerSecond: 2, burstLimit: 4 },
                groupBy: 'organization'
            },

            // Mailgun - Service provider
            'mailgun_service_smtp': {
                method: 'smtp_verification',
                batchSize: 25,
                parallelConnections: 4,
                delayBetweenBatches: 300,
                maxRetries: 3,
                timeout: 10000,
                rateLimit: { requestsPerSecond: 10, burstLimit: 20 },
                groupBy: 'organization'
            },

            // SendGrid - Service provider
            'sendgrid_service_smtp': {
                method: 'smtp_verification',
                batchSize: 30,
                parallelConnections: 5,
                delayBetweenBatches: 200,
                maxRetries: 3,
                timeout: 8000,
                rateLimit: { requestsPerSecond: 15, burstLimit: 30 },
                groupBy: 'organization'
            },

            // Amazon SES - Service provider
            'amazon_ses_smtp': {
                method: 'smtp_verification',
                batchSize: 20,
                parallelConnections: 3,
                delayBetweenBatches: 500,
                maxRetries: 3,
                timeout: 12000,
                rateLimit: { requestsPerSecond: 8, burstLimit: 15 },
                groupBy: 'organization'
            },

            // Unknown MX - Ultra conservative
            'unknown_mx_conservative': {
                method: 'smtp_verification',
                batchSize: 3,
                parallelConnections: 1,
                delayBetweenBatches: 3000,
                maxRetries: 1,
                timeout: 25000,
                rateLimit: { requestsPerSecond: 0.3, burstLimit: 1 },
                groupBy: 'mx_domain'
            },

            // Unknown MX - Ultra conservative (downgraded)
            'unknown_mx_ultra_conservative': {
                method: 'smtp_verification',
                batchSize: 1,
                parallelConnections: 1,
                delayBetweenBatches: 5000,
                maxRetries: 1,
                timeout: 30000,
                rateLimit: { requestsPerSecond: 0.2, burstLimit: 1 },
                groupBy: 'mx_domain'
            },

            // Business SMTP - Standard approach for learned good performers
            'business_smtp_standard': {
                method: 'smtp_verification',
                batchSize: 15,
                parallelConnections: 2,
                delayBetweenBatches: 1000,
                maxRetries: 3,
                timeout: 15000,
                rateLimit: { requestsPerSecond: 3, burstLimit: 6 },
                groupBy: 'organization'
            },

            // Standard SMTP - Default fallback
            'standard_smtp': {
                method: 'smtp_verification',
                batchSize: 10,
                parallelConnections: 2,
                delayBetweenBatches: 1500,
                maxRetries: 2,
                timeout: 15000,
                rateLimit: { requestsPerSecond: 2, burstLimit: 4 },
                groupBy: 'organization'
            }
        };
    }

    /**
     * Get processing configuration for a profile
     * @param {string} profileName - The processing profile name
     * @returns {ProcessingConfig}
     */
    getProcessingConfig(profileName) {
        try {
            if (!profileName || typeof profileName !== 'string') {
                console.warn('Invalid profile name provided:', profileName);
                return this.getDefaultProcessingConfig();
            }

            const profiles = /** @type {any} */ (this.profiles);
            const config = profiles[profileName] || profiles['unknown_mx_conservative'];
            
            if (!config) {
                console.warn(`Profile ${profileName} not found, using default`);
                return this.getDefaultProcessingConfig();
            }

            // Validate the configuration before returning
            if (!this.validateProcessingConfig(config)) {
                console.warn(`Invalid configuration for profile ${profileName}, using default`);
                return this.getDefaultProcessingConfig();
            }

            return /** @type {ProcessingConfig} */ (config);
        } catch (error) {
            console.error('Critical error getting processing config:', this.getErrorMessage(error));
            return this.getDefaultProcessingConfig();
        }
    }

    /**
     * Get default safe processing configuration
     * @returns {ProcessingConfig}
     */
    getDefaultProcessingConfig() {
        return {
            method: 'smtp_verification',
            batchSize: 1,
            parallelConnections: 1,
            delayBetweenBatches: 5000,
            maxRetries: 1,
            timeout: 30000,
            rateLimit: { requestsPerSecond: 0.1, burstLimit: 1 },
            groupBy: 'mx_domain'
        };
    }

    /**
     * Get all available profiles
     * @returns {string[]} Array of profile names
     */
    getAvailableProfiles() {
        return Object.keys(this.profiles);
    }

    /**
     * Add or update a processing profile
     * @param {string} profileName - The profile name
     * @param {ProcessingConfig} config - The processing configuration
     */
    setProcessingProfile(profileName, config) {
        /** @type {any} */ (this.profiles)[profileName] = config;
    }

    /**
     * Get processing configuration with fallback safety
     * @param {string} profileName - The processing profile name
     * @param {string} fallbackProfile - Fallback profile if primary not found
     * @returns {ProcessingConfig}
     */
    getProcessingConfigWithFallback(profileName, fallbackProfile = 'unknown_mx_conservative') {
        const profiles = /** @type {any} */ (this.profiles);
        return /** @type {ProcessingConfig} */ (profiles[profileName] || profiles[fallbackProfile] || profiles['unknown_mx_conservative']);
    }

    /**
     * Get profile recommendations based on MX organization type
     * @param {string} organizationType - The organization type (business, personal, service, unknown)
     * @returns {string[]} Recommended profiles in order of preference
     */
    getRecommendedProfiles(organizationType) {
        /** @type {Record<string, string[]>} */
        const recommendations = {
            business: ['business_smtp_standard', 'standard_smtp', 'unknown_mx_conservative'],
            personal: ['standard_smtp', 'unknown_mx_conservative'],
            service: ['business_smtp_standard', 'standard_smtp'],
            unknown: ['unknown_mx_conservative', 'unknown_mx_ultra_conservative']
        };

        return recommendations[organizationType] || recommendations.unknown;
    }

    /**
     * Validate processing configuration
     * @param {ProcessingConfig} config - The configuration to validate
     * @returns {boolean} Whether the configuration is valid
     */
    validateProcessingConfig(config) {
        try {
            if (!config || typeof config !== 'object') {
                return false;
            }

            const requiredFields = [
                'method', 'batchSize', 'parallelConnections', 'delayBetweenBatches',
                'maxRetries', 'timeout', 'rateLimit', 'groupBy'
            ];

            for (const field of requiredFields) {
                if (!(field in config)) {
                    console.warn(`Missing required field: ${field}`);
                    return false;
                }
            }

            // Validate rate limit structure
            if (!config.rateLimit || typeof config.rateLimit !== 'object') {
                console.warn('Invalid rateLimit structure');
                return false;
            }

            if (typeof config.rateLimit.requestsPerSecond !== 'number' || 
                typeof config.rateLimit.burstLimit !== 'number') {
                console.warn('Invalid rateLimit values');
                return false;
            }

            if (config.rateLimit.requestsPerSecond <= 0 || config.rateLimit.burstLimit <= 0) {
                console.warn('Rate limit values must be positive');
                return false;
            }

            // Validate numeric constraints
            if (typeof config.batchSize !== 'number' || config.batchSize < 1) {
                console.warn('Invalid batchSize');
                return false;
            }

            if (typeof config.parallelConnections !== 'number' || config.parallelConnections < 1) {
                console.warn('Invalid parallelConnections');
                return false;
            }

            if (typeof config.maxRetries !== 'number' || config.maxRetries < 1) {
                console.warn('Invalid maxRetries');
                return false;
            }

            if (typeof config.timeout !== 'number' || config.timeout < 1000) {
                console.warn('Invalid timeout (must be at least 1000ms)');
                return false;
            }

            if (typeof config.delayBetweenBatches !== 'number' || config.delayBetweenBatches < 0) {
                console.warn('Invalid delayBetweenBatches');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error validating processing config:', this.getErrorMessage(error));
            return false;
        }
    }

    /**
     * Get performance metrics for profiling
     * @param {string} profileName - The profile name
     * @returns {Object} Performance characteristics
     */
    getProfileMetrics(profileName) {
        const config = this.getProcessingConfig(profileName);
        
        // Calculate estimated throughput
        const emailsPerBatch = config.batchSize;
        const batchTimeMs = config.delayBetweenBatches + (config.timeout / config.parallelConnections);
        const batchesPerSecond = 1000 / batchTimeMs;
        const estimatedThroughput = emailsPerBatch * batchesPerSecond;

        return {
            profileName,
            estimatedThroughput: Math.round(estimatedThroughput * 100) / 100,
            aggressiveness: this.calculateAggressiveness(config),
            riskLevel: this.calculateRiskLevel(config),
            suitableFor: this.getSuitableUseCase(profileName)
        };
    }

    /**
     * Calculate aggressiveness score (0-10)
     * @param {ProcessingConfig} config - The configuration
     * @returns {number} Aggressiveness score
     */
    calculateAggressiveness(config) {
        const batchScore = Math.min(config.batchSize / 5, 10);
        const connectionScore = Math.min(config.parallelConnections * 2, 10);
        const delayScore = Math.max(10 - (config.delayBetweenBatches / 500), 0);
        const rateScore = Math.min(config.rateLimit.requestsPerSecond, 10);

        return Math.round(((batchScore + connectionScore + delayScore + rateScore) / 4) * 10) / 10;
    }

    /**
     * Calculate risk level (0-10)
     * @param {ProcessingConfig} config - The configuration
     * @returns {number} Risk level
     */
    calculateRiskLevel(config) {
        // Higher batch size, more connections, less delay = higher risk
        const batchRisk = Math.min(config.batchSize / 3, 10);
        const connectionRisk = Math.min(config.parallelConnections * 1.5, 10);
        const delayRisk = Math.max(10 - (config.delayBetweenBatches / 300), 0);

        return Math.round(((batchRisk + connectionRisk + delayRisk) / 3) * 10) / 10;
    }

    /**
     * Get suitable use case for profile
     * @param {string} profileName - The profile name
     * @returns {string} Use case description
     */
    getSuitableUseCase(profileName) {
        /** @type {Record<string, string>} */
        const useCases = {
            'google_workspace_smtp': 'Google Workspace and Gmail addresses',
            'microsoft_exchange_smtp': 'Microsoft Office 365 and Exchange',
            'yahoo_smtp_alternate': 'Yahoo Mail and AOL addresses',
            'apple_icloud_smtp': 'Apple iCloud email addresses',
            'protonmail_smtp': 'Privacy-focused email providers',
            'fastmail_business_smtp': 'Business email hosting services',
            'zoho_business_smtp': 'Zoho business email accounts',
            'yandex_regional_smtp': 'Yandex and regional providers',
            'mailru_regional_smtp': 'Mail.ru and Eastern European providers',
            'gmx_european_smtp': 'GMX and European email providers',
            'mailgun_service_smtp': 'Mailgun transactional email service',
            'sendgrid_service_smtp': 'SendGrid transactional email service',
            'amazon_ses_smtp': 'Amazon SES email service',
            'unknown_mx_conservative': 'Unknown MX domains (conservative)',
            'unknown_mx_ultra_conservative': 'Problematic unknown MX domains',
            'business_smtp_standard': 'Well-performing business domains',
            'standard_smtp': 'General purpose email verification'
        };

        return useCases[profileName] || 'Unknown use case';
    }
}

module.exports = MXProcessingProfiles;