/**
 * Password hashing and verification utilities
 * Handles secure password operations using bcryptjs
 */

const bcrypt = require('bcryptjs');

// Import environment variables
const { BCRYPT_ROUNDS } = require('../../data/env');

// Password configuration
const SALT_ROUNDS = BCRYPT_ROUNDS;

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
	try {
		if (!password || typeof password !== 'string') {
			throw new Error('Invalid password provided');
		}

		if (password.length < 8) {
			throw new Error('Password must be at least 8 characters long');
		}

		const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
		return hashedPassword;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Password hashing failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Password hashing process completed');
	}
}

/**
 * Verify password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} Password match result
 */
async function verifyPassword(password, hash) {
	try {
		if (!password || typeof password !== 'string') {
			throw new Error('Invalid password provided');
		}

		if (!hash || typeof hash !== 'string') {
			throw new Error('Invalid hash provided');
		}

		const isMatch = await bcrypt.compare(password, hash);
		return isMatch;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Password verification failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Password verification process completed');
	}
}

/**
 * Validate password strength
 * @param {string} password - Plain text password
 * @returns {Object} Validation result with isValid and errors
 */
function validatePasswordStrength(password) {
	try {
		const errors = [];

		if (!password || typeof password !== 'string') {
			errors.push('Password is required');
			return { isValid: false, errors };
		}

		if (password.length < 8) {
			errors.push('Password must be at least 8 characters long');
		}

		if (password.length > 128) {
			errors.push('Password must be less than 128 characters long');
		}

		if (!/[a-z]/.test(password)) {
			errors.push('Password must contain at least one lowercase letter');
		}

		if (!/[A-Z]/.test(password)) {
			errors.push('Password must contain at least one uppercase letter');
		}

		if (!/[0-9]/.test(password)) {
			errors.push('Password must contain at least one number');
		}

		if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
			errors.push('Password must contain at least one special character');
		}

		// Check for common weak passwords
		const commonPasswords = [
			'password',
			'123456',
			'123456789',
			'qwerty',
			'abc123',
			'password123',
			'admin',
			'letmein',
			'welcome',
			'monkey',
		];

		if (commonPasswords.includes(password.toLowerCase())) {
			errors.push('Password is too common and easily guessable');
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Password validation failed:', errorMessage);
		return {
			isValid: false,
			errors: ['Password validation failed'],
		};
	} finally {
		console.debug('Password validation process completed');
	}
}

/**
 * Generate random password
 * @param {number} length - Password length (default: 12)
 * @returns {string} Generated password
 */
function generateRandomPassword(length = 12) {
	try {
		if (length < 8 || length > 128) {
			throw new Error('Password length must be between 8 and 128 characters');
		}

		const lowercase = 'abcdefghijklmnopqrstuvwxyz';
		const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		const numbers = '0123456789';
		const symbols = '!@#$%^&*(),.?":{}|<>';

		const allChars = lowercase + uppercase + numbers + symbols;

		let password = '';

		// Ensure at least one character from each category
		password += lowercase[Math.floor(Math.random() * lowercase.length)];
		password += uppercase[Math.floor(Math.random() * uppercase.length)];
		password += numbers[Math.floor(Math.random() * numbers.length)];
		password += symbols[Math.floor(Math.random() * symbols.length)];

		// Fill remaining length with random characters
		for (let i = 4; i < length; i++) {
			password += allChars[Math.floor(Math.random() * allChars.length)];
		}

		// Shuffle the password to avoid predictable patterns
		password = password
			.split('')
			.sort(() => Math.random() - 0.5)
			.join('');

		return password;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Random password generation failed:', errorMessage);
		throw error;
	} finally {
		console.debug('Random password generation process completed');
	}
}

// Export functions
module.exports = {
	hashPassword,
	verifyPassword,
	validatePasswordStrength,
	generateRandomPassword,
};
