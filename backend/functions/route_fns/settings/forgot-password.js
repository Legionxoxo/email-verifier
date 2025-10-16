/**
 * Password reset functionality for settings
 * Handles forgot password requests and password reset completion
 * 
 * This module provides secure password reset functionality including:
 * - Forgot password OTP generation and email delivery
 * - Password reset with OTP validation
 * - User authentication and token invalidation
 * - Comprehensive error handling and security logging
 */

const bcrypt = require('bcryptjs');
const { getDatabase } = require('../../../database/connection');
const { generateOTPCode, storeOTP, verifyOTP, sendOTPEmail } = require('../../utils/otp');


/**
 * Handle forgot password request
 * Generates OTP and sends it to user's email for password reset
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with success status
 */
async function handleForgotPassword(req, res) {
    try {
        const { email } = req.body;
        
        if (!email) {
            res.status(400).json({
                success: false,
                message: 'Email address is required'
            });
            return;
        }
        
        const db = getDatabase();
        
        // Check if user exists with this email
        const user = /** @type {{id: number, email: string, first_name: string} | undefined} */ (db.prepare(`
            SELECT id, email, first_name, is_verified
            FROM users 
            WHERE email = ?
        `).get(email));
        
        // Always return success to prevent email enumeration attacks
        // But only send actual OTP if user exists
        if (user) {
            // Generate and store OTP
            const otp = generateOTPCode();
            await storeOTP(user.id, user.email, otp);
            
            // Send OTP email with password_reset purpose
            await sendOTPEmail(user.email, otp, 'password_reset');
            
            console.log('Password reset OTP sent successfully:', {
                email: user.email,
                userId: user.id,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log('Password reset attempted for non-existent email:', {
                email: email,
                timestamp: new Date().toISOString()
            });
        }
        
        // Always return success response to prevent email enumeration
        res.json({
            success: true,
            message: 'If an account with this email exists, a password reset code has been sent to your email address.'
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Forgot password request failed:', {
            error: errorMessage,
            email: req.body?.email,
            timestamp: new Date().toISOString()
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to process password reset request. Please try again.'
        });
        return;
        
    } finally {
        console.debug('Forgot password request process completed');
    }
}


/**
 * Handle password reset completion
 * Validates OTP and updates user's password
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with reset status
 */
async function handleResetPassword(req, res) {
    try {
        const { email, otp, newPassword } = req.body;
        
        if (!email || !otp || !newPassword) {
            res.status(400).json({
                success: false,
                message: 'Email, OTP, and new password are required'
            });
            return;
        }
        
        // Verify OTP
        const otpResult = await verifyOTP(email, otp);
        
        if (!otpResult.success) {
            res.status(400).json({
                success: false,
                message: otpResult.message || 'Invalid or expired reset token'
            });
            return;
        }
        
        const db = getDatabase();
        
        // Hash new password
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
        
        // Begin transaction for password reset
        const transaction = db.transaction(() => {
            // Update user's password
            const updatePassword = db.prepare(`
                UPDATE users 
                SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            
            const updateResult = updatePassword.run(newPasswordHash, otpResult.user.id);
            
            if (updateResult.changes === 0) {
                throw new Error('Failed to update password');
            }
            
            // Invalidate all existing refresh tokens for security
            const invalidateTokens = db.prepare(`
                UPDATE auth_tokens 
                SET is_used = 1 
                WHERE user_id = ? AND token_type = 'refresh' AND is_used = 0
            `);
            
            invalidateTokens.run(otpResult.user.id);
            
            // Clean up any remaining OTP tokens for this user
            const cleanupOTPs = db.prepare(`
                UPDATE auth_tokens 
                SET is_used = 1 
                WHERE user_id = ? AND token_type = 'otp' AND is_used = 0
            `);
            
            cleanupOTPs.run(otpResult.user.id);
        });
        
        transaction();
        
        console.log('Password reset completed successfully:', {
            email: email,
            userId: otpResult.user.id,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            message: 'Password has been reset successfully. Please log in with your new password.'
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Password reset failed:', {
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to reset password. Please try again.'
        });
        return;
        
    } finally {
        console.debug('Password reset process completed');
    }
}


/**
 * Create password reset token from email and OTP
 * This is a helper function for frontend to create proper token format
 * 
 * @param {string} email - User email address
 * @param {string} otp - OTP code
 * @returns {string} Base64 encoded token
 */
function createResetToken(email, otp) {
    try {
        const tokenString = `${email}:${otp}`;
        return Buffer.from(tokenString).toString('base64');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Reset token creation failed:', errorMessage);
        throw error;
    } finally {
        console.debug('Reset token creation process completed');
    }
}


// Export route handlers
module.exports = {
    handleForgotPassword,
    handleResetPassword,
    createResetToken
};