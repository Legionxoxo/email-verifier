/**
 * Dashboard page component
 * Main email verifier interface with single and bulk verification
 */

import React from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '../components/layout';
import { SingleVerifier, BulkVerifier } from '../components/verifier';


/**
 * Main dashboard page with email verifier
 * @returns DashboardPage JSX element
 */
export function DashboardPage() {
    try {
        const [showSingleVerifier, setShowSingleVerifier] = React.useState(true);
        const [isSingleVerifying, setIsSingleVerifying] = React.useState(false);


        return (
            <DashboardLayout>
                {/* Main Content - Scrollable */}
                <div className="px-4 sm:px-6 lg:px-8 py-12">
                    <div className="w-full max-w-7xl space-y-8 mx-auto ">
                        {/* Single Email Verifier - Hidden when in bulk steps */}
                        {showSingleVerifier && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <SingleVerifier
                                    onVerifyingChange={setIsSingleVerifying}
                                />
                            </motion.div>
                        )}

                        {/* Bulk Email Verifier - Hidden when single verifying */}
                        {!isSingleVerifying && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: showSingleVerifier ? 0.2 : 0.1 }}
                            >
                                <BulkVerifier
                                    maxFileSizeMB={100}
                                    onStepChange={setShowSingleVerifier}
                                />
                            </motion.div>
                        )}
                    </div>
                </div>
            </DashboardLayout>
        );

    } catch (error) {
        console.error('DashboardPage render error:', error);

        return (
            <DashboardLayout>
                <div className="text-center space-y-4 py-12">
                    <p className="text-lg font-medium text-gray-900">
                        Something went wrong
                    </p>
                    <p className="text-sm text-gray-600">
                        Unable to load the dashboard. Please try refreshing the page.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600
                                 transition-colors cursor-pointer"
                    >
                        Refresh Page
                    </button>
                </div>
            </DashboardLayout>
        );
    }
}