/**
 * OTP (One-Time Password) generation and validation utilities
 * Handles 6-digit OTP codes with configurable expiry and rate limiting
 * 
 * This module provides comprehensive OTP functionality including:
 * - Secure 6-digit OTP code generation
 * - Database storage with expiry timestamps
 * - Email delivery with customizable templates
 * - Rate limiting and attempt tracking
 * - Automatic cleanup of expired tokens
 */

const { getDatabase } = require('../../database/connection');


// OTP configuration constants


// OTP configuration

const OTP_CONFIG = {
    LENGTH: 6,
    EXPIRY_MINUTES: 5,
    MAX_ATTEMPTS: 3,
    RATE_LIMIT_WINDOW_MINUTES: 5,
    MAX_REQUESTS_PER_WINDOW: 3,
    DEVELOPMENT_MAX_ATTEMPTS: 10
};


/**
 * Generate 6-digit OTP code
 * @returns {string} 6-digit OTP code
 */
function generateOTPCode() {
    try {
        // Generate random 6-digit number between 100000 and 999999
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const otp = randomNum.toString();
        
        // Validate OTP format
        if (otp.length !== OTP_CONFIG.LENGTH || !/^\d{6}$/.test(otp)) {
            throw new Error('Generated OTP does not meet format requirements');
        }
        
        return otp;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('OTP code generation failed:', errorMessage);
        throw error;
    } finally {
        console.debug('OTP code generation process completed');
    }
}


/**
 * Store OTP in database for user
 * @param {number} userId - User ID
 * @param {string} email - User email
 * @param {string} otp - Generated OTP code
 * @returns {Promise<void>}
 */
