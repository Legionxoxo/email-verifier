/**
 * Signup form component with validation
 * Handles user registration with email, password, and optional name
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Mail, User } from 'lucide-react';
import { Button, Input } from '../ui';
import { registerSchema, type RegisterFormData } from '../../lib/validations';

interface SignupFormProps {
    onSignup: (data: RegisterFormData) => Promise<void>;
    onSwitchToLogin: () => void;
    loading?: boolean;
}

/**
 * Registration form component
 * @param onSignup - Handler for registration
 * @param onSwitchToLogin - Handler to switch to login
 * @param loading - Loading state
 * @returns SignupForm JSX element
 */
export function SignupForm({
    onSignup,
    onSwitchToLogin,
    loading = false,
}: SignupFormProps) {
    try {
        const {
            register,
            handleSubmit,
            formState: { errors, isValid },
            watch,
        } = useForm<RegisterFormData>({
            resolver: zodResolver(registerSchema),
            mode: 'onChange',
            defaultValues: {
                name: '',
                email: '',
                password: '',
                confirmPassword: '',
            },
        });


        const password = watch('password');
        const confirmPassword = watch('confirmPassword');

        const handleFormSubmit = async (data: RegisterFormData) => {
            try {
                await onSignup(data);
            } catch (error) {
                console.error('❌ Signup form submit error:', error);
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

        const passwordStrength = getPasswordStrength(password);

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                <form 
                    onSubmit={handleSubmit(handleFormSubmit)} 
                    className="space-y-4"
                >
                    {/* Name field (required) */}
                    <Input
                        {...register('name')}
                        type="text"
                        label="Full name"
                        placeholder="Enter your full name"
                        startIcon={<User className="h-4 w-4" />}
                        error={errors.name?.message}
                        fullWidth
                        autoComplete="name"
                        required
                    />

                    {/* Email field */}
                    <Input
                        {...register('email')}
                        type="email"
                        label="Email address"
                        placeholder="you@example.com"
                        startIcon={<Mail className="h-4 w-4" />}
                        error={errors.email?.message}
                        fullWidth
                        autoComplete="email"
                        required
                    />

                    {/* Password field */}
                    <div className="space-y-2">
                        <Input
                            {...register('password')}
                            type="password"
                            label="Password"
                            placeholder="Create a strong password"
                            error={errors.password?.message}
                            fullWidth
                            autoComplete="new-password"
                            required
                        />
                        
                        {/* Password strength indicator */}
                        {password && (
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
                                        <li className={password.length >= 8 ? 'text-green-600' : ''}>
                                            At least 8 characters
                                        </li>
                                        <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
                                            One lowercase letter
                                        </li>
                                        <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
                                            One uppercase letter
                                        </li>
                                        <li className={/\d/.test(password) ? 'text-green-600' : ''}>
                                            One number
                                        </li>
                                        <li className={/[@$!%*?&]/.test(password) ? 'text-green-600' : ''}>
                                            One special character (@$!%*?&)
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Confirm password field */}
                    <Input
                        {...register('confirmPassword')}
                        type="password"
                        label="Confirm password"
                        placeholder="Confirm your password"
                        error={errors.confirmPassword?.message}
                        fullWidth
                        autoComplete="new-password"
                        required
                    />

                    {/* Password match indicator */}
                    {confirmPassword && password && (
                        <div className="flex items-center space-x-2 text-xs">
                            {password === confirmPassword ? (
                                <span className="text-green-600 flex items-center">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Passwords match
                                </span>
                            ) : (
                                <span className="text-red-500 flex items-center">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    Passwords don't match
                                </span>
                            )}
                        </div>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        loading={loading}
                        disabled={!isValid}
                    >
                        Create account
                    </Button>
                </form>

                {/* Terms and privacy */}
                <div className="text-center">
                    <p className="text-xs text-gray-500">
                        By creating an account, you agree to our{' '}
                        <a href="#" className="font-medium text-primary-600 hover:text-primary-500 cursor-pointer">
                            Terms of Service
                        </a>{' '}
                        and{' '}
                        <a href="#" className="font-medium text-primary-600 hover:text-primary-500 cursor-pointer">
                            Privacy Policy
                        </a>
                    </p>
                </div>

                {/* Switch to login */}
                <div className="text-center">
                    <span className="text-sm text-gray-600">
                        Already have an account?{' '}
                        <button
                            type="button"
                            onClick={onSwitchToLogin}
                            className="font-medium text-primary-600 hover:text-primary-500 transition-colors cursor-pointer"
                        >
                            Sign in
                        </button>
                    </span>
                </div>
            </motion.div>
        );
    } catch (error) {
        console.error('SignupForm render error:', error);
        
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