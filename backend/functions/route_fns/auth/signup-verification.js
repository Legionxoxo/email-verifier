/**
 * Signup verification route functions
 * Handles email verification during signup process with automatic login and Razorpay customer creation
 * 
 * This module contains the signup verification functionality that:
 * - Verifies OTP codes sent during signup process
 * - Marks users as verified and creates Razorpay customers
 * - Automatically logs in users after successful verification
 * - Handles graceful fallback if Razorpay customer creation fails
 */

const { getDatabase } = require('../../../database/connection');
const { verifyOTP } = require('../../utils/otp');
const { generateAccessToken, generateRefreshToken } = require('../../utils/jwt');
const { createRazorpayCustomer } = require('../../utils/razorpay');


// Constants for verification configuration

const VERIFICATION_CONFIG = {
    RAZORPAY_CUSTOMER_SOURCE: 'signup_verification',
    DEFAULT_CUSTOMER_NAME_FALLBACK: 'User'
};


/**
 * Handle signup email verification with automatic login
 * Verifies OTP code, creates Razorpay customer, marks user as verified, and logs them in
 * 
 * @param {import('express').Request} req - Express request object with verification data
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with user data and auth tokens
 */
async function handleSignupVerification(req, res) {
    try {
        const { email, otp } = req.body;
        
        if (!email || !otp) {
            res.status(400).json({
                success: false,
                message: 'Email and verification code are required'
            });
            return;
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        const normalizedOTP = otp.toString().trim();
        
        if (normalizedOTP.length !== 6 || !/^\d{6}$/.test(normalizedOTP)) {
            res.status(400).json({
                success: false,
                message: 'Verification code must be 6 digits'
            });
            return;
        }
        
        
        // Verify OTP code with the auth system
        
        const verificationResult = await verifyOTP(normalizedEmail, normalizedOTP);
        
        if (!verificationResult.success) {
            res.status(400).json({
                success: false,
                message: verificationResult.message || 'Invalid verification code'
            });
            return;
        }
        
        const user = verificationResult.user;
        
        if (!user || !user.id) {
            throw new Error('Invalid user data received from OTP verification');
        }
        
        const db = getDatabase();
        
        
        // Create Razorpay customer now that email is verified
        
        let razorpayCustomerId = null;
        try {
            const customerName = user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}`.trim()
                : VERIFICATION_CONFIG.DEFAULT_CUSTOMER_NAME_FALLBACK;
                
            const razorpayCustomer = await createRazorpayCustomer({
                name: customerName,
                email: normalizedEmail,
                notes: {
                    source: VERIFICATION_CONFIG.RAZORPAY_CUSTOMER_SOURCE,
                    user_id: user.id.toString(),
                    created_at: new Date().toISOString()
                }
            });
            
            razorpayCustomerId = razorpayCustomer.id;
            console.log('Razorpay customer created after email verification:', {
                customerId: razorpayCustomerId,
                userId: user.id,
                email: normalizedEmail
            });
        } catch (razorpayError) {
            // Log the error but don't fail the verification process
            const errorMessage = razorpayError instanceof Error ? razorpayError.message : String(razorpayError);
            console.error('Razorpay customer creation failed during signup verification:', {
                error: errorMessage,
                userId: user.id,
                email: normalizedEmail
            });
            // Continue with verification even if Razorpay customer creation fails
        }
        
        
        // Update user record with Razorpay customer ID if available
        
        if (razorpayCustomerId) {
            const updateUser = db.prepare(`
                UPDATE users 
                SET razorpay_customer_id = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `);
            
            const updateResult = updateUser.run(razorpayCustomerId, user.id);
            
            if (updateResult.changes === 0) {
                console.warn('Failed to update user with Razorpay customer ID:', {
                    userId: user.id,
                    customerId: razorpayCustomerId
                });
            }
        }
        
        
        // Generate authentication tokens for automatic login
        
        const tokenPayload = {
            userId: user.id,
            email: normalizedEmail
        };
        
        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = await generateRefreshToken(tokenPayload);
        
        if (!accessToken || !refreshToken) {
            throw new Error('Failed to generate authentication tokens');
        }
        
        
        // Return success response with user data and tokens for automatic login
        
        console.log('Signup verification completed successfully:', {
            userId: user.id,
            email: normalizedEmail,
            hasRazorpayCustomer: !!razorpayCustomerId
        });
        
        res.status(200).json({
            success: true,
            message: 'Email verified successfully! Welcome to your account.',
            data: {
                user: {
                    id: user.id.toString(),
                    email: normalizedEmail,
                    name: user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}`.trim() 
                        : undefined,
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    isVerified: true
                },
                tokens: {
                    accessToken,
                    refreshToken
                },
                accountSetup: {
                    emailVerified: true,
                    razorpayCustomer: !!razorpayCustomerId
                }
            }
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Signup verification failed:', {
            error: errorMessage,
            email: req.body?.email,
            timestamp: new Date().toISOString()
        });
        
        res.status(500).json({
            success: false,
            message: 'Email verification failed. Please try again.'
        });
    } finally {
        console.debug('Signup verification process completed for request');
    }
}



// Export functions
module.exports = {
    handleSignupVerification
};