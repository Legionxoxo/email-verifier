/**
 * Authentication route functions
 * Re-exports all authentication-related business logic from split modules
 */

// Import all functions from the modular auth folder
const {
    handleSignup,
    handleLogin,
    handleSendOTP,
    handleVerifyOTP,
    handleForgotPassword,
    handleResetPassword,
    handleRefreshToken,
    handleLogout,
    handleGetProfile
} = require('./auth/index');


// Re-export all functions for backwards compatibility
module.exports = {
    handleSignup,
    handleLogin,
    handleSendOTP,
    handleVerifyOTP,
    handleForgotPassword,
    handleResetPassword,
    handleRefreshToken,
    handleLogout,
    handleGetProfile
};