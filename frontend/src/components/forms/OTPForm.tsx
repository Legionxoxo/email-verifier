/**
 * OTP verification form component
 * Handles 6-digit OTP input with auto-focus and validation
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Button } from '../ui';
import { otpVerificationSchema, type OTPVerificationFormData } from '../../lib/validations';

interface OTPFormProps {
    email: string;
    onVerifyOTP: (data: OTPVerificationFormData) => Promise<void>;
    onResendOTP: () => Promise<void>;
    onBack: () => void;
    loading?: boolean;
    resendDisabled?: boolean;
    timeLeft?: number;
}

/**
 * OTP verification form with individual digit inputs
 * @param email - User email for OTP verification
 * @param onVerifyOTP - Handler for OTP verification
 * @param onResendOTP - Handler for resending OTP
 * @param onBack - Handler to go back
 * @param loading - Loading state
 * @param resendDisabled - Whether resend is disabled
 * @param timeLeft - Seconds left for resend cooldown
 * @returns OTPForm JSX element
 */
export function OTPForm({
    email,
    onVerifyOTP,
    onResendOTP,
    onBack,
    loading = false,
    resendDisabled = false,
    timeLeft = 0,
}: OTPFormProps) {
    try {
        const [otp, setOtp] = React.useState(['', '', '', '', '', '']);
        const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

        const {
            handleSubmit,
            setError,
            clearErrors,
            setValue,
            formState: { errors, isSubmitted },
        } = useForm<OTPVerificationFormData>({
            resolver: zodResolver(otpVerificationSchema),
            mode: 'onSubmit', // Only validate on submit, not on change
            defaultValues: {
                email,
                otp: '',
            },
        });

        // Sync OTP state with React Hook Form
        React.useEffect(() => {
            const otpString = otp.join('');
            setValue('otp', otpString, { shouldValidate: false });
        }, [otp, setValue]);

        const handleOtpChange = (index: number, value: string) => {
            try {
                // Only allow digits
                if (value && !/^\d$/.test(value)) return;

                const newOtp = [...otp];
                newOtp[index] = value;
                setOtp(newOtp);

                // Update React Hook Form value
                const otpString = newOtp.join('');
                setValue('otp', otpString, { shouldValidate: false });

                // Clear any previous errors
                clearErrors('otp');

                // Auto-focus next input
                if (value && index < 5) {
                    inputRefs.current[index + 1]?.focus();
                }

                // Auto-submit when all digits are entered
                if (newOtp.every(digit => digit !== '') && newOtp.length === 6) {
                    const otpString = newOtp.join('');
                    setValue('otp', otpString, { shouldValidate: false });
                    // Use setTimeout to ensure React Hook Form value is updated
                    setTimeout(() => {
                        handleSubmit(async (data) => {
                            await onVerifyOTP(data);
                        })();
                    }, 10);
                }
            } catch (error) {
                console.error('OTP change error:', error);
            }
        };

        const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
            try {
                if (e.key === 'Backspace') {
                    if (!otp[index] && index > 0) {
                        // Move to previous input if current is empty
                        inputRefs.current[index - 1]?.focus();
                    } else {
                        // Clear current input
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
                console.error('Key down error:', error);
            }
        };

        const handlePaste = (e: React.ClipboardEvent) => {
            try {
                e.preventDefault();
                const pastedData = e.clipboardData.getData('text');
                const digits = pastedData.replace(/\D/g, '').slice(0, 6);
                
                if (digits.length === 6) {
                    const newOtp = digits.split('');
                    setOtp(newOtp);
                    setValue('otp', digits, { shouldValidate: false });
                    clearErrors('otp');
                    
                    // Auto-submit if complete
                    setTimeout(() => {
                        handleSubmit(async (data) => {
                            await onVerifyOTP(data);
                        })();
                    }, 100);
                }
            } catch (error) {
                console.error('Paste error:', error);
            }
        };

        const handleFormSubmit = async (data: OTPVerificationFormData) => {
            try {
                // Ensure we use the latest OTP from state if form data is empty/stale
                const currentOtp = otp.join('');
                const submitData = {
                    email: data.email,
                    otp: data.otp || currentOtp
                };
                
                
                // Validate OTP length manually since we're mixing state management
                if (submitData.otp.length !== 6) {
                    setError('otp', { message: 'Please enter the complete 6-digit code' });
                    return;
                }
                
                await onVerifyOTP(submitData);
            } catch (error) {
                console.error('OTP form submit error:', error);
                // Re-throw to let parent handle the error display
                throw error;
            }
        };

        const handleResend = async () => {
            try {
                await onResendOTP();
                setOtp(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
            } catch (error) {
                console.error('Resend OTP error:', error);
            }
        };

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                        Enter verification code
                    </h2>
                    <p className="text-sm text-gray-600">
                        We've sent a 6-digit code to
                    </p>
                    <p className="font-medium text-gray-900">{email}</p>
                </div>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                    {/* OTP Input Grid */}
                    <div className="space-y-4">
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
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    onPaste={index === 0 ? handlePaste : undefined}
                                    className="w-12 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-colors"
                                    autoFocus={index === 0}
                                />
                            ))}
                        </div>
                        
                        {errors.otp && isSubmitted && (
                            <p className="text-sm text-red-500 text-center">
                                {errors.otp.message}
                            </p>
                        )}
                    </div>

                    <Button
                        type="submit"
                        fullWidth
                        loading={loading}
                        disabled={loading}
                    >
                        Verify code
                    </Button>
                </form>

                {/* Resend and back options */}
                <div className="space-y-3 text-center">
                    <div>
                        {resendDisabled ? (
                            <p className="text-sm text-gray-500">
                                Resend code in {timeLeft}s
                            </p>
                        ) : (
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={loading}
                                className="text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                            >
                                Didn't receive the code? Send again
                            </button>
                        )}
                    </div>
                    
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        Use a different email or login method
                    </button>
                </div>

                {/* Helper text */}
                <div className="text-center">
                    <p className="text-xs text-gray-500">
                        The code will expire in 10 minutes
                    </p>
                </div>
            </motion.div>
        );
    } catch (error) {
        console.error('OTPForm render error:', error);
        
        return (
            <div className="space-y-4">
                <p className="text-sm text-error-600">
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