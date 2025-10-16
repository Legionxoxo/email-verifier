/**
 * Forgot password form component with two-step flow
 * Step 1: Email input to request password reset
 * Step 2: OTP verification and new password setup
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowRight, ArrowLeft, Shield, CheckCircle } from 'lucide-react';
import { Button, Input } from '../ui';
import { 
    forgotPasswordSchema,
    resetPasswordWithOtpSchema,
    type ForgotPasswordFormData,
    type ResetPasswordWithOtpFormData 
} from '../../lib/validations';

type ForgotPasswordStep = 'email' | 'reset';

interface ForgotPasswordFormProps {
    onSendResetCode: (email: string) => Promise<void>;
    onResetPassword: (data: { email: string; otp: string; newPassword: string }) => Promise<void>;
    onBackToLogin: () => void;
    loading?: boolean;
}

/**
 * Multi-step forgot password form component
 * @param onSendResetCode - Handler to send password reset code
 * @param onResetPassword - Handler to reset password with OTP
 * @param onBackToLogin - Handler to navigate back to login
 * @param loading - Loading state
 * @returns ForgotPasswordForm JSX element
 */
export function ForgotPasswordForm({
    onSendResetCode,
    onResetPassword,
    onBackToLogin,
    loading = false,
}: ForgotPasswordFormProps) {
    try {
        const [step, setStep] = React.useState<ForgotPasswordStep>('email');
        const [userEmail, setUserEmail] = React.useState('');

        // OTP state management for individual digit inputs
        const [otp, setOtp] = React.useState(['', '', '', '', '', '']);
        const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

        // Email step form
        const emailForm = useForm<ForgotPasswordFormData>({
            resolver: zodResolver(forgotPasswordSchema),
            defaultValues: {
                email: '',
            },
        });

        // Reset password step form
        const resetForm = useForm<ResetPasswordWithOtpFormData>({
            resolver: zodResolver(resetPasswordWithOtpSchema),
            defaultValues: {
                otp: '',
                newPassword: '',
                confirmPassword: '',
            },
        });

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

        const handleEmailSubmit = async (data: ForgotPasswordFormData) => {
            try {
                setUserEmail(data.email);
                await onSendResetCode(data.email);
                setStep('reset');
            } catch (error) {
                console.error('Send reset code error:', error);
                // Error is already handled by parent component and toast is shown
            }
        };

        const handleResetSubmit = async (data: ResetPasswordWithOtpFormData) => {
            try {
                // Ensure we use the latest OTP from state if form data is incomplete
                const currentOtp = otp.join('');
                const submitOtp = data.otp || currentOtp;

                // Validate OTP length
                if (submitOtp.length !== 6) {
                    resetForm.setError('otp', { message: 'Please enter the complete 6-digit code' });
                    return;
                }

                await onResetPassword({
                    email: userEmail,
                    otp: submitOtp,
                    newPassword: data.newPassword,
                });
            } catch (error) {
                console.error('Reset password error:', error);
                // Error is already handled by parent component and toast is shown
            }
        };

        const handleBackToEmail = () => {
            try {
                setStep('email');
                resetForm.reset();
                setOtp(['', '', '', '', '', '']);
            } catch (error) {
                console.error('Back to email error:', error);
            }
        };

        return (
            <div className="space-y-6">
                {/* Progress indicator */}
                <div className="flex items-center justify-center space-x-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors border-2 ${
                        step === 'email' 
                            ? 'bg-gray-800 text-white border-gray-800' 
                            : 'bg-gray-600 text-white border-gray-600'
                    }`}>
                        {step === 'email' ? '1' : <CheckCircle className="w-4 h-4" />}
                    </div>
                    <div className={`w-12 h-0.5 transition-colors ${
                        step === 'reset' ? 'bg-gray-800' : 'bg-gray-300'
                    }`} />
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors border-2 ${
                        step === 'reset' 
                            ? 'bg-gray-800 text-white border-gray-800' 
                            : 'bg-gray-100 text-gray-500 border-gray-300'
                    }`}>
                        2
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* Email step */}
                    {step === 'email' && (
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
                                    Enter your email address and we'll send you a verification code to reset your password.
                                </p>
                            </div>

                            <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
                                <Input
                                    {...emailForm.register('email')}
                                    type="email"
                                    label="Email address"
                                    placeholder="you@example.com"
                                    startIcon={<Mail className="h-4 w-4" />}
                                    error={emailForm.formState.errors.email?.message}
                                    fullWidth
                                    autoComplete="email"
                                    autoFocus
                                />

                                <Button
                                    type="submit"
                                    fullWidth
                                    loading={loading}
                                    disabled={!emailForm.watch('email')}
                                >
                                    Send reset code
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </form>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={onBackToLogin}
                                    className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back to login
                                </button>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex">
                                    <Shield className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div className="ml-3">
                                        <h4 className="text-sm font-medium text-blue-800">
                                            Security Notice
                                        </h4>
                                        <p className="text-sm text-blue-700 mt-1">
                                            For your security, the verification code will expire in 10 minutes. 
                                            Please check your spam folder if you don't see the email.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Reset password step */}
                    {step === 'reset' && (
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
                                <p className="text-sm font-medium text-gray-900">{userEmail}</p>
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
                                                disabled={loading}
                                            />
                                        ))}
                                    </div>
                                    {resetForm.formState.errors.otp && (
                                        <p className="text-sm text-red-500 text-center mt-2">
                                            {resetForm.formState.errors.otp.message}
                                        </p>
                                    )}
                                </div>

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
                                    loading={loading}
                                    disabled={loading || otp.join('').length !== 6 || !resetForm.watch('newPassword') || !resetForm.watch('confirmPassword')}
                                >
                                    Reset password
                                </Button>
                            </form>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={handleBackToEmail}
                                    className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Use a different email
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
        console.error('ForgotPasswordForm render error:', error);
        
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