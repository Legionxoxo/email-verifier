/**
 * Change email form component with two-step verification process
 * Step 1: Enter new email and confirm with current password
 * Step 2: Verify with OTP sent to new email address
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Mail, Lock, Shield, ArrowRight, RotateCcw } from 'lucide-react';
import { Button, Input } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { 
    changeEmailStepOneSchema, 
    changeEmailStepTwoSchema,
    type ChangeEmailStepOneFormData,
    type ChangeEmailStepTwoFormData 
} from '../../lib/validations';

interface ChangeEmailFormProps {
    currentEmail: string;
    onStepOneSubmit: (data: ChangeEmailStepOneFormData) => Promise<void>;
    onStepTwoSubmit: (data: ChangeEmailStepTwoFormData) => Promise<void>;
    loading?: boolean;
}

type FormStep = 'step1' | 'step2';

/**
 * Change email form component with two-step verification
 * @param currentEmail - Current user email address
 * @param onStepOneSubmit - Handler for step 1 submission
 * @param onStepTwoSubmit - Handler for step 2 submission  
 * @param loading - Loading state
 * @returns ChangeEmailForm JSX element
 */
export function ChangeEmailForm({
    currentEmail,
    onStepOneSubmit,
    onStepTwoSubmit,
    loading = false,
}: ChangeEmailFormProps) {
    try {
        // Use AuthContext state instead of local state to persist across remounts
        const { 
            emailChangeStep, 
            emailChangeEmail, 
            setEmailChangeStep, 
            setEmailChangeEmail 
        } = useAuth();
        
        // Determine current step based on AuthContext state
        const currentStep: FormStep = emailChangeStep === 'otp_verification' ? 'step2' : 'step1';
        const newEmail = emailChangeEmail;
        const otpSent = emailChangeStep === 'otp_verification';


        // Step 1 form (email + password)
        const step1Form = useForm<ChangeEmailStepOneFormData>({
            resolver: zodResolver(changeEmailStepOneSchema),
            mode: 'onChange',
            defaultValues: {
                newEmail: '',
                currentPassword: '',
            },
        });

        // Step 2 form (OTP verification)
        const step2Form = useForm<ChangeEmailStepTwoFormData>({
            resolver: zodResolver(changeEmailStepTwoSchema),
            mode: 'onChange',
            defaultValues: {
                otp: '',
            },
        });

        // OTP state management for individual digit inputs
        const [otp, setOtp] = React.useState(['', '', '', '', '', '']);
        const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

        // Sync OTP state with React Hook Form
        React.useEffect(() => {
            const otpString = otp.join('');
            step2Form.setValue('otp', otpString, { shouldValidate: false });
        }, [otp, step2Form]);

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
                    setTimeout(() => {
                        handleStep2Submit({ otp: newOtp.join(''), newEmail });
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
                    
                    setTimeout(() => {
                        handleStep2Submit({ otp: digits, newEmail });
                    }, 100);
                }
            } catch (error) {
                console.error('OTP paste error:', error);
            }
        };

        // Step 1 submission handler
        const handleStep1Submit = async (data: ChangeEmailStepOneFormData) => {
            try {
                await onStepOneSubmit(data);
                // AuthContext will handle state transition automatically after successful API call
            } catch (error) {
                console.error('Change email step 1 error:', error);
                throw error;
            }
        };

        // Step 2 submission handler
        const handleStep2Submit = async (data: ChangeEmailStepTwoFormData) => {
            try {
                // Ensure we use the latest OTP from state if form data is incomplete
                const currentOtp = otp.join('');
                const submitData = {
                    otp: data.otp || currentOtp,
                    newEmail
                };

                // Validate OTP length
                if (submitData.otp.length !== 6) {
                    step2Form.setError('otp', { message: 'Please enter the complete 6-digit code' });
                    return;
                }

                await onStepTwoSubmit(submitData);
                // Form will be reset by parent component on success
            } catch (error) {
                console.error('Change email step 2 error:', error);
                throw error;
            }
        };

        // Go back to step 1
        const handleBackToStep1 = () => {
            try {
                setEmailChangeStep('change_request');
                setEmailChangeEmail('');
                step2Form.reset();
                setOtp(['', '', '', '', '', '']);
            } catch (error) {
                console.error('Back to step 1 error:', error);
            }
        };

        // Resend OTP handler
        const handleResendOtp = async () => {
            try {
                if (newEmail) {
                    // Clear OTP inputs
                    setOtp(['', '', '', '', '', '']);
                    // Re-trigger step 1 to resend OTP
                    const step1Data = step1Form.getValues();
                    await onStepOneSubmit(step1Data);
                    // AuthContext will handle state update automatically
                    // Focus first input after successful resend
                    setTimeout(() => inputRefs.current[0]?.focus(), 100);
                }
            } catch (error) {
                console.error('Resend OTP error:', error);
                throw error;
            }
        };

        // Render step 1 form
        const renderStep1 = () => {
            return (
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                >
                    {/* Current email display */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <Mail className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Current Email</span>
                        </div>
                        <p className="text-gray-900 font-medium">{currentEmail}</p>
                    </div>

                    <form 
                        onSubmit={step1Form.handleSubmit(handleStep1Submit)} 
                        className="space-y-4"
                    >
                        {/* New email field */}
                        <Input
                            {...step1Form.register('newEmail')}
                            type="email"
                            label="New email address"
                            placeholder="Enter your new email address"
                            startIcon={<Mail className="h-4 w-4" />}
                            error={step1Form.formState.errors.newEmail?.message}
                            fullWidth
                            autoComplete="email"
                            required
                        />

                        {/* Current password field */}
                        <Input
                            {...step1Form.register('currentPassword')}
                            type="password"
                            label="Current password"
                            placeholder="Confirm with your current password"
                            startIcon={<Lock className="h-4 w-4" />}
                            error={step1Form.formState.errors.currentPassword?.message}
                            fullWidth
                            autoComplete="current-password"
                            required
                        />

                        {/* Security notice */}
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start space-x-3">
                                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-medium text-blue-900">
                                        Email Change Security
                                    </h4>
                                    <p className="text-sm text-blue-700 mt-1">
                                        We'll send a verification code to your new email address to confirm the change. 
                                        You'll need to verify both your current password and the new email.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            fullWidth
                            loading={loading}
                            disabled={!step1Form.formState.isValid}
                            className="flex items-center justify-center space-x-2 cursor-pointer"
                        >
                            <span>Send verification code</span>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </form>
                </motion.div>
            );
        };

        // Render step 2 form
        const renderStep2 = () => {
            return (
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                >
                    {/* Email change summary */}
                    <div className="space-y-3">
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-2 mb-2">
                                <Mail className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">Changing From</span>
                            </div>
                            <p className="text-gray-600">{currentEmail}</p>
                        </div>

                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center space-x-2 mb-2">
                                <Mail className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-700">Changing To</span>
                            </div>
                            <p className="text-green-900 font-medium">{newEmail}</p>
                        </div>
                    </div>

                    {/* OTP sent confirmation */}
                    {otpSent && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start space-x-3">
                                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-medium text-blue-900">
                                        Verification Code Sent
                                    </h4>
                                    <p className="text-sm text-blue-700 mt-1">
                                        We've sent a 6-digit verification code to <strong>{newEmail}</strong>. 
                                        Please check your email and enter the code below.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <form 
                        onSubmit={step2Form.handleSubmit(handleStep2Submit)} 
                        className="space-y-4"
                    >
                        {/* OTP field */}
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
                            {step2Form.formState.errors.otp && (
                                <p className="text-sm text-red-500 text-center mt-2">
                                    {step2Form.formState.errors.otp.message}
                                </p>
                            )}
                        </div>

                        {/* Form actions */}
                        <div className="space-y-3">
                            <Button
                                type="submit"
                                fullWidth
                                loading={loading}
                                disabled={loading || otp.join('').length !== 6}
                                className="cursor-pointer"
                            >
                                Verify and change email
                            </Button>

                            <div className="flex items-center justify-between text-sm">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBackToStep1}
                                    disabled={loading}
                                    className="cursor-pointer"
                                >
                                    Change email address
                                </Button>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleResendOtp}
                                    disabled={loading}
                                    className="flex items-center space-x-1 cursor-pointer"
                                >
                                    <RotateCcw className="h-3 w-3" />
                                    <span>Resend code</span>
                                </Button>
                            </div>
                        </div>
                    </form>
                </motion.div>
            );
        };

        return (
            <div className="space-y-6 max-w-md mx-auto">
                {/* Step indicator */}
                <div className="flex items-center justify-center space-x-2 mb-6">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors border-2 ${
                        currentStep === 'step1' 
                            ? 'bg-gray-800 text-white border-gray-800' 
                            : 'bg-gray-600 text-white border-gray-600'
                    }`}>
                        1
                    </div>
                    <div className={`w-12 h-0.5 transition-colors ${
                        currentStep === 'step2' ? 'bg-gray-800' : 'bg-gray-300'
                    }`} />
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors border-2 ${
                        currentStep === 'step2' 
                            ? 'bg-gray-800 text-white border-gray-800' 
                            : 'bg-gray-100 text-gray-500 border-gray-300'
                    }`}>
                        2
                    </div>
                </div>

                {/* Step titles */}
                <div className="text-center mb-6">
                    <h3 className="text-lg font-medium text-gray-900">
                        {currentStep === 'step1' ? 'Enter New Email' : 'Verify New Email'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                        {currentStep === 'step1' 
                            ? 'Step 1 of 2: Provide new email and confirm password'
                            : 'Step 2 of 2: Enter verification code sent to new email'
                        }
                    </p>
                </div>

                {/* Form content */}
                {currentStep === 'step1' ? renderStep1() : renderStep2()}
            </div>
        );
    } catch (error) {
        console.error('ChangeEmailForm render error:', error);
        
        return (
            <div className="space-y-4">
                <p className="text-sm text-red-600">
                    Something went wrong with the email change form. Please refresh the page and try again.
                </p>
                <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    className="cursor-pointer"
                >
                    Refresh page
                </Button>
            </div>
        );
    }
}