/**
 * Button component with Notion-inspired design
 * Supports multiple variants, sizes, and states
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    fullWidth?: boolean;
    children: React.ReactNode;
}

/**
 * Button component with Notion-inspired styling
 * @param variant - Button style variant
 * @param size - Button size
 * @param loading - Loading state
 * @param fullWidth - Full width button
 * @param children - Button content
 * @param className - Additional CSS classes
 * @param disabled - Disabled state
 * @param props - Additional button props
 * @returns Button JSX element
 */
export function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    children,
    className,
    disabled,
    ...props
}: ButtonProps) {
    try {
        const baseStyles = [
            'inline-flex',
            'items-center',
            'justify-center',
            'font-medium',
            'rounded-lg',
            'border',
            'transition-all',
            'duration-200',
            'focus-visible:outline-none',
            'focus-visible:ring-2',
            'focus-visible:ring-primary-500',
            'focus-visible:ring-offset-2',
            'active:scale-[0.98]',
            'disabled:pointer-events-none',
            'disabled:opacity-50',
            'cursor-pointer',
            'disabled:cursor-not-allowed',
            'select-none',
        ];

        const variants = {
            primary: [
                'bg-gray-900',
                'text-white',
                'border-gray-900',
                'hover:bg-gray-800',
                'hover:border-gray-800',
                'shadow-sm',
            ],
            secondary: [
                'bg-gray-100',
                'text-gray-900',
                'border-gray-200',
                'hover:bg-gray-200',
                'hover:border-gray-300',
            ],
            outline: [
                'bg-white',
                'text-gray-700',
                'border-gray-300',
                'hover:bg-gray-50',
                'hover:border-gray-400',
                'hover:text-gray-900',
            ],
            ghost: [
                'bg-transparent',
                'text-gray-700',
                'border-transparent',
                'hover:bg-gray-100',
                'hover:text-gray-900',
            ],
            destructive: [
                'bg-red-500',
                'text-white',
                'border-red-500',
                'hover:bg-red-600',
                'hover:border-red-600',
                'shadow-sm',
            ],
        };

        const sizes = {
            sm: ['px-3', 'py-1.5', 'text-sm', 'h-8'],
            md: ['px-4', 'py-2', 'text-sm', 'h-10'],
            lg: ['px-6', 'py-3', 'text-base', 'h-12'],
        };

        const buttonClasses = cn(
            baseStyles,
            variants[variant],
            sizes[size],
            fullWidth && 'w-full',
            className
        );

        return (
            <motion.button
                className={buttonClasses}
                disabled={disabled || loading}
                whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
                {...(props as any)}
            >
                {loading && (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {children}
            </motion.button>
        );
    } catch (error) {
        console.error('Button render error:', error);
        return (
            <button
                className="inline-flex items-center justify-center px-4 py-2 bg-gray-500 text-white rounded"
                disabled
            >
                Error
            </button>
        );
    }
}