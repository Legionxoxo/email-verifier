/**
 * Input component with Notion-inspired design
 * Supports various input types and validation states
 */

import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helper?: string;
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
    fullWidth?: boolean;
}

/**
 * Input component with label, error handling, and icon support
 * @param label - Input label text
 * @param error - Error message to display
 * @param helper - Helper text to display
 * @param startIcon - Icon to display at start of input
 * @param endIcon - Icon to display at end of input
 * @param fullWidth - Make input full width
 * @param className - Additional CSS classes
 * @param type - Input type
 * @param disabled - Disabled state
 * @param props - Additional input props
 * @returns Input JSX element with forwardRef
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ 
        label, 
        error, 
        helper, 
        startIcon, 
        endIcon, 
        fullWidth = false,
        className,
        type = 'text',
        disabled,
        ...props 
    }, ref) => {
        try {
            const [showPassword, setShowPassword] = React.useState(false);
            const isPassword = type === 'password';
            const actualType = isPassword && showPassword ? 'text' : type;

            const inputClasses = cn(
                // Base styles
                'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2',
                'text-sm text-gray-900 placeholder:text-gray-500',
                'transition-colors duration-200',
                
                // Focus styles
                'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
                
                // Error styles
                error && 'border-error-500 focus:border-error-500 focus:ring-error-500',
                
                // Disabled styles
                'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
                
                // Icon padding
                startIcon && 'pl-10',
                (endIcon || isPassword) && 'pr-10',
                
                // Full width
                !fullWidth && 'max-w-sm',
                
                className
            );

            const togglePassword = () => {
                try {
                    setShowPassword(!showPassword);
                } catch (e) {
                    console.error('Password toggle error:', e);
                }
            };

            return (
                <div className={cn('space-y-2', fullWidth && 'w-full')}>
                    {/* Label */}
                    {label && (
                        <label className="block text-sm font-medium text-gray-700">
                            {label}
                        </label>
                    )}

                    {/* Input container */}
                    <div className="relative">
                        {/* Start icon */}
                        {startIcon && (
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                {startIcon}
                            </div>
                        )}

                        {/* Input field */}
                        <input
                            ref={ref}
                            type={actualType}
                            className={inputClasses}
                            disabled={disabled}
                            {...props}
                        />

                        {/* End icon or password toggle */}
                        {(endIcon || isPassword) && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {isPassword ? (
                                    <button
                                        type="button"
                                        onClick={togglePassword}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                ) : (
                                    <div className="text-gray-400">
                                        {endIcon}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Helper text or error message */}
                    {(helper || error) && (
                        <p className={cn(
                            'text-xs',
                            error ? 'text-error-500' : 'text-gray-500'
                        )}>
                            {error || helper}
                        </p>
                    )}
                </div>
            );
        } catch (error) {
            console.error('Input render error:', error);
            return (
                <input
                    ref={ref}
                    className="border border-gray-300 rounded px-3 py-2"
                    placeholder="Error loading input"
                    disabled
                />
            );
        }
    }
);

Input.displayName = 'Input';