/**
 * Password reset form component
 * Handles password reset request and new password setting
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button, Input } from '../ui';
import { 
    passwordResetRequestSchema, 
    passwordResetSchema,
    type PasswordResetRequestFormData,
    type PasswordResetFormData 
} from '../../lib/validations';

interface PasswordResetFormProps {
    onResetRequest: (data: PasswordResetRequestFormData) => Promise<void>;
    onResetPassword?: (data: PasswordResetFormData) => Promise<void>;
    onBack: () => void;
    loading?: boolean;
    mode?: 'request' | 'reset';
    token?: string;
}

/**
 * Password reset form component with two modes
 * @param onResetRequest - Handler for reset request
 * @param onResetPassword - Handler for password reset
 * @param onBack - Handler to go back
 * @param loading - Loading state
 * @param mode - Form mode (request or reset)
 * @param token - Reset token for password reset
 * @returns PasswordResetForm JSX element
 */
export function PasswordResetForm({
    onResetRequest,
    onResetPassword,
    onBack,
    loading = false,
    mode = 'request',
    token,
}: PasswordResetFormProps) {
    try {
        const [requestSent, setRequestSent] = React.useState(false);
        const [userEmail, setUserEmail] = React.useState('');

        // Request form
        const requestForm = useForm<PasswordResetRequestFormData>({
            resolver: zodResolver(passwordResetRequestSchema),
            defaultValues: {
                email: '',
            },
        });

        // Reset form
        const resetForm = useForm<PasswordResetFormData>({
            resolver: zodResolver(passwordResetSchema),
            defaultValues: {
                password: '',
                confirmPassword: '',
                token: token || '',
            },
        });

        const handleResetRequest = async (data: PasswordResetRequestFormData) => {
            try {
                await onResetRequest(data);
                setUserEmail(data.email);
                setRequestSent(true);
            } catch (error) {
                console.error('Reset request error:', error);
            }
        };

        const handlePasswordReset = async (data: PasswordResetFormData) => {
            try {
                if (onResetPassword) {
                    await onResetPassword(data);
                }
            } catch (error) {
                console.error('Password reset error:', error);
            }
        };

        const handleBackToRequest = () => {
            try {
                setRequestSent(false);
                setUserEmail('');
                requestForm.reset();
            } catch (error) {
                console.error('Back to request error:', error);
            }
        };

        // Request mode - ask for email
        if (mode === 'request' && !requestSent) {
            return (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    <div className="text-center">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">
                            Reset your password
                        </h2>
                        <p className="text-sm text-gray-600">
                            Enter your email address and we'll send you a link to reset your password.
                        </p>
                    </div>

                    <form onSubmit={requestForm.handleSubmit(handleResetRequest)} className="space-y-4">
                        <Input
                            {...requestForm.register('email')}
                            type="email"
                            label="Email address"
                            placeholder="you@example.com"
                            startIcon={<Mail className="h-4 w-4" />}
                            error={requestForm.formState.errors.email?.message}
                            fullWidth
                            autoComplete="email"
                            autoFocus
                        />

                        <Button
                            type="submit"
                            fullWidth
                            loading={loading}
                        >
                            Send reset link
                        </Button>
                    </form>

                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center justify-center w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to sign in
                    </button>
                </motion.div>
            );
        }

        // Request sent confirmation
        if (mode === 'request' && requestSent) {
            return (
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6 text-center"
                >
                    <div>
                        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <Mail className="h-6 w-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Check your email
                        </h3>
                        <p className="text-sm text-gray-600">
                            We've sent a password reset link to
                        </p>
                        <p className="font-medium text-gray-900">{userEmail}</p>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">
                            The link will expire in 1 hour for security reasons.
                        </p>

                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => handleResetRequest({ email: userEmail })}
                                disabled={loading}
                                className="text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors disabled:opacity-50"
                            >
                                Didn't receive the email? Send again
                            </button>
                            
                            <button
                                type="button"
                                onClick={handleBackToRequest}
                                className="block w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                Use a different email address
                            </button>
                            
                            <button
                                type="button"
                                onClick={onBack}
                                className="flex items-center justify-center w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to sign in
                            </button>
                        </div>
                    </div>
                </motion.div>
            );
        }

        // Reset mode - set new password
        if (mode === 'reset') {
            const password = resetForm.watch('password');

            return (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    <div className="text-center">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">
                            Set new password
                        </h2>
                        <p className="text-sm text-gray-600">
                            Choose a strong password to secure your account.
                        </p>
                    </div>

                    <form onSubmit={resetForm.handleSubmit(handlePasswordReset)} className="space-y-4">
                        {/* Hidden token field */}
                        <input
                            {...resetForm.register('token')}
                            type="hidden"
                            value={token}
                        />

                        <Input
                            {...resetForm.register('password')}
                            type="password"
                            label="New password"
                            placeholder="Enter your new password"
                            error={resetForm.formState.errors.password?.message}
                            fullWidth
                            autoComplete="new-password"
                            autoFocus
                        />

                        <Input
                            {...resetForm.register('confirmPassword')}
                            type="password"
                            label="Confirm new password"
                            placeholder="Confirm your new password"
                            error={resetForm.formState.errors.confirmPassword?.message}
                            fullWidth
                            autoComplete="new-password"
                        />

                        {/* Password requirements */}
                        <div className="text-xs text-gray-500 space-y-1">
                            <p>Your password must contain:</p>
                            <ul className="list-disc list-inside space-y-0.5 ml-2">
                                <li className={password && password.length >= 8 ? 'text-success-600' : ''}>
                                    At least 8 characters
                                </li>
                                <li className={password && /[a-z]/.test(password) ? 'text-success-600' : ''}>
                                    One lowercase letter
                                </li>
                                <li className={password && /[A-Z]/.test(password) ? 'text-success-600' : ''}>
                                    One uppercase letter
                                </li>
                                <li className={password && /\d/.test(password) ? 'text-success-600' : ''}>
                                    One number
                                </li>
                                <li className={password && /[@$!%*?&]/.test(password) ? 'text-success-600' : ''}>
                                    One special character (@$!%*?&)
                                </li>
                            </ul>
                        </div>

                        <Button
                            type="submit"
                            fullWidth
                            loading={loading}
                            disabled={!resetForm.formState.isValid}
                        >
                            Update password
                        </Button>
                    </form>

                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center justify-center w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to sign in
                    </button>
                </motion.div>
            );
        }

        return null;
    } catch (error) {
        console.error('PasswordResetForm render error:', error);
        
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