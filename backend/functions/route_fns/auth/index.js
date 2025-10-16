/**
 * Authentication route functions index
 * Consolidates all authentication-related route handlers
 */

const { handleSignup, handleResendSignupOTP } = require('./signup');
const { handleSignupVerification } = require('./signup-verification');
const { handleLogin } = require('./login');
const { handleSendOTP, handleVerifyOTP } = require('./otp');
const { handleForgotPassword, handleResetPassword } = require('./password');
const { handleRefreshToken, handleLogout } = require('./tokens');
const { handleGetProfile } = require('./profile');


module.exports = {
    handleSignup,
    handleResendSignupOTP,
    handleSignupVerification,
    handleLogin,
    handleSendOTP,
    handleVerifyOTP,
    handleForgotPassword,
    handleResetPassword,
    handleRefreshToken,
    handleLogout,
    handleGetProfile
};