/**
 * API Key utilities for generation, hashing, and validation
 * Handles secure API key creation and verification
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');


// API key configuration
const API_KEY_PREFIX = 'brndnv_sk_';
const RANDOM_STRING_LENGTH = 32;
const BCRYPT_SALT_ROUNDS = 10;


/**
 * Generate a secure random API key
 * @returns {string} API key in format: brndnv_sk_ + 32 random alphanumeric characters
 */
function generateApiKey() {
    try {
        // Generate random bytes
        const randomBytes = crypto.randomBytes(Math.ceil(RANDOM_STRING_LENGTH * 3 / 4));

        // Convert to base64 and remove special characters, keeping only alphanumeric
        let randomString = randomBytes
            .toString('base64')
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, RANDOM_STRING_LENGTH);

        // If we don't have enough characters, generate more
        while (randomString.length < RANDOM_STRING_LENGTH) {
            const additionalBytes = crypto.randomBytes(16);
            const additionalString = additionalBytes
                .toString('base64')
                .replace(/[^a-zA-Z0-9]/g, '');
            randomString += additionalString;
        }

        // Trim to exact length
        randomString = randomString.substring(0, RANDOM_STRING_LENGTH);

        // Combine prefix and random string
        const apiKey = API_KEY_PREFIX + randomString;

        return apiKey;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('API key generation failed:', errorMessage);
        throw error;
    } finally {
        console.debug('API key generation process completed');
    }
}


/**
 * Hash an API key using bcrypt
 * @param {string} apiKey - Plain text API key to hash
 * @returns {Promise<string>} Bcrypt hash of the API key
 */
async function hashApiKey(apiKey) {
    try {
        if (!apiKey) {
            throw new Error('No API key provided for hashing');
        }

        // Generate bcrypt hash
        const hash = await bcrypt.hash(apiKey, BCRYPT_SALT_ROUNDS);

        return hash;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('API key hashing failed:', errorMessage);
        throw error;
    } finally {
        console.debug('API key hashing process completed');
    }
}


/**
 * Validate API key format
 * @param {string} apiKey - API key to validate
 * @returns {boolean} True if format is valid, false otherwise
 */
function validateApiKeyFormat(apiKey) {
    try {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }

        // Check if it starts with the correct prefix
        if (!apiKey.startsWith(API_KEY_PREFIX)) {
            return false;
        }

        // Check total length (prefix + random string)
        const expectedLength = API_KEY_PREFIX.length + RANDOM_STRING_LENGTH;
        if (apiKey.length !== expectedLength) {
            return false;
        }

        // Check if the part after prefix is alphanumeric
        const randomPart = apiKey.substring(API_KEY_PREFIX.length);
        const alphanumericRegex = /^[a-zA-Z0-9]+$/;
        if (!alphanumericRegex.test(randomPart)) {
            return false;
        }

        return true;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('API key format validation failed:', errorMessage);
        return false;
    } finally {
        console.debug('API key format validation process completed');
    }
}


/**
 * Compare a plain text API key with a hashed API key
 * @param {string} apiKey - Plain text API key
 * @param {string} hash - Bcrypt hash to compare against
 * @returns {Promise<boolean>} True if they match, false otherwise
 */
async function compareApiKey(apiKey, hash) {
    try {
        if (!apiKey || !hash) {
            return false;
        }

        const isMatch = await bcrypt.compare(apiKey, hash);
        return isMatch;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('API key comparison failed:', errorMessage);
        return false;
    } finally {
        console.debug('API key comparison process completed');
    }
}


/**
 * Extract key prefix for display purposes
 * @param {string} apiKey - Full API key
 * @returns {string} First 12 characters of the API key
 */
function extractKeyPrefix(apiKey) {
    try {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('Invalid API key for prefix extraction');
        }

        return apiKey.substring(0, 12);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Key prefix extraction failed:', errorMessage);
        throw error;
    } finally {
        console.debug('Key prefix extraction process completed');
    }
}


/**
 * Create masked version of API key for display
 * @param {string} keyPrefix - First 12 characters of API key
 * @returns {string} Masked key in format: prefix***xyz
 */
function createMaskedKey(keyPrefix) {
    try {
        if (!keyPrefix || typeof keyPrefix !== 'string') {
            throw new Error('Invalid key prefix for masking');
        }

        return keyPrefix + '***xyz';

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Key masking failed:', errorMessage);
        throw error;
    } finally {
        console.debug('Key masking process completed');
    }
}


// Export functions
module.exports = {
    generateApiKey,
    hashApiKey,
    validateApiKeyFormat,
    compareApiKey,
    extractKeyPrefix,
    createMaskedKey
};
