/**
 * Settings-specific password reset form component
 * Designed for logged-in users who want to reset their password from settings
 * Automatically uses the user's current email and manages step transitions
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Shield, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button, Input } from '../ui';
import { 
    resetPasswordWithOtpSchema,
    type ResetPasswordWithOtpFormData 
} from '../../lib/validations';
import { useAuth } from '../../contexts/AuthContext';

interface SettingsPasswordResetFormProps {
    onComplete?: () => void;
    onCancel?: () => void;
    loading?: boolean;
}

/**
 * Settings password reset form for authenticated users
 * Automatically uses current user's email and manages the flow state
 * @param onComplete - Called when password reset is successfully completed
 * @param onCancel - Called when user cancels the process
 * @param loading - External loading state
 * @returns SettingsPasswordResetForm JSX element
 */
export function SettingsPasswordResetForm({
    onComplete,
    onCancel,
    loading = false,
}: SettingsPasswordResetFormProps) {
    try {
        const {
            user,
            passwordResetStep,
            passwordResetEmail,
            requestPasswordReset,
            completePasswordReset,
            setPasswordResetEmail,
            clearPasswordResetState,
            isLoading
        } = useAuth();

        const [localLoading, setLocalLoading] = React.useState(false);
        const effectiveLoading = loading || isLoading || localLoading;

        // OTP state management for individual digit inputs
        const [otp, setOtp] = React.useState(['', '', '', '', '', '']);
        const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

        // Password strength indicator
        const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
            try {
                if (!password) return { strength: 0, label: '', color: '' };
                
                let strength = 0;
                const checks = [
                    password.length >= 8,
                    /[a-z]/.test(password),
                    /[A-Z]/.test(password),
                    /\d/.test(password),
                    /[!@#$%^&*(),.?":{}|<>]/.test(password)
                ];
                
                strength = checks.filter(Boolean).length;
                
                if (strength <= 2) {
                    return { strength, label: 'Weak', color: 'text-red-500' };
                } else if (strength <= 3) {
                    return { strength, label: 'Fair', color: 'text-orange-500' };
                } else if (strength <= 4) {
                    return { strength, label: 'Good', color: 'text-blue-500' };
                } else {
                    return { strength, label: 'Strong', color: 'text-green-600' };
                }
            } catch (error) {
                console.error('Password strength calculation error:', error);
                return { strength: 0, label: '', color: '' };
            }
        };

        // Reset password form
        const resetForm = useForm<ResetPasswordWithOtpFormData>({
            resolver: zodResolver(resetPasswordWithOtpSchema),
            defaultValues: {
                otp: '',
                newPassword: '',
                confirmPassword: '',
            },
        });

        // Watch password field for strength calculation
        const newPassword = resetForm.watch('newPassword') || '';
        const passwordStrength = getPasswordStrength(newPassword);

        // Sync OTP state with React Hook Form
        React.useEffect(() => {
            const otpString = otp.join('');
            resetForm.setValue('otp', otpString, { shouldValidate: false });
        }, [otp, resetForm]);

        // Handle OTP input changes
        const handleOtpChange = (index: number, value: string) => {
            try {
                // Only allow digits
                if (value && !/^\d$/.test(value)) return;

                const newOtp = [...otp];
                newOtp[index] = value;
                setOtp(newOtp);

                // Auto-focus next input
                if (value && index < 5) {
                    inputRefs.current[index + 1]?.focus();
                }

                // Auto-submit when all digits are entered
                if (newOtp.every(digit => digit !== '') && newOtp.length === 6) {
                    // Focus next field (password) instead of auto-submit for better UX
                    setTimeout(() => {
                        const passwordInput = document.querySelector('input[name="newPassword"]') as HTMLInputElement;
                        passwordInput?.focus();
                    }, 100);
                }
            } catch (error) {
                console.error('OTP change error:', error);
            }
        };

        // Handle backspace and arrow keys
        const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
            try {
                if (e.key === 'Backspace') {
                    if (!otp[index] && index > 0) {
                        inputRefs.current[index - 1]?.focus();
                    } else {
                        const newOtp = [...otp];
                        newOtp[index] = '';
                        setOtp(newOtp);
                    }
                } else if (e.key === 'ArrowLeft' && index > 0) {
                    inputRefs.current[index - 1]?.focus();
                } else if (e.key === 'ArrowRight' && index < 5) {
                    inputRefs.current[index + 1]?.focus();
                }
            } catch (error) {
                console.error('OTP key down error:', error);
            }
        };

        // Handle paste
        const handleOtpPaste = (e: React.ClipboardEvent) => {
            try {
                e.preventDefault();
                const pastedData = e.clipboardData.getData('text');
                const digits = pastedData.replace(/\D/g, '').slice(0, 6);
                
                if (digits.length === 6) {
                    const newOtp = digits.split('');
                    setOtp(newOtp);
                    
                    // Focus next field after paste
                    setTimeout(() => {
                        const passwordInput = document.querySelector('input[name="newPassword"]') as HTMLInputElement;
                        passwordInput?.focus();
                    }, 100);
                }
            } catch (error) {
                console.error('OTP paste error:', error);
            }
        };

        // Initialize password reset flow with user's current email
        React.useEffect(() => {
            if (user?.email && !passwordResetEmail) {
                setPasswordResetEmail(user.email);
            }
        }, [user?.email, passwordResetEmail, setPasswordResetEmail]);

        const handleSendResetCode = async () => {
            try {
                if (!user?.email) {
                    throw new Error('User email not available');
                }

                setLocalLoading(true);
                await requestPasswordReset(user.email);
            } catch (error) {
                console.error('Send reset code error:', error);
                // Error handling is done by AuthContext (toast shown)
            } finally {
                setLocalLoading(false);
            }
        };

        const handleResetSubmit = async (data: ResetPasswordWithOtpFormData) => {
            try {
                if (!passwordResetEmail) {
                    throw new Error('Password reset email not set');
                }

                // Ensure we use the latest OTP from state if form data is incomplete
                const currentOtp = otp.join('');
                const submitOtp = data.otp || currentOtp;

                // Validate OTP length
                if (submitOtp.length !== 6) {
                    resetForm.setError('otp', { message: 'Please enter the complete 6-digit code' });
                    return;
                }

                setLocalLoading(true);
                await completePasswordReset(passwordResetEmail, submitOtp, data.newPassword);
                
                // Call completion callback
                onComplete?.();
                
            } catch (error) {
                console.error('Reset password error:', error);
                // Error handling is done by AuthContext (toast shown)
            } finally {
                setLocalLoading(false);
            }
        };

        const handleCancel = () => {
            try {
                clearPasswordResetState();
                resetForm.reset();
                setOtp(['', '', '', '', '', '']);
                onCancel?.();
            } catch (error) {
                console.error('Cancel password reset error:', error);
            }
        };

        return (
            <div className="space-y-6 max-w-md mx-auto">
                {/* Progress indicator */}
                <div className="flex items-center justify-center space-x-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors border-2 ${
                        passwordResetStep === 'email' 
                            ? 'bg-gray-800 text-white border-gray-800' 
                            : 'bg-gray-600 text-white border-gray-600'
                    }`}>
                        {passwordResetStep === 'email' ? '1' : <CheckCircle className="w-4 h-4" />}
                    </div>
                    <div className={`w-12 h-0.5 transition-colors ${
                        passwordResetStep === 'otp_verification' ? 'bg-gray-800' : 'bg-gray-300'
                    }`} />
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors border-2 ${
                        passwordResetStep === 'otp_verification' 
                            ? 'bg-gray-800 text-white border-gray-800' 
                            : 'bg-gray-100 text-gray-500 border-gray-300'
                    }`}>
                        2
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* Send reset code step - automatically uses user's email */}
                    {passwordResetStep === 'email' && (
                        <motion.div
                            key="email-step"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Reset your password
                                </h3>
                                <p className="text-sm text-gray-600">
                                    We'll send a verification code to your email address:
                                </p>
                                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                            </div>

                            <div className="space-y-4">
                                <Button
                                    onClick={handleSendResetCode}
                                    fullWidth
                                    loading={effectiveLoading}
                                    disabled={!user?.email}
                                >
                                    Send reset code
                                </Button>

                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Cancel
                                    </button>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex">
                                    <Shield className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div className="ml-3">
                                        <h4 className="text-sm font-medium text-blue-800">
                                            Security Notice
                                        </h4>
                                        <p className="text-sm text-blue-700 mt-1">
                                            The verification code will expire in 10 minutes. 
                                            Please check your spam folder if you don't see the email.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Reset password step */}
                    {passwordResetStep === 'otp_verification' && (
                        <motion.div
                            key="reset-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-6"
                        >
                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Set new password
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Enter the verification code sent to
                                </p>
                                <p className="text-sm font-medium text-gray-900">{passwordResetEmail || user?.email}</p>
                            </div>

                            <form onSubmit={resetForm.handleSubmit(handleResetSubmit)} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Verification code
                                    </label>
                                    <div className="flex justify-center space-x-2">
                                        {otp.map((digit, index) => (
                                            <input
                                                key={index}
                                                ref={(el) => { inputRefs.current[index] = el; }}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={1}
                                                value={digit}
                                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                                onPaste={index === 0 ? handleOtpPaste : undefined}
                                                className="w-12 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-colors"
                                                autoFocus={index === 0}
                                                disabled={effectiveLoading}
                                            />
                                        ))}
                                    </div>
                                    {resetForm.formState.errors.otp && (
                                        <p className="text-sm text-red-500 text-center mt-2">
                                            {resetForm.formState.errors.otp.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <Input
                                        {...resetForm.register('newPassword')}
                                        type="password"
                                        label="New password"
                                        placeholder="Enter new password"
                                        startIcon={<Lock className="h-4 w-4" />}
                                        error={resetForm.formState.errors.newPassword?.message}
                                        fullWidth
                                        autoComplete="new-password"
                                    />
                                    
                                    {/* Password strength indicator */}
                                    {newPassword && (
                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                                    <div
                                                        className={`h-1.5 rounded-full transition-all duration-300 ${
                                                            passwordStrength.strength <= 2
                                                                ? 'bg-red-500'
                                                                : passwordStrength.strength <= 3
                                                                ? 'bg-orange-500'
                                                                : passwordStrength.strength <= 4
                                                                ? 'bg-blue-500'
                                                                : 'bg-green-600'
                                                        }`}
                                                        style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-medium ${passwordStrength.color}`}>
                                                    {passwordStrength.label}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <Input
                                    {...resetForm.register('confirmPassword')}
                                    type="password"
                                    label="Confirm new password"
                                    placeholder="Confirm new password"
                                    startIcon={<Lock className="h-4 w-4" />}
                                    error={resetForm.formState.errors.confirmPassword?.message}
                                    fullWidth
                                    autoComplete="new-password"
                                />

                                <Button
                                    type="submit"
                                    fullWidth
                                    loading={effectiveLoading}
                                    disabled={effectiveLoading || otp.join('').length !== 6 || !resetForm.watch('newPassword') || !resetForm.watch('confirmPassword')}
                                >
                                    Reset password
                                </Button>
                            </form>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Cancel
                                </button>
                            </div>

                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex">
                                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                                    <div className="ml-3">
                                        <h4 className="text-sm font-medium text-green-800">
                                            Almost done!
                                        </h4>
                                        <p className="text-sm text-green-700 mt-1">
                                            Your new password must be at least 8 characters long and contain uppercase, 
                                            lowercase, number, and special character.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    } catch (error) {
        console.error('SettingsPasswordResetForm render error:', error);
        
        return (
            <div className="space-y-4">
                <p className="text-sm text-red-600">
                    Something went wrong. Please refresh the page and try again.
                </p>
                <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    fullWidth
                >
                    Refresh page
                </Button>
            </div>
        );
    }
}