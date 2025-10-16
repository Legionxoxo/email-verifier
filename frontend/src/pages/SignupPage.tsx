/**
 * Signup page component
 * Handles user registration with form validation
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { SignupForm } from '../components/forms';
import { SignupVerificationForm } from '../components/forms/SignupVerificationForm';
import { useAuth } from '../hooks';
import { type RegisterFormData, type OTPVerificationFormData } from '../lib/validations';
import { authApi } from '../lib/api';

/**
 * Signup page component
 * @returns SignupPage JSX element
 */
export function SignupPage() {
    try {
        const navigate = useNavigate();
        const location = useLocation();
        const { 
            register, 
            verifySignupOTP, 
            isLoading, 
            signupStep, 
            signupEmail, 
            clearSignupState 
        } = useAuth();

        // Local state for OTP resend cooldown only
        const [resendDisabled, setResendDisabled] = useState(false);
        const [timeLeft, setTimeLeft] = useState(0);


        // Get redirect path from location state
        const from = (location.state as any)?.from || '/dashboard';

        const handleSignup = async (data: RegisterFormData) => {
            try {
                // Split name into firstName and lastName
                // Handle single names by leaving lastName empty
                const nameParts = data.name ? data.name.trim().split(' ') : ['', ''];
                const firstName = nameParts[0] || '';
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                
                const result = await register(data.email, data.password, firstName, lastName);
                
                if (result.requiresVerification) {
                    startResendCooldown();
                } else {
                    navigate(from, { replace: true });
                }
                
            } catch (error) {
                throw error;
            }
        };

        const handleVerifyOTP = async (data: OTPVerificationFormData) => {
            try {
                await verifySignupOTP(data.email, data.otp);
                // AuthContext automatically clears signup state after successful verification
                // After successful verification, user is automatically logged in
                navigate(from, { replace: true });
            } catch (error) {
                throw error;
            }
        };

        const handleResendOTP = async () => {
            try {
                await authApi.resendSignupOTP(signupEmail);
                startResendCooldown();
            } catch (error) {
                throw error;
            }
        };

        const startResendCooldown = () => {
            setResendDisabled(true);
            setTimeLeft(60); // 60 seconds cooldown
            
            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        setResendDisabled(false);
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        };

        const handleBackToSignup = () => {
            try {
                clearSignupState();
            } catch (error) {
                // Silent error handling
            }
        };

        const handleSwitchToLogin = () => {
            try {
                // Clear AuthContext signup state when switching to login
                clearSignupState();
                navigate('/login', { 
                    state: { from }
                });
            } catch (error) {
                // Silent error handling
            }
        };

        // Render based on AuthContext signup step
        if (signupStep === 'email_verification') {
            return (
                <AuthLayout
                    title="Verify your email"
                    subtitle="Complete your account setup"
                >
                    <SignupVerificationForm
                        email={signupEmail}
                        onVerifyOTP={handleVerifyOTP}
                        onResendOTP={handleResendOTP}
                        onBack={handleBackToSignup}
                        loading={isLoading}
                        resendDisabled={resendDisabled}
                        timeLeft={timeLeft}
                    />
                </AuthLayout>
            );
        }

        return (
            <AuthLayout
                title="Create your account"
                subtitle="Join us and start your journey today"
            >
                <SignupForm
                    onSignup={handleSignup}
                    onSwitchToLogin={handleSwitchToLogin}
                    loading={isLoading}
                />
            </AuthLayout>
        );
    } catch (error) {
        console.error('SignupPage render error:', error);
        
        return (
            <AuthLayout
                title="Sign up"
                subtitle="Create your account"
            >
                <div className="text-center space-y-6 p-6">
                    <div className="text-red-600">
                        <p className="text-lg font-medium mb-2">
                            Something went wrong
                        </p>
                        <p className="text-sm text-gray-600">
                            Please refresh the page and try again. If the problem persists, contact support.
                        </p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors cursor-pointer font-medium"
                    >
                        Refresh Page
                    </button>
                </div>
            </AuthLayout>
        );
    } finally {
        // Component render completed
    }
}