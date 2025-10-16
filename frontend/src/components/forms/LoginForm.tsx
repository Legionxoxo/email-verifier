/**
 * Login form component with email/password or OTP options
 * Implements the two-step login flow as specified
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Mail, ArrowRight } from 'lucide-react';
import { Button, Input } from '../ui';
import { 
    loginMethodSchema, 
    loginSchema, 
    type LoginMethodFormData, 
    type LoginFormData 
} from '../../lib/validations';

interface LoginFormProps {
    onPasswordLogin: (data: LoginFormData) => Promise<void>;
    onOTPRequest: (email: string) => Promise<void>;
    onSwitchToSignup: () => void;
    onForgotPassword?: () => void;
    loading?: boolean;
}

type LoginStep = 'email' | 'password';

/**
 * Multi-step login form component
 * @param onPasswordLogin - Handler for password login
 * @param onOTPRequest - Handler for OTP request
 * @param onSwitchToSignup - Handler to switch to signup
 * @param onForgotPassword - Handler for forgot password navigation
 * @param loading - Loading state
 * @returns LoginForm JSX element
 */
export function LoginForm({
    onPasswordLogin,
    onOTPRequest,
    onSwitchToSignup,
    onForgotPassword,
    loading = false,
}: LoginFormProps) {
    try {
        const [step, setStep] = React.useState<LoginStep>('email');
        const [userEmail, setUserEmail] = React.useState('');

        // Email step form
        const emailForm = useForm<LoginMethodFormData>({
            resolver: zodResolver(loginMethodSchema),
            defaultValues: {
                email: '',
                method: 'password',
            },
        });

        // Password step form
        const passwordForm = useForm<LoginFormData>({
            resolver: zodResolver(loginSchema),
            defaultValues: {
                email: '',
                password: '',
            },
        });

        const handleEmailSubmit = async (data: LoginMethodFormData) => {
            try {
                setUserEmail(data.email);
                
                if (data.method === 'password') {
                    passwordForm.setValue('email', data.email);
                    setStep('password');
                } else {
                    // Request OTP and let parent handle the flow
                    await onOTPRequest(data.email);
                }
            } catch (error) {
                console.error('Email submit error:', error);
                // Error is already handled by parent component and toast is shown
                // User stays on current form to retry
            }
        };

        const handlePasswordSubmit = async (data: LoginFormData) => {
            try {
                await onPasswordLogin(data);
            } catch (error) {
                console.error('Password login error:', error);
            }
        };

        const handleBackToEmail = () => {
            try {
                setStep('email');
                setUserEmail('');
                emailForm.reset();
                passwordForm.reset();
            } catch (error) {
                console.error('Back to email error:', error);
            }
        };


        // Email step
        if (step === 'email') {
            return (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                >
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

                        <div className="space-y-3">
                            <p className="text-sm text-gray-600">
                                How would you like to continue?
                            </p>
                            
                            <div className="space-y-2">
                                <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                                    <input
                                        {...emailForm.register('method')}
                                        type="radio"
                                        value="password"
                                        className="text-primary-600"
                                    />
                                    <span className="text-sm text-gray-700">
                                        Continue with password
                                    </span>
                                </label>
                                
                                <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                                    <input
                                        {...emailForm.register('method')}
                                        type="radio"
                                        value="otp"
                                        className="text-primary-600"
                                    />
                                    <span className="text-sm text-gray-700">
                                        Send me a login code
                                    </span>
                                </label>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            fullWidth
                            loading={loading}
                            disabled={!emailForm.watch('email')}
                        >
                            Continue
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </form>

                    <div className="text-center">
                        <span className="text-sm text-gray-600">
                            Don't have an account?{' '}
                            <button
                                type="button"
                                onClick={onSwitchToSignup}
                                className="font-medium text-primary-600 hover:text-primary-500 transition-colors cursor-pointer"
                            >
                                Sign up
                            </button>
                        </span>
                    </div>
                </motion.div>
            );
        }

        // Password step
        if (step === 'password') {
            return (
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                >
                    <div className="text-center">
                        <p className="text-sm text-gray-600">
                            Enter your password for
                        </p>
                        <p className="font-medium text-gray-900">{userEmail}</p>
                    </div>

                    <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                        <Input
                            {...passwordForm.register('password')}
                            type="password"
                            label="Password"
                            placeholder="Enter your password"
                            error={passwordForm.formState.errors.password?.message}
                            fullWidth
                            autoComplete="current-password"
                            autoFocus
                        />

                        <Button
                            type="submit"
                            fullWidth
                            loading={loading}
                        >
                            Sign in
                        </Button>
                    </form>

                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={handleBackToEmail}
                            className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                        >
                            Use a different email or login method
                        </button>
                        
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={onForgotPassword}
                                className="text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors cursor-pointer"
                            >
                                Forgot your password?
                            </button>
                        </div>
                    </div>
                </motion.div>
            );
        }


        return null;
    } catch (error) {
        console.error('LoginForm render error:', error);
        
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