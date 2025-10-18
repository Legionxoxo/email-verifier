/**
 * Mock SMTP Response Generator
 * Generates realistic SMTP verification results for testing without actual SMTP communication
 */

const emailSplit = require('../../utils/emailSplit');


/**
 * Generate mock SMTP verification results
 * @param {string[]} emails - Array of emails to verify
 * @param {{Host: string, Pref: number}[]} mx_records - MX records (not used in mock but kept for signature compatibility)
 * @returns {Promise<Map<string, any>>} Map of email to verification result
 */
async function generateMockSmtpResults(emails, mx_records = []) {
    const results = new Map();

    for (const email of emails) {
        const { username, domain } = emailSplit(email);
        const lowerEmail = email.toLowerCase();

        // Determine mock result based on email patterns
        const mockResult = determineMockResult(email, username, domain);

        results.set(email, mockResult);
    }

    // Simulate network delay (50-200ms)
    await sleep(Math.random() * 150 + 50);

    return results;
}


/**
 * Determine mock result based on email characteristics
 * @param {string} email - Full email address
 * @param {string} username - Username part
 * @param {string} domain - Domain part
 * @returns {Object} Mock SMTP result
 */
function determineMockResult(email, username, domain) {
    const lowerEmail = email.toLowerCase();
    const lowerUsername = username.toLowerCase();
    const lowerDomain = domain.toLowerCase();


    // Pattern 1: Invalid/undeliverable emails (contains "invalid", "fake", "test", "bounce")
    if (
        lowerUsername.includes('invalid') ||
        lowerUsername.includes('fake') ||
        lowerUsername.includes('bounce') ||
        lowerUsername.includes('baduser')
    ) {
        return {
            host_exists: true,
            full_inbox: false,
            catch_all: false,
            deliverable: false,
            disabled: false,
            error: false,
            errorMsg: { details: '', message: '' },
            greylisted: false,
            requires_recheck: false,
        };
    }


    // Pattern 2: Full inbox (contains "full")
    if (lowerUsername.includes('full')) {
        return {
            host_exists: true,
            full_inbox: true,
            catch_all: false,
            deliverable: false,
            disabled: false,
            error: false,
            errorMsg: { details: '', message: '' },
            greylisted: false,
            requires_recheck: false,
        };
    }


    // Pattern 3: Catch-all domains (contains "catchall" in domain)
    if (lowerDomain.includes('catchall')) {
        return {
            host_exists: true,
            full_inbox: false,
            catch_all: true,
            deliverable: true,
            disabled: false,
            error: false,
            errorMsg: { details: '', message: '' },
            greylisted: false,
            requires_recheck: false,
        };
    }


    // Pattern 4: Greylisted (contains "grey" or "greylist")
    if (lowerUsername.includes('grey') || lowerUsername.includes('greylist')) {
        return {
            host_exists: true,
            full_inbox: false,
            catch_all: false,
            deliverable: false,
            disabled: false,
            error: false,
            errorMsg: { details: '', message: '' },
            greylisted: true,
            requires_recheck: true,
        };
    }


    // Pattern 5: Disabled/blacklisted (contains "disabled", "blocked", "blacklist")
    if (
        lowerUsername.includes('disabled') ||
        lowerUsername.includes('blocked') ||
        lowerUsername.includes('blacklist')
    ) {
        return {
            host_exists: true,
            full_inbox: false,
            catch_all: false,
            deliverable: false,
            disabled: true,
            error: false,
            errorMsg: { details: '', message: '' },
            greylisted: false,
            requires_recheck: false,
        };
    }


    // Pattern 6: Error simulation (contains "error", "timeout", "fail")
    if (
        lowerUsername.includes('error') ||
        lowerUsername.includes('timeout') ||
        lowerUsername.includes('fail')
    ) {
        return {
            host_exists: false,
            full_inbox: false,
            catch_all: false,
            deliverable: false,
            disabled: false,
            error: true,
            errorMsg: {
                details: 'Mock SMTP connection error',
                message: 'Connection timeout',
            },
            greylisted: false,
            requires_recheck: false,
        };
    }


    // Pattern 7: Randomized results for realistic testing
    // Use email hash to generate consistent but pseudo-random results
    const emailHash = simpleHash(lowerEmail);
    const randomFactor = emailHash % 100;

    // 5% chance of various edge cases
    if (randomFactor < 2) {
        // Greylisted
        return {
            host_exists: true,
            full_inbox: false,
            catch_all: false,
            deliverable: false,
            disabled: false,
            error: false,
            errorMsg: { details: '', message: '' },
            greylisted: true,
            requires_recheck: true,
        };
    } else if (randomFactor < 4) {
        // Full inbox
        return {
            host_exists: true,
            full_inbox: true,
            catch_all: false,
            deliverable: false,
            disabled: false,
            error: false,
            errorMsg: { details: '', message: '' },
            greylisted: false,
            requires_recheck: false,
        };
    } else if (randomFactor < 6) {
        // Invalid/undeliverable
        return {
            host_exists: true,
            full_inbox: false,
            catch_all: false,
            deliverable: false,
            disabled: false,
            error: false,
            errorMsg: { details: '', message: '' },
            greylisted: false,
            requires_recheck: false,
        };
    }


    // Default: Valid and deliverable (90% of emails)
    return {
        host_exists: true,
        full_inbox: false,
        catch_all: false,
        deliverable: true,
        disabled: false,
        error: false,
        errorMsg: { details: '', message: '' },
        greylisted: false,
        requires_recheck: false,
    };
}


/**
 * Simple hash function for consistent pseudo-random results
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}


/**
 * Sleep utility for simulating network delay
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


module.exports = {
    generateMockSmtpResults,
    determineMockResult,
};
