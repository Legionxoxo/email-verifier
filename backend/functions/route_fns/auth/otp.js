/**
 * OTP (One-Time Password) route functions
 * Handles OTP generation, sending, and verification business logic
 */

const { getDatabase } = require('../../../database/connection');
const { 
    generateOTPCode, 
    storeOTP, 
    verifyOTP, 
    checkOTPRateLimit, 
    sendOTPEmail 
} = require('../../utils/otp');
const { 
    generateAccessToken, 
    generateRefreshToken
} = require('../../utils/jwt');


/**
 * Handle OTP sending
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function handleSendOTP(req, res) {
    try {
        const { email } = req.body;
        
        const db = getDatabase();
        
        // Check if user exists
        const user = /** @type {import('../../utils/jwt').UserRecord | undefined} */ (db.prepare('SELECT id, email, first_name FROM users WHERE email = ?').get(email));
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check rate limit
        const rateLimitCheck = await checkOTPRateLimit(user.id);
        if (!rateLimitCheck.canRequest) {
            return res.status(429).json({
                success: false,
                message: rateLimitCheck.message
            });
        }
        
        // Generate and send OTP
        const otp = generateOTPCode();
        await storeOTP(user.id, email, otp);
        await sendOTPEmail(email, otp, 'verification');
        
        res.json({
            success: true,
            message: 'Verification code sent to your email',
            data: {
                remainingRequests: rateLimitCheck.remainingRequests - 1
            }
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Send OTP failed:', errorMessage);
        
        res.status(500).json({
            success: false,
            message: 'Failed to send verification code'
        });
    } finally {
        console.debug('Send OTP process completed');
    }
}


/**
 * Handle OTP verification
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<import('express').Response | void>}
 */
async function handleVerifyOTP(req, res) {
    try {
        const { email, otp } = req.body;
        
        const verificationResult = await verifyOTP(email, otp);
        
        if (!verificationResult.success) {
            return res.status(400).json({
                success: false,
                message: verificationResult.message
            });
        }
        
        // Generate tokens for the verified user
        const payload = { 
            userId: verificationResult.user.id, 
            email: verificationResult.user.email 
        };
        const accessToken = generateAccessToken(payload);
        const refreshToken = await generateRefreshToken(payload);
        
        res.json({
            success: true,
            message: 'Email verified and login successful',
            data: {
                user: {
                    id: verificationResult.user.id,
                    email: verificationResult.user.email,
                    firstName: verificationResult.user.firstName,
                    lastName: verificationResult.user.lastName,
                    isVerified: verificationResult.user.isVerified
                },
                tokens: {
                    accessToken,
                    refreshToken
                },
                verificationCompleted: true,
                loginMethod: 'otp_verification'
            }
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('OTP verification failed:', errorMessage);
        
        res.status(500).json({
            success: false,
            message: 'Email verification failed'
        });
    } finally {
        console.debug('OTP verification process completed');
    }
}


// Export functions
module.exports = {
    handleSendOTP,
    handleVerifyOTP
};