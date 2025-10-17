/**
 * @typedef {Object} MXOrganizationClassification
 * @property {string} organization - The organization identifier for rate limiting
 * @property {string} processingProfile - The processing profile to use
 * @property {string} confidence - Confidence level (high, medium, low)
 * @property {string} source - Source of classification (mx_pattern, fallback, adaptive_learning)
 */

/**
 * MX Domain-based Organization Classifier
 * Groups MX domains by organization for rate limiting purposes
 * Allows parallel processing across different organizations while respecting per-org limits
 */
class MXOrganizationClassifier {
    constructor() {
        this.unknownMXLearning = new UnknownMXLearning();
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
     * Classify MX domain to determine organization for rate limiting
     * @param {string} mxDomain - The MX domain to classify
     * @returns {MXOrganizationClassification}
     */
    classifyMXDomain(mxDomain) {
        try {
            // Input validation
            if (!mxDomain || typeof mxDomain !== 'string') {
                console.warn('Invalid MX domain provided:', mxDomain);
                return this.getDefaultClassification();
            }

            const domain = mxDomain.toLowerCase().trim();
            if (!domain) {
                console.warn('Empty MX domain after processing:', mxDomain);
                return this.getDefaultClassification();
            }

            // STEP 1: Check for learned improvements from adaptive system
            try {
                const learnedClassification = this.unknownMXLearning.getImprovedClassification(domain);
                if (learnedClassification) {
                    return {
                        organization: learnedClassification.organization,
                        processingProfile: learnedClassification.processingProfile,
                        confidence: 'high',
                        source: 'adaptive_learning'
                    };
                }
            } catch (error) {
                console.warn('Error in adaptive learning classification:', error instanceof Error ? this.getErrorMessage(error) : String(error));
                // Continue to next step
            }

            // STEP 2: Pattern-based classification for major providers
            try {
                const knownProvider = this.classifyKnownMXProviders(domain);
                if (knownProvider) {
                    return {
                        organization: knownProvider.organization,
                        processingProfile: this.getProviderProfile(knownProvider.organization),
                        confidence: 'high',
                        source: 'mx_pattern'
                    };
                }
            } catch (error) {
                console.warn('Error in known provider classification:', this.getErrorMessage(error));
                // Continue to fallback
            }

            // STEP 3: Fallback for unknown MX domains
            try {
                return this.classifyUnknownMXDomain(domain);
            } catch (error) {
                console.error('Error in fallback classification:', this.getErrorMessage(error));
                return this.getDefaultClassification();
            }
        } catch (error) {
            console.error('Critical error in MX domain classification:', this.getErrorMessage(error));
            return this.getDefaultClassification();
        }
    }

    /**
     * Get default safe classification when all else fails
     * @returns {MXOrganizationClassification}
     */
    getDefaultClassification() {
        return {
            organization: 'unknown_default',
            processingProfile: 'unknown_mx_ultra_conservative',
            confidence: 'low',
            source: 'error_fallback'
        };
    }

    /**
     * Pattern-based classification for known MX providers
     * @param {string} mxDomain - The MX domain to classify
     * @returns {{organization: string} | null}
     */
    classifyKnownMXProviders(mxDomain) {
        try {
            if (!mxDomain || typeof mxDomain !== 'string') {
                return null;
            }

            // Google MX patterns - group all Google MX servers together
            try {
                if (this.isGoogleMX(mxDomain)) {
                    return { organization: 'google' };
                }
            } catch (error) {
                console.warn('Error checking Google MX pattern:', this.getErrorMessage(error));
            }

            // Microsoft MX patterns - group all Microsoft MX servers together
            try {
                if (this.isMicrosoftMX(mxDomain)) {
                    return { organization: 'microsoft' };
                }
            } catch (error) {
                console.warn('Error checking Microsoft MX pattern:', this.getErrorMessage(error));
            }

            // Yahoo MX patterns - group all Yahoo MX servers together
            try {
                if (this.isYahooMX(mxDomain)) {
                    return { organization: 'yahoo' };
                }
            } catch (error) {
                console.warn('Error checking Yahoo MX pattern:', this.getErrorMessage(error));
            }

            // Other major providers
            try {
                const providerPatterns = {
                    // Apple iCloud
                    apple: /^mx\d*\.mail\.icloud\.com$/i,
                    
                    // Proton Mail
                    protonmail: /^mail\.protonmail\.(com|ch)$/i,
                    
                    // Fastmail
                    fastmail: /^in\d*-smtp\.messagingengine\.com$/i,
                    
                    // Zoho
                    zoho: /^mx\d*\.zoho\.(com|eu|in|com\.au)$/i,
                    
                    // Yandex
                    yandex: /^mx\d*\.yandex\.(ru|net|com)$/i,
                    
                    // Mail.ru
                    mailru: /^mxs\d*\.mail\.ru$/i,
                    
                    // GMX
                    gmx: /^mx\d*\.gmx\.(com|net|de)$/i,
                    
                    // Mailgun
                    mailgun: /^mxa\.mailgun\.org$/i,
                    
                    // SendGrid
                    sendgrid: /^mx\d*\.sendgrid\.net$/i,
                    
                    // Amazon SES
                    amazon_ses: /^inbound-smtp\.[a-z0-9-]+\.amazonaws\.com$/i
                };

                for (const [provider, pattern] of Object.entries(providerPatterns)) {
                    try {
                        if (pattern.test(mxDomain)) {
                            return { organization: provider };
                        }
                    } catch (regexError) {
                        console.warn(`Error testing pattern for ${provider}:`, this.getErrorMessage(regexError));
                        // Continue to next pattern
                    }
                }
            } catch (error) {
                console.warn('Error in provider pattern matching:', this.getErrorMessage(error));
            }

            return null;
        } catch (error) {
            console.error('Critical error in known MX provider classification:', this.getErrorMessage(error));
            return null;
        }
    }

    /**
     * Check if MX domain belongs to Google (includes all variants) - Algorithmic approach
     * @param {string} mxDomain - The MX domain
     * @returns {boolean}
     */
    isGoogleMX(mxDomain) {
        try {
            if (!mxDomain || typeof mxDomain !== 'string') {
                return false;
            }

            const domain = mxDomain.toLowerCase().trim();
            if (!domain) {
                return false;
            }
            
            // Algorithmic detection for Google MX servers
            try {
                // Pattern 1: Direct Google domain matches (any Google TLD)
                if (/\.google\.(com|co\.[a-z]{2}|[a-z]{2})$/i.test(domain)) {
                    return true;
                }
            } catch (error) {
                console.warn('Error in Google pattern 1:', this.getErrorMessage(error));
            }
            
            try {
                // Pattern 2: Gmail/Googlemail specific patterns
                if (/\.gmail\.com$/i.test(domain) || /\.googlemail\.com$/i.test(domain)) {
                    return true;
                }
            } catch (error) {
                console.warn('Error in Google pattern 2:', this.getErrorMessage(error));
            }
            
            try {
                // Pattern 3: Google-specific MX patterns
                if (/(gmail-smtp-in|aspmx|googlemail)/i.test(domain) && /google/i.test(domain)) {
                    return true;
                }
            } catch (error) {
                console.warn('Error in Google pattern 3:', this.getErrorMessage(error));
            }
            
            try {
                // Pattern 4: Google Workspace patterns
                if (/^(aspmx|alt\d+\.aspmx|aspmx\d+)/i.test(domain) && /google/i.test(domain)) {
                    return true;
                }
            } catch (error) {
                console.warn('Error in Google pattern 4:', this.getErrorMessage(error));
            }
            
            return false;
        } catch (error) {
            console.error('Critical error in Google MX detection:', this.getErrorMessage(error));
            return false;
        }
    }

    /**
     * Check if MX domain belongs to Microsoft (includes all variants) - Algorithmic approach
     * @param {string} mxDomain - The MX domain
     * @returns {boolean}
     */
    isMicrosoftMX(mxDomain) {
        try {
            if (!mxDomain || typeof mxDomain !== 'string') {
                return false;
            }

            const domain = mxDomain.toLowerCase().trim();
            if (!domain) {
                return false;
            }
            
            // Algorithmic detection for Microsoft MX servers
            try {
                // Pattern 1: Outlook protection services (Office 365/Microsoft 365)
                if (/\.outlook\.com$/i.test(domain) && /(protection|mail|eo)/i.test(domain)) {
                    return true;
                }
            } catch (error) {
                console.warn('Error in Microsoft pattern 1:', this.getErrorMessage(error));
            }
            
            try {
                // Pattern 2: Traditional Microsoft domains
                if (/\.(hotmail|live|msn|microsoft)\.com$/i.test(domain)) {
                    return true;
                }
            } catch (error) {
                console.warn('Error in Microsoft pattern 2:', this.getErrorMessage(error));
            }
            
            try {
                // Pattern 3: Exchange Online patterns
                if (/outlook/i.test(domain) && /(mail|exchange)/i.test(domain)) {
                    return true;
                }
            } catch (error) {
                console.warn('Error in Microsoft pattern 3:', this.getErrorMessage(error));
            }
            
            return false;
        } catch (error) {
            console.error('Critical error in Microsoft MX detection:', this.getErrorMessage(error));
            return false;
        }
    }

    /**
     * Check if MX domain belongs to Yahoo (includes all variants) - Algorithmic approach
     * @param {string} mxDomain - The MX domain
     * @returns {boolean}
     */
    isYahooMX(mxDomain) {
        try {
            if (!mxDomain || typeof mxDomain !== 'string') {
                return false;
            }

            const domain = mxDomain.toLowerCase().trim();
            if (!domain) {
                return false;
            }
            
            // Algorithmic detection for Yahoo MX servers
            try {
                // Pattern 1: Yahoo mail servers (any Yahoo TLD)
                if (/\.yahoo\.(com|co\.[a-z]{2}|[a-z]{2})$/i.test(domain) && /(mail|mx|mta)/i.test(domain)) {
                    return true;
                }
            } catch (error) {
                console.warn('Error in Yahoo pattern 1:', this.getErrorMessage(error));
            }
            
            try {
                // Pattern 2: Yahoo DNS services
                if (/yahoodns/i.test(domain)) {
                    return true;
                }
            } catch (error) {
                console.warn('Error in Yahoo pattern 2:', this.getErrorMessage(error));
            }
            
            try {
                // Pattern 3: AOL (owned by Yahoo)
                if (/\.aol\.com$/i.test(domain) && /(mx|mail)/i.test(domain)) {
                    return true;
                }
            } catch (error) {
                console.warn('Error in Yahoo pattern 3:', this.getErrorMessage(error));
            }
            
            return false;
        } catch (error) {
            console.error('Critical error in Yahoo MX detection:', this.getErrorMessage(error));
            return false;
        }
    }

    /**
     * Fallback classification for unknown MX domains - Algorithmic approach
     * @param {string} mxDomain - The MX domain
     * @returns {MXOrganizationClassification}
     */
    classifyUnknownMXDomain(mxDomain) {
        try {
            if (!mxDomain || typeof mxDomain !== 'string') {
                return this.getDefaultClassification();
            }

            // Extract organization identifier for grouping
            let orgIdentifier;
            try {
                orgIdentifier = this.extractOrganizationIdentifier(mxDomain);
            } catch (error) {
                console.warn('Error extracting organization identifier:', this.getErrorMessage(error));
                orgIdentifier = `unknown_${mxDomain.toLowerCase().replace(/[^a-z0-9.-]/g, '_')}`;
            }
            
            // Determine processing profile based on domain characteristics
            let profile;
            try {
                profile = this.determineProcessingProfile(mxDomain);
            } catch (error) {
                console.warn('Error determining processing profile:', this.getErrorMessage(error));
                profile = 'unknown_mx_ultra_conservative';
            }
            
            return {
                organization: orgIdentifier || 'unknown_default',
                processingProfile: profile || 'unknown_mx_ultra_conservative',
                confidence: 'low',
                source: 'fallback'
            };
        } catch (error) {
            console.error('Critical error in unknown MX domain classification:', this.getErrorMessage(error));
            return this.getDefaultClassification();
        }
    }

    /**
     * Extract organization identifier from MX domain for algorithmic grouping
     * This groups similar MX servers under the same organization
     * @param {string} mxDomain - The MX domain
     * @returns {string}
     */
    extractOrganizationIdentifier(mxDomain) {
        try {
            if (!mxDomain || typeof mxDomain !== 'string') {
                return 'unknown_invalid';
            }

            const domain = mxDomain.toLowerCase().trim();
            if (!domain) {
                return 'unknown_empty';
            }
            
            // Remove common MX prefixes to get the core organization
            let cleaned;
            try {
                cleaned = domain
                    .replace(/^(mx\d*|mail|smtp|aspmx\d*|alt\d+|mta\d*|inbound-smtp|in\d*-smtp)\.?/i, '')
                    .replace(/^(protection|eo)\./, ''); // Remove Microsoft-specific prefixes
            } catch (error) {
                console.warn('Error cleaning domain:', this.getErrorMessage(error));
                cleaned = domain;
            }
            
            // For domains like "example-com.mail.protection.outlook.com", extract "example.com"
            try {
                const protectionMatch = cleaned.match(/^([^.]+)-([^.]+)\.mail\.protection\.outlook\.com$/);
                if (protectionMatch && protectionMatch[1] && protectionMatch[2]) {
                    return `${protectionMatch[1]}.${protectionMatch[2]}`;
                }
            } catch (error) {
                console.warn('Error matching protection pattern:', this.getErrorMessage(error));
            }
            
            // Extract base domain (last two parts)
            try {
                const parts = cleaned.split('.');
                if (parts.length >= 2) {
                    const baseDomain = parts.slice(-2).join('.');
                    
                    if (baseDomain && baseDomain !== '.') {
                        // For known service providers, use the service name as organization
                        try {
                            if (this.isServiceProvider(baseDomain)) {
                                return baseDomain;
                            }
                        } catch (error) {
                            console.warn('Error checking service provider:', this.getErrorMessage(error));
                        }
                        
                        // For custom business domains, use the domain as organization
                        return baseDomain;
                    }
                }
            } catch (error) {
                console.warn('Error extracting base domain:', this.getErrorMessage(error));
            }
            
            // Fallback: sanitize the original domain
            const sanitized = domain.replace(/[^a-z0-9.-]/g, '_');
            return `unknown_${sanitized}`;
        } catch (error) {
            console.error('Critical error extracting organization identifier:', this.getErrorMessage(error));
            return 'unknown_error';
        }
    }

    /**
     * Check if domain is a known service provider
     * @param {string} domain - The base domain
     * @returns {boolean}
     */
    isServiceProvider(domain) {
        try {
            if (!domain || typeof domain !== 'string') {
                return false;
            }

            const serviceProviders = [
                'mailgun.org', 'sendgrid.net', 'amazonaws.com', 'messagingengine.com',
                'zoho.com', 'fastmail.com', 'protonmail.com', 'yandex.ru', 'mail.ru',
                'gmx.com', 'icloud.com'
            ];
            
            return serviceProviders.some(provider => {
                try {
                    return domain.includes(provider);
                } catch (error) {
                    console.warn(`Error checking provider ${provider}:`, this.getErrorMessage(error));
                    return false;
                }
            });
        } catch (error) {
            console.error('Critical error checking service provider:', this.getErrorMessage(error));
            return false;
        }
    }

    /**
     * Determine processing profile based on MX domain characteristics
     * @param {string} mxDomain - The MX domain
     * @returns {string}
     */
    determineProcessingProfile(mxDomain) {
        try {
            if (!mxDomain || typeof mxDomain !== 'string') {
                return 'unknown_mx_ultra_conservative';
            }

            const domain = mxDomain.toLowerCase().trim();
            if (!domain) {
                return 'unknown_mx_ultra_conservative';
            }
            
            // Service providers get more aggressive profiles
            try {
                if (this.isServiceProvider(domain)) {
                    return 'business_smtp_standard';
                }
            } catch (error) {
                console.warn('Error checking service provider for profile:', this.getErrorMessage(error));
            }
            
            // Business indicators
            try {
                if (/(corp|company|enterprise|business|mail\.)/i.test(domain)) {
                    return 'business_smtp_conservative';
                }
            } catch (error) {
                console.warn('Error checking business indicators:', this.getErrorMessage(error));
            }
            
            // Default to conservative for unknown domains
            return 'unknown_mx_conservative';
        } catch (error) {
            console.error('Critical error determining processing profile:', this.getErrorMessage(error));
            return 'unknown_mx_ultra_conservative';
        }
    }

    /**
     * Get processing profile for organization
     * @param {string} organization - The organization name
     * @returns {string}
     */
    getProviderProfile(organization) {
        /** @type {Record<string, string>} */
        const profiles = {
            google: 'google_workspace_smtp',
            microsoft: 'microsoft_exchange_smtp',
            yahoo: 'yahoo_smtp_alternate',
            apple: 'apple_icloud_smtp',
            protonmail: 'protonmail_smtp',
            fastmail: 'fastmail_business_smtp',
            zoho: 'zoho_business_smtp',
            yandex: 'yandex_regional_smtp',
            mailru: 'mailru_regional_smtp',
            gmx: 'gmx_european_smtp',
            mailgun: 'mailgun_service_smtp',
            sendgrid: 'sendgrid_service_smtp',
            amazon_ses: 'amazon_ses_smtp'
        };

        return profiles[organization] || 'standard_smtp';
    }

    /**
     * Track verification results for MX domains (for learning)
     * @param {string} mxDomain - The MX domain
     * @param {MXOrganizationClassification} classification - The classification used
     * @param {Object} result - The verification result
     */
    trackMXDomainResult(mxDomain, classification, result) {
        this.unknownMXLearning.trackMXDomainResult(mxDomain, classification, result);
    }
}

/**
 * Adaptive learning system for unknown MX domains
 */
/**
 * @typedef {Object} MXPerformanceStats
 * @property {string} mxDomain
 * @property {MXOrganizationClassification} classification
 * @property {number} attempts
 * @property {number} successes
 * @property {number} failures
 * @property {number} greylistCount
 * @property {number} blacklistCount
 * @property {number} lastUpdated
 */

class UnknownMXLearning {
    constructor() {
        /** @type {Map<string, MXPerformanceStats>} */
        this.mxPerformance = new Map();
        /** @type {Map<string, Object>} */
        this.mxPatterns = new Map();
    }

