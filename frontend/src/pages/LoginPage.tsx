/**
 * Login page component
 * Handles the complete login flow including OTP verification
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { LoginForm, OTPForm } from '../components/forms';
import { useAuth } from '../hooks';
import { type LoginFormData } from '../lib/validations';

/**
 * Login page with multi-step authentication flow
 * @returns LoginPage JSX element
 */
export function LoginPage() {
    try {
        // Use AuthContext state instead of local state to prevent remounting issues
        const [resendCooldown, setResendCooldown] = useState(0);
        
        // Use ref to prevent unnecessary re-renders from auth state changes
        const isProcessingOTP = useRef(false);
        
        
        const navigate = useNavigate();
        const location = useLocation();
        const { login, sendOTP, verifyOTP, isLoading, loginStep, loginEmail, setLoginStep, setLoginEmail, clearLoginState } = useAuth();

        // Get redirect path from location state
        const from = (location.state as any)?.from || '/dashboard';

        const handlePasswordLogin = async (data: LoginFormData) => {
            try {
                const result = await login(data.email, data.password);
                
                // Check if verification is required
                if (result?.requiresVerification && result?.redirectToOTP) {
                    // AuthContext automatically sets loginStep to 'otp_verification' and loginEmail
                    // Send OTP for verification
                    try {
                        await sendOTP(result.email || data.email);
                        startResendCooldown();
                    } catch (otpError) {
                        console.error('Auto OTP send error:', otpError);
                        // Don't throw here - user is already on OTP step and can manually request OTP
                    }
                } else {
                    // Normal login success - navigate to dashboard
                    navigate(from, { replace: true });
                }
            } catch (error) {
                console.error('Password login error:', error);
            }
        };

        const handleOTPRequest = useCallback(async (email: string) => {
            try {
                
                // Set processing flag to prevent state conflicts
                isProcessingOTP.current = true;
                
                // Send OTP first
                await sendOTP(email);
                
                // After successful OTP send, set AuthContext state to transition to OTP step
                setLoginEmail(email);
                setLoginStep('otp_verification');
                
                startResendCooldown();
                
                // Clear processing flag
                isProcessingOTP.current = false;
            } catch (error) {
                console.error('LoginPage: OTP request error:', error);
                // Reset state on error
                isProcessingOTP.current = false;
                clearLoginState(); // Reset to login step
                throw error;
            }
        }, [sendOTP, setLoginEmail, setLoginStep, clearLoginState]);

        const handleOTPVerify = async ({ email, otp }: { email: string; otp: string }) => {
            try {
                await verifyOTP(email, otp);
                navigate(from, { replace: true });
            } catch (error) {
                console.error('OTP verify error:', error);
                throw error;
            }
        };

        const handleResendOTP = async () => {
            try {
                await sendOTP(loginEmail);
                startResendCooldown();
            } catch (error) {
                console.error('Resend OTP error:', error);
                throw error;
            }
        };

        const handleBackToLogin = () => {
            try {
                clearLoginState(); // Reset to login step and clear email
                setResendCooldown(0);
                isProcessingOTP.current = false;
            } catch (error) {
                console.error('Back to login error:', error);
            }
        };

        const handleSwitchToSignup = () => {
            try {
                navigate('/signup', { 
                    state: { from } 
                });
            } catch (error) {
                console.error('Switch to signup error:', error);
            }
        };

        const handleForgotPassword = () => {
            try {
                navigate('/forgot-password');
            } catch (error) {
                console.error('Switch to forgot password error:', error);
            }
        };

        const startResendCooldown = () => {
            try {
                setResendCooldown(60); // 60 seconds cooldown
                
                const interval = setInterval(() => {
                    setResendCooldown(prev => {
                        if (prev <= 1) {
                            clearInterval(interval);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } catch (error) {
                console.error('Resend cooldown error:', error);
            }
        };


        // Login step
        if (loginStep === 'login') {
            return (
                <AuthLayout
                    title="Welcome back"
                    subtitle="Sign in to your account to continue"
                >
                    <LoginForm
                        onPasswordLogin={handlePasswordLogin}
                        onOTPRequest={handleOTPRequest}
                        onSwitchToSignup={handleSwitchToSignup}
                        onForgotPassword={handleForgotPassword}
                        loading={isLoading}
                    />
                </AuthLayout>
            );
        }

        // OTP verification step
        if (loginStep === 'otp_verification') {
            return (
                <AuthLayout
                    title="Verify your identity"
                    subtitle="Enter the code we sent to your email"
                    showBackButton
                    onBack={handleBackToLogin}
                >
                    <OTPForm
                        email={loginEmail}
                        onVerifyOTP={handleOTPVerify}
                        onResendOTP={handleResendOTP}
                        onBack={handleBackToLogin}
                        loading={isLoading}
                        resendDisabled={resendCooldown > 0}
                        timeLeft={resendCooldown}
                    />
                </AuthLayout>
            );
        }

        return null;
    } catch (error) {
        console.error('LoginPage render error:', error);
        
        return (
            <AuthLayout
                title="Sign in"
                subtitle="Welcome back"
            >
                <div className="text-center space-y-4">
                    <p className="text-sm text-error-600">
                        Something went wrong. Please refresh the page and try again.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        Refresh page
                    </button>
                </div>
            </AuthLayout>
        );
    }
}