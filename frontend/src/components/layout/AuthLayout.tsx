/**
 * Authentication layout component
 * Provides consistent layout for login, signup, and auth-related pages
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    showBackButton?: boolean;
    onBack?: () => void;
}

/**
 * Authentication layout with centered card design
 * @param children - Page content
 * @param title - Page title
 * @param subtitle - Page subtitle
 * @param showBackButton - Show back navigation button
 * @param onBack - Back button handler
 * @returns AuthLayout JSX element
 */
export function AuthLayout({
    children,
    title,
    subtitle,
    showBackButton = false,
    onBack,
}: AuthLayoutProps) {
    try {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                {/* Background pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 opacity-50" />

                {/* Content container */}
                <div className="relative sm:mx-auto sm:w-full sm:max-w-md">
                    {/* Back button */}
                    {showBackButton && onBack && (
                        <motion.button
                            onClick={onBack}
                            className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
                            whileHover={{ x: -2 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                            Back
                        </motion.button>
                    )}

                    {/* Logo/Brand */}
                    <motion.div
                        className="text-center mb-8"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="mx-auto h-12 w-12 bg-gray-900 rounded-lg flex items-center justify-center mb-4">
                            <span className="text-white font-bold text-xl">B</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-sm text-gray-600">
                                {subtitle}
                            </p>
                        )}
                    </motion.div>

                    {/* Main content card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <Card variant="elevated" padding="lg">
                            {children}
                        </Card>
                    </motion.div>

                    {/* Footer */}
                    <motion.div
                        className="mt-8 text-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        <p className="text-xs text-gray-500">
                            © 2025 BrandNav All rights reserved.
                        </p>
                    </motion.div>
                </div>
            </div>
        );
    } catch (error) {
        console.error('AuthLayout render error:', error);

        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card padding="lg">
                    <h1 className="text-xl font-bold mb-4">{title}</h1>
                    {children}
                </Card>
            </div>
        );
    }
}