async function storeOTP(userId, email, otp) {
    try {
        if (!userId || !email || !otp) {
            throw new Error('Missing required parameters: userId, email, and otp are all required');
        }
        
        if (typeof userId !== 'number' || userId <= 0) {
            throw new Error('userId must be a positive number');
        }
        
        // Normalize OTP to handle any whitespace
        const normalizedOTP = otp.trim();
        
        if (normalizedOTP.length !== OTP_CONFIG.LENGTH || !/^\d{6}$/.test(normalizedOTP)) {
            throw new Error('OTP must be exactly 6 digits');
        }
        
        const db = getDatabase();
        const expiresAt = new Date(Date.now() + OTP_CONFIG.EXPIRY_MINUTES * 60 * 1000);
        
        // Invalidate any existing OTPs for this user
        const invalidateExisting = db.prepare(`
            UPDATE auth_tokens 
            SET is_used = 1 
            WHERE user_id = ? AND token_type = 'otp' AND is_used = 0
        `);
        
        invalidateExisting.run(userId);
        
        // Store new OTP
        const insertOTP = db.prepare(`
            INSERT INTO auth_tokens (user_id, token, token_type, expires_at)
            VALUES (?, ?, 'otp', ?)
        `);
        
        insertOTP.run(userId, normalizedOTP, expiresAt.toISOString());
        
        console.log(`OTP stored successfully for user ${userId}:`, {
            email: email,
            expiresAt: expiresAt.toISOString(),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('OTP storage failed:', errorMessage);
        throw error;
    } finally {
        console.debug('OTP storage process completed');
    }
}


/**
 * Verify OTP code for user
 * @param {string} email - User email
 * @param {string} otp - OTP code to verify
 * @returns {Promise<Object>} Verification result with success status and user data
 */
async function verifyOTP(email, otp) {
    try {
        if (!email || !otp) {
            throw new Error('Email and OTP are required');
        }
        
        // Normalize email input to handle case sensitivity and whitespace
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedOTP = otp.trim();
        
        // Log OTP verification attempt for security monitoring
        console.log('OTP verification attempt:', {
            email: normalizedEmail,
            timestamp: new Date().toISOString()
        });
        
        const db = getDatabase();
        
        // Get user first - use COLLATE NOCASE for case-insensitive email matching
        const user = /** @type {{id: number, email: string, first_name: string, last_name: string, is_verified: number} | undefined} */ (db.prepare(`
            SELECT id, email, first_name, last_name, is_verified
            FROM users 
            WHERE LOWER(TRIM(email)) = ?
        `).get(normalizedEmail));
        
        // Log user lookup result for debugging
        if (!user) {
            console.warn('OTP verification failed - user not found:', {
                email: normalizedEmail,
                timestamp: new Date().toISOString()
            });
        }
        
        if (!user) {
            return {
                success: false,
                message: 'User not found or no valid OTP exists'
            };
        }
        
        // Get user's latest valid OTP
        const validOTP = /** @type {{token: string, expires_at: string, is_used: number} | undefined} */ (db.prepare(`
            SELECT token, expires_at, is_used
            FROM auth_tokens 
            WHERE user_id = ? 
                AND token_type = 'otp' 
                AND is_used = 0 
                AND expires_at > datetime('now')
            ORDER BY created_at DESC
            LIMIT 1
        `).get(user.id));
        
        // Additional safety check: verify OTP hasn't expired (double-check)
        if (validOTP && validOTP.expires_at) {
            const expirationTime = new Date(validOTP.expires_at);
            const currentTime = new Date();
            if (currentTime > expirationTime) {
                console.warn('OTP verification failed - expired after retrieval:', {
                    userId: user.id,
                    email: normalizedEmail,
                    expiresAt: validOTP.expires_at,
                    currentTime: currentTime.toISOString()
                });
                return {
                    success: false,
                    message: 'OTP has expired. Please request a new verification code.'
                };
            }
        }
        
        // Get attempt count
        const attemptCount = /** @type {{count: number}} */ (db.prepare(`
            SELECT COUNT(*) as count
            FROM auth_tokens 
            WHERE user_id = ? 
                AND token_type = 'otp' 
                AND created_at > datetime('now', '-1 hour')
        `).get(user.id));
        
        // Log excessive attempt count for security monitoring
        const maxAttempts = process.env.NODE_ENV === 'development' 
            ? OTP_CONFIG.DEVELOPMENT_MAX_ATTEMPTS 
            : OTP_CONFIG.MAX_ATTEMPTS;
        
        if (attemptCount.count >= maxAttempts) {
            console.warn('OTP verification blocked - too many attempts:', {
                userId: user.id,
                email: normalizedEmail,
                attemptCount: attemptCount.count,
                maxAttempts: maxAttempts,
                timestamp: new Date().toISOString()
            });
        }
        
        // Combine the results
        const userWithOTP = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            is_verified: user.is_verified,
            token: validOTP?.token || null,
            expires_at: validOTP?.expires_at || null,
            is_used: validOTP?.is_used || null,
            attempt_count: attemptCount.count
        };
        
        // No need to check !userWithOTP since we always have user data now
        
        // Check attempt limit with environment-specific configuration
        if (userWithOTP.attempt_count >= maxAttempts) {
            return {
                success: false,
                message: 'Too many OTP attempts. Please request a new verification code.'
            };
        }
        
        
        // Check if OTP exists and matches
        if (!userWithOTP.token || userWithOTP.token !== normalizedOTP) {
            // Log failed OTP verification for security monitoring
            console.warn('OTP verification failed:', {
                userId: user.id,
                email: normalizedEmail,
                reason: userWithOTP.token ? 'invalid_code' : 'no_valid_otp',
                timestamp: new Date().toISOString()
            });
            
            return {
                success: false,
                message: userWithOTP.token ? 'Invalid OTP code' : 'No valid OTP exists for this user'
            };
        }
        
        // Mark OTP as used
        const markUsed = db.prepare(`
            UPDATE auth_tokens 
            SET is_used = 1 
            WHERE user_id = ? AND token = ? AND token_type = 'otp'
        `);
        
        markUsed.run(userWithOTP.id, normalizedOTP);
        
        // Mark user as verified if not already
        if (!userWithOTP.is_verified) {
            const markVerified = db.prepare(`
                UPDATE users 
                SET is_verified = 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            
            markVerified.run(userWithOTP.id);
        }
        
        return {
            success: true,
            message: 'OTP verified successfully',
            user: {
                id: userWithOTP.id,
                email: userWithOTP.email,
                firstName: userWithOTP.first_name,
                lastName: userWithOTP.last_name,
                isVerified: true
            }
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('OTP verification failed:', errorMessage);
        throw error;
    } finally {
        console.debug('OTP verification process completed');
    }
}


/**
 * Check if user can request new OTP (rate limiting)
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Rate limit check result
 */
async function checkOTPRateLimit(userId) {
    try {
        if (!userId) {
            throw new Error('User ID is required');
        }
        
        const db = getDatabase();
        
        // Check recent OTP requests within configured time window
        const recentRequests = /** @type {{count: number}} */ (db.prepare(`
            SELECT COUNT(*) as count
            FROM auth_tokens
            WHERE user_id = ? 
            AND token_type = 'otp'
            AND created_at > datetime('now', '-${OTP_CONFIG.RATE_LIMIT_WINDOW_MINUTES} minutes')
        `).get(userId));
        
        const maxRequestsPerWindow = OTP_CONFIG.MAX_REQUESTS_PER_WINDOW;
        const canRequest = recentRequests.count < maxRequestsPerWindow;
        
        return {
            canRequest,
            remainingRequests: Math.max(0, maxRequestsPerWindow - recentRequests.count),
            message: canRequest 
                ? 'OTP request allowed' 
                : 'Too many OTP requests. Please wait before requesting again.'
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('OTP rate limit check failed:', errorMessage);
        throw error;
    } finally {
        console.debug('OTP rate limit check process completed');
    }
}


/**
 * Get email template based on purpose
 * @param {string} purpose - Email purpose
 * @param {string} email - Recipient email
 * @param {string} otp - OTP code
 * @returns {Object} Email template with subject and content
 */
function getEmailTemplate(purpose, email, otp) {
    const templates = {
        signup_verification: {
            subject: 'Welcome! Verify your email to get started',
            content: [
                `🎉 Welcome to our platform!`,
                ``,
                `Thanks for signing up! To complete your account setup and start using all our features, please verify your email address.`,
                ``,
                `Your verification code is: ${otp}`,
                ``,
                `This code will expire in ${OTP_CONFIG.EXPIRY_MINUTES} minutes for security.`,
                ``,
                `Once verified, you'll be automatically logged in and ready to go!`,
                ``,
                `If you didn't sign up for an account, please ignore this email.`
            ]
        },
        login_otp: {
            subject: 'Your login verification code',
            content: [
                `🔐 Secure Login Verification`,
                ``,
                `Someone is trying to log into your account. For security, please verify it's you.`,
                ``,
                `Your login verification code is: ${otp}`,
                ``,
                `This code will expire in ${OTP_CONFIG.EXPIRY_MINUTES} minutes.`,
                ``,
                `If this wasn't you, please secure your account immediately.`,
                ``,
                `Never share this code with anyone.`
            ]
        },
        password_reset: {
            subject: 'Reset your password',
            content: [
                `🔑 Password Reset Request`,
                ``,
                `You requested to reset your password. Use the code below to proceed:`,
                ``,
                `Your password reset code is: ${otp}`,
                ``,
                `This code will expire in ${OTP_CONFIG.EXPIRY_MINUTES} minutes.`,
                ``,
                `If you didn't request a password reset, please ignore this email and consider securing your account.`,
                ``,
                `Keep this code confidential and don't share it with anyone.`
            ]
        },
        email_change_verification: {
            subject: 'Verify your new email address',
            content: [
                `🔄 Email Change Verification`,
                ``,
                `You requested to change your email address. To complete this process, please verify your new email address.`,
                ``,
                `Your verification code is: ${otp}`,
                ``,
                `This code will expire in ${OTP_CONFIG.EXPIRY_MINUTES} minutes.`,
                ``,
                `If you didn't request this change, please ignore this email and secure your account immediately.`,
                ``,
                `Keep this code confidential and don't share it with anyone.`
            ]
        },
        verification: {
            subject: 'Your verification code',
            content: [
                `📧 Email Verification`,
                ``,
                `Your verification code is: ${otp}`,
                ``,
                `This code will expire in ${OTP_CONFIG.EXPIRY_MINUTES} minutes.`,
                ``,
                `Please use this code to complete your verification process.`
            ]
        }
    };
    
    return templates[purpose] || templates.verification;
}


/**
 * Send OTP via email (simulated with console.log for now)
 * @param {string} email - Recipient email
 * @param {string} otp - OTP code
 * @param {string} purpose - OTP purpose (signup_verification, login_otp, password_reset, email_change_verification, verification)
 * @returns {Promise<void>}
 */
async function sendOTPEmail(email, otp, purpose = 'verification') {
    try {
        if (!email || !otp) {
            throw new Error('Email and OTP are required');
        }
        
        const template = getEmailTemplate(purpose, email, otp);
        
        // Simulate email sending with enhanced console output
        console.log('\n' + '='.repeat(50));
        console.log(`📧 EMAIL SIMULATION - ${purpose.toUpperCase()}`);
        console.log('='.repeat(50));
        console.log(`To: ${email}`);
        console.log(`Subject: ${template.subject}`);
        console.log('');
        console.log('Content:');
        console.log('-'.repeat(30));
        template.content.forEach(line => console.log(line));
        console.log('-'.repeat(30));
        console.log('');
        console.log(`🕒 This ${purpose} code expires in ${OTP_CONFIG.EXPIRY_MINUTES} minutes`);
        console.log('='.repeat(50));
        console.log('');
        
        // In production, integrate with email service provider:
        // - SendGrid, Mailgun, Amazon SES, etc.
        // - Use HTML templates for better presentation
        // - Add proper error handling for email delivery failures
        // - Use template.subject and template.content for email content
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('OTP email sending failed:', errorMessage);
        throw error;
    } finally {
        console.debug('OTP email sending process completed');
    }
}


/**
 * Clean up expired OTPs from database
 * @returns {Promise<void>}
 */
async function cleanupExpiredOTPs() {
    try {
        const db = getDatabase();
        
        const deleteExpired = db.prepare(`
            DELETE FROM auth_tokens 
            WHERE token_type = 'otp' 
            AND expires_at < datetime('now')
        `);
        
        const result = deleteExpired.run();
        
        if (result.changes > 0) {
            console.log(`Cleaned up ${result.changes} expired OTP records`);
        }
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('OTP cleanup failed:', errorMessage);
        throw error;
    } finally {
        console.debug('OTP cleanup process completed');
    }
}



// Export all OTP utility functions
module.exports = {
    // Core OTP functions
    generateOTPCode,
    storeOTP,
    verifyOTP,
    
    // Rate limiting and management
    checkOTPRateLimit,
    cleanupExpiredOTPs,
    
    // Communication
    sendOTPEmail
};