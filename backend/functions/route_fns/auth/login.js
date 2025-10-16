/**
 * User login route functions
 * Handles user authentication business logic
 */

const { getDatabase } = require('../../../database/connection');
const { verifyPassword } = require('../../utils/password');
const { 
    generateAccessToken, 
    generateRefreshToken
} = require('../../utils/jwt');


/**
 * Handle user login
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}
 */
async function handleLogin(req, res) {
    try {
        const { email, password } = req.body;
        
        const db = getDatabase();
        
        // Get user by email
        const user = /** @type {import('../../utils/jwt').UserRecord | undefined} */ (db.prepare(`
            SELECT id, email, first_name, last_name, password_hash, is_verified
            FROM users 
            WHERE email = ?
        `).get(email));
        
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Incorrect email or password. Please check your credentials and try again.'
            });
            return;
        }
        
        // Check if user is verified before verifying password
        if (!user.is_verified) {
            // Verify password first, then redirect to OTP flow
            const isPasswordValid = await verifyPassword(password, user.password_hash);
            if (!isPasswordValid) {
                res.status(401).json({
                    success: false,
                    message: 'Incorrect email or password. Please check your credentials and try again.'
                });
                return;
            }
            
            // Password is correct but account is unverified - redirect to OTP verification
            res.status(200).json({
                success: true,
                message: 'Account verification required',
                code: 'VERIFICATION_REQUIRED',
                data: {
                    email: user.email,
                    requiresVerification: true,
                    redirectToOTP: true,
                    step: 'otp_verification'
                }
            });
            return;
        }
        
        // Verify password
        const isPasswordValid = await verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            console.error('Password verification failed for user:', {
                email: user.email,
                providedPassword: password,
                storedHashLength: user.password_hash.length,
                hashStartsWith: user.password_hash.substring(0, 10)
            });
            res.status(401).json({
                success: false,
                message: 'Incorrect email or password. Please check your credentials and try again.'
            });
            return;
        }
        
        // Generate tokens
        const payload = { userId: user.id, email: user.email };
        const accessToken = generateAccessToken(payload);
        const refreshToken = await generateRefreshToken(payload);
        
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isVerified: Boolean(user.is_verified)
                },
                tokens: {
                    accessToken,
                    refreshToken
                }
            }
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Login failed:', errorMessage);
        
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    } finally {
        console.debug('Login process completed');
    }
}


// Export functions
module.exports = {
    handleLogin
};