    /**
     * Track verification results for unknown MX domains
     * @param {string} mxDomain - The MX domain
     * @param {MXOrganizationClassification} classification - The classification used
     * @param {any} result - The verification result
     */
    trackMXDomainResult(mxDomain, classification, result) {
        const key = `${mxDomain}_${classification.organization}`;

        if (!this.mxPerformance.has(key)) {
            this.mxPerformance.set(key, {
                mxDomain,
                classification,
                attempts: 0,
                successes: 0,
                failures: 0,
                greylistCount: 0,
                blacklistCount: 0,
                lastUpdated: Date.now()
            });
        }

        const stats = this.mxPerformance.get(key);
        if (stats) {
            stats.attempts++;

            if (result && result.deliverable) {
                stats.successes++;
            } else if (result && result.error) {
                stats.failures++;
            }

            if (result && result.greylisted) stats.greylistCount++;
            if (result && result.disabled) stats.blacklistCount++;

            stats.lastUpdated = Date.now();

            // Adaptive classification improvement
            this.improveMXClassification(mxDomain, stats);
        }
    }

    /**
     * Improve MX classification based on learned performance
     * @param {string} mxDomain - The MX domain
     * @param {MXPerformanceStats} stats - Performance stats
     */
    improveMXClassification(mxDomain, stats) {
        const successRate = stats.successes / stats.attempts;
        const greylistRate = stats.greylistCount / stats.attempts;

        // If MX domain performs well with conservative settings, upgrade it
        if (stats.attempts > 10 && successRate > 0.8 && greylistRate < 0.2) {
            this.suggestClassificationUpgrade(mxDomain, 'business_smtp_standard');
        }

        // If MX domain frequently greylists/blacklists, downgrade it
        if (stats.attempts > 5 && (greylistRate > 0.5 || stats.blacklistCount > 2)) {
            this.suggestClassificationDowngrade(mxDomain, 'unknown_mx_ultra_conservative');
        }
    }

    /**
     * Suggest classification upgrade
     * @param {string} mxDomain - The MX domain
     * @param {string} newProfile - New processing profile
     */
    suggestClassificationUpgrade(mxDomain, newProfile) {
        console.log(`Suggesting upgrade for MX ${mxDomain} to ${newProfile}`);
    }

    /**
     * Suggest classification downgrade
     * @param {string} mxDomain - The MX domain
     * @param {string} newProfile - New processing profile
     */
    suggestClassificationDowngrade(mxDomain, newProfile) {
        console.log(`Suggesting downgrade for MX ${mxDomain} to ${newProfile}`);
    }

    /**
     * Get improved classification for an MX domain
     * @param {string} mxDomain - The MX domain
     * @returns {{organization: string, processingProfile: string} | null}
     */
    getImprovedClassification(mxDomain) {
        const stats = this.mxPerformance.get(mxDomain);
        if (!stats || stats.attempts < 3) return null;

        const successRate = stats.successes / stats.attempts;
        const greylistRate = stats.greylistCount / stats.attempts;

        // Suggest better processing profile based on performance
        if (successRate > 0.9 && greylistRate < 0.1) {
            return {
                organization: `learned_${stats.classification.organization}`,
                processingProfile: 'business_smtp_standard'
            };
        } else if (successRate < 0.5 || greylistRate > 0.4) {
            return {
                organization: `learned_${stats.classification.organization}`,
                processingProfile: 'unknown_mx_ultra_conservative'
            };
        }

        return null;
    }
}

module.exports = MXOrganizationClassifier;