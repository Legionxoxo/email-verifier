/**
 * Forgot password page component
 * Handles the complete password reset flow with OTP verification
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { ForgotPasswordForm } from '../components/forms';
import { useAuth } from '../contexts/AuthContext';

/**
 * Forgot password page with multi-step password reset flow
 * @returns ForgotPasswordPage JSX element
 */
export function ForgotPasswordPage() {
    try {
        const navigate = useNavigate();
        const { requestPasswordReset, completePasswordReset, isLoading } = useAuth();
        const [loading, setLoading] = React.useState(false);

        const handleSendResetCode = async (email: string) => {
            try {
                setLoading(true);
                await requestPasswordReset(email);
            } catch (error) {
                console.error('Send reset code error:', error);
                throw error;
            } finally {
                setLoading(false);
            }
        };

        const handleResetPassword = async (resetData: { email: string; otp: string; newPassword: string }) => {
            try {
                setLoading(true);
                await completePasswordReset(resetData.email, resetData.otp, resetData.newPassword);
                
                // Navigate to login page after successful reset
                setTimeout(() => {
                    navigate('/login', { 
                        replace: true,
                        state: { 
                            message: 'Password reset completed successfully. Please log in with your new password.' 
                        }
                    });
                }, 2000);
                
            } catch (error) {
                console.error('Reset password error:', error);
                throw error;
            } finally {
                setLoading(false);
            }
        };

        const handleBackToLogin = () => {
            try {
                navigate('/login', { replace: true });
            } catch (error) {
                console.error('Navigation to login error:', error);
                // Fallback navigation
                window.location.href = '/login';
            }
        };

        return (
            <AuthLayout
                title="Forgot your password?"
                subtitle="No worries, we'll help you reset it"
            >
                <ForgotPasswordForm
                    onSendResetCode={handleSendResetCode}
                    onResetPassword={handleResetPassword}
                    onBackToLogin={handleBackToLogin}
                    loading={loading || isLoading}
                />
            </AuthLayout>
        );
    } catch (error) {
        console.error('ForgotPasswordPage render error:', error);
        
        return (
            <AuthLayout
                title="Forgot your password?"
                subtitle="Something went wrong"
            >
                <div className="text-center space-y-4">
                    <p className="text-sm text-red-600">
                        Something went wrong loading the password reset form. Please refresh the page and try again.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors cursor-pointer"
                    >
                        Refresh page
                    </button>
                </div>
            </AuthLayout>
        );
    }
}