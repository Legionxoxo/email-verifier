/**
 * Reset password form component
 * Handles password reset completion with OTP and new password
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';
import React from 'react';
import { Button, Input } from '../ui';
import { resetPasswordWithOtpSchema, type ResetPasswordWithOtpFormData } from '../../lib/validations';

interface ResetPasswordFormProps {
    onSubmit: (data: { otp: string; newPassword: string }) => Promise<void>;
    loading?: boolean;
}

/**
 * Reset password form component
 * @param onSubmit - Handler for form submission
 * @param loading - Loading state
 * @returns ResetPasswordForm JSX element
 */
export function ResetPasswordForm({
    onSubmit,
    loading = false,
}: ResetPasswordFormProps) {
    try {
        const [showPassword, setShowPassword] = React.useState(false);
        const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

        const {
            register,
            handleSubmit,
            formState: { errors, isValid },
            watch,
        } = useForm<ResetPasswordWithOtpFormData>({
            resolver: zodResolver(resetPasswordWithOtpSchema),
            mode: 'onChange',
            defaultValues: {
                otp: '',
                newPassword: '',
                confirmPassword: '',
            },
        });

        const otp = watch('otp');
        const newPassword = watch('newPassword');
        const confirmPassword = watch('confirmPassword');

        const handleFormSubmit = async (data: ResetPasswordWithOtpFormData) => {
            try {
                // Only pass otp and newPassword to parent handler
                await onSubmit({
                    otp: data.otp,
                    newPassword: data.newPassword,
                });
            } catch (error) {
                console.error('Reset password form submit error:', error);
                throw error;
            }
        };

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
                    /[@$!%*?&]/.test(password),
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

        const passwordStrength = getPasswordStrength(newPassword);

        const togglePasswordVisibility = () => {
            setShowPassword(!showPassword);
        };

        const toggleConfirmPasswordVisibility = () => {
            setShowConfirmPassword(!showConfirmPassword);
        };

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                {/* Instructions */}
                <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium text-gray-900">
                        Create New Password
                    </h3>
                    <p className="text-sm text-gray-600">
                        Enter the verification code sent to your email and create a strong new password.
                    </p>
                </div>

                <form 
                    onSubmit={handleSubmit(handleFormSubmit)} 
                    className="space-y-6"
                >
                    {/* OTP field */}
                    <div className="space-y-2">
                        <Input
                            {...register('otp')}
                            type="text"
                            label="Verification code"
                            placeholder="Enter 6-digit code"
                            startIcon={<Shield className="h-4 w-4" />}
                            error={errors.otp?.message}
                            fullWidth
                            autoComplete="one-time-code"
                            maxLength={6}
                            className="text-center text-lg tracking-widest"
                            required
                        />

                        {/* OTP validation indicator */}
                        {otp && (
                            <div className="flex items-center space-x-2 text-xs">
                                {errors.otp ? (
                                    <span className="text-red-500 flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                                        <span>Please enter a valid 6-digit code</span>
                                    </span>
                                ) : otp.length === 6 ? (
                                    <span className="text-green-600 flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                                        <span>Code format is valid</span>
                                    </span>
                                ) : (
                                    <span className="text-gray-500 flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                                        <span>{otp.length}/6 digits entered</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* New password field */}
                    <div className="space-y-2">
                        <div className="relative">
                            <Input
                                {...register('newPassword')}
                                type={showPassword ? 'text' : 'password'}
                                label="New password"
                                placeholder="Create a strong password"
                                startIcon={<Lock className="h-4 w-4" />}
                                error={errors.newPassword?.message}
                                fullWidth
                                autoComplete="new-password"
                                required
                            />
                            <button
                                type="button"
                                onClick={togglePasswordVisibility}
                                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 cursor-pointer"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        
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
                                
                                <div className="text-xs text-gray-500 space-y-1">
                                    <p>Password must contain:</p>
                                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                                        <li className={newPassword.length >= 8 ? 'text-green-600' : ''}>
                                            At least 8 characters
                                        </li>
                                        <li className={/[a-z]/.test(newPassword) ? 'text-green-600' : ''}>
                                            One lowercase letter
                                        </li>
                                        <li className={/[A-Z]/.test(newPassword) ? 'text-green-600' : ''}>
                                            One uppercase letter
                                        </li>
                                        <li className={/\d/.test(newPassword) ? 'text-green-600' : ''}>
                                            One number
                                        </li>
                                        <li className={/[@$!%*?&]/.test(newPassword) ? 'text-green-600' : ''}>
                                            One special character (@$!%*?&)
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Confirm password field */}
                    <div className="space-y-2">
                        <div className="relative">
                            <Input
                                {...register('confirmPassword')}
                                type={showConfirmPassword ? 'text' : 'password'}
                                label="Confirm new password"
                                placeholder="Confirm your new password"
                                startIcon={<Lock className="h-4 w-4" />}
                                error={errors.confirmPassword?.message}
                                fullWidth
                                autoComplete="new-password"
                                required
                            />
                            <button
                                type="button"
                                onClick={toggleConfirmPasswordVisibility}
                                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 cursor-pointer"
                            >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>

                        {/* Password match indicator */}
                        {confirmPassword && newPassword && (
                            <div className="flex items-center space-x-2 text-xs">
                                {newPassword === confirmPassword ? (
                                    <span className="text-green-600 flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                                        <span>Passwords match</span>
                                    </span>
                                ) : (
                                    <span className="text-red-500 flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                                        <span>Passwords don't match</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Security reminder */}
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                            <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-green-900">
                                    Password Security Tips
                                </h4>
                                <ul className="text-sm text-green-700 mt-1 space-y-1">
                                    <li>• Use a unique password you haven't used elsewhere</li>
                                    <li>• Consider using a password manager for better security</li>
                                    <li>• Keep your password confidential and secure</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        fullWidth
                        loading={loading}
                        disabled={!isValid}
                        className="cursor-pointer"
                    >
                        {loading ? 'Updating password...' : 'Update password'}
                    </Button>
                </form>
            </motion.div>
        );
    } catch (error) {
        console.error('ResetPasswordForm render error:', error);
        
        return (
            <div className="space-y-4">
                <p className="text-sm text-red-600">
                    Something went wrong with the password reset form. Please refresh the page and try again.
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