/**
 * 404 Not Found page component
 * Displays when user navigates to non-existent route
 */

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '../components/ui';
import { config } from '../data/env';


/**
 * Check if user is authenticated
 * @returns boolean
 */
function isAuthenticated(): boolean {
    try {
        const userStr = localStorage.getItem(config.auth.userStorageKey);
        if (!userStr) return false;
        const user = JSON.parse(userStr);
        return !!user && !!user.email;
    } catch (error) {
        return false;
    } finally {
        // Debug logging omitted for production
    }
}


/**
 * 404 Not Found page
 * @returns NotFoundPage JSX element
 */
export function NotFoundPage() {
    try {
        const navigate = useNavigate();
        const authenticated = isAuthenticated();


        const handleGoHome = () => {
            try {
                navigate(authenticated ? '/dashboard' : '/', { replace: true });
            } catch (error) {
                console.error('Navigate home error:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        const handleGoBack = () => {
            try {
                navigate(-1);
            } catch (error) {
                console.error('Navigate back error:', error);
                handleGoHome();
            }
        };

        const handleGoToLogin = () => {
            try {
                navigate('/login');
            } catch (error) {
                console.error('Navigate to login error:', error);
            }
        };

        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                {/* Background pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 opacity-50" />
                
                <div className="relative sm:mx-auto sm:w-full sm:max-w-md">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white py-8 px-6 shadow-lg rounded-lg sm:px-10"
                    >
                        {/* 404 Illustration */}
                        <div className="text-center mb-8">
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2 }}
                                className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6"
                            >
                                <Search className="h-12 w-12 text-gray-400" />
                            </motion.div>
                            
                            <motion.h1
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-6xl font-bold text-gray-900 mb-2"
                            >
                                404
                            </motion.h1>
                            
                            <motion.h2
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="text-2xl font-semibold text-gray-700 mb-4"
                            >
                                Page not found
                            </motion.h2>
                            
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-gray-600 mb-8"
                            >
                                Sorry, we couldn't find the page you're looking for. 
                                The page might have been moved, deleted, or you entered the wrong URL.
                            </motion.p>
                        </div>

                        {/* Action buttons */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="space-y-4"
                        >
                            <div className="grid grid-cols-1 gap-3">
                                <Button
                                    onClick={handleGoHome}
                                    fullWidth
                                    className="flex items-center justify-center"
                                >
                                    <Home className="h-4 w-4 mr-2" />
                                    {authenticated ? 'Go to Dashboard' : 'Go Home'}
                                </Button>

                                <Button
                                    onClick={handleGoBack}
                                    variant="outline"
                                    fullWidth
                                    className="flex items-center justify-center"
                                >
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Go Back
                                </Button>

                                {!authenticated && (
                                    <Button
                                        onClick={handleGoToLogin}
                                        variant="ghost"
                                        fullWidth
                                        className="flex items-center justify-center"
                                    >
                                        Sign In
                                    </Button>
                                )}
                            </div>
                        </motion.div>

                        {/* Help text */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="mt-8 text-center"
                        >
                            <p className="text-xs text-gray-500">
                                If you believe this is an error, please{' '}
                                <a 
                                    href="mailto:support@microsaas.com" 
                                    className="font-medium text-primary-600 hover:text-primary-500"
                                >
                                    contact support
                                </a>
                            </p>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        );
    } catch (error) {
        console.error('NotFoundPage render error:', error);
        
        // Fallback UI
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                    <p className="text-gray-600 mb-8">Page not found</p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }
}