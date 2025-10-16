/**
 * Dashboard page component
 * Main email verifier interface with single and bulk verification
 */

import React from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '../components/layout';
import { SingleVerifier, BulkVerifier } from '../components/verifier';
import { VerificationResultsPage, type EmailVerificationResult } from './VerificationResultsPage';
import { useAuth } from '../hooks';
import { toast } from 'react-toastify';


/**
 * Main dashboard page with email verifier
 * @returns DashboardPage JSX element
 */
export function DashboardPage() {
    try {
        const { user, logout } = useAuth();
        const [showSingleVerifier, setShowSingleVerifier] = React.useState(true);
        const [isSingleVerifying, setIsSingleVerifying] = React.useState(false);
        const [showResults, setShowResults] = React.useState(false);
        const [verificationResults, setVerificationResults] = React.useState<EmailVerificationResult[]>([]);


        // Handle logout
        const handleLogout = async () => {
            try {
                await logout();
            } catch (error) {
                console.error('Logout error:', error);
            } finally {
                console.debug('Logout handler completed');
            }
        };


        // Handle single email verification
        const handleSingleVerify = async (email: string) => {
            try {
                // TODO: Implement actual API call to your backend
                console.log('Verifying email:', email);

                // Simulated API call
                await new Promise(resolve => setTimeout(resolve, 2000));

                // TODO: Replace with actual API response
                // Mock result for demonstration
                const mockResult: EmailVerificationResult = {
                    email: email,
                    status: Math.random() > 0.5 ? 'valid' : 'invalid',
                    reason: Math.random() > 0.5
                        ? 'This is a valid email address!'
                        : "This email doesn't have an associated SMTP server."
                };

                setVerificationResults([mockResult]);
                setShowResults(true);
                toast.success(`Email verified successfully`);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Verification failed';
                console.error('Verification error:', error);
                throw new Error(errorMessage);
            } finally {
                console.debug('Single verification completed');
            }
        };


        // Handle bulk upload
        const handleBulkUpload = async (emails: string[]) => {
            try {
                // TODO: Implement actual API call to your backend
                console.log('Uploading emails for bulk verification:', emails.length);

                // Simulated API call
                await new Promise(resolve => setTimeout(resolve, 1000));

                // TODO: Replace with actual API response
                // Mock results for demonstration
                const statuses: Array<'valid' | 'invalid' | 'catch-all' | 'unknown'> = ['valid', 'invalid', 'catch-all', 'unknown'];
                const reasons: Record<string, string> = {
                    valid: 'This is a valid email address!',
                    invalid: "This email doesn't have an associated SMTP server.",
                    'catch-all': 'This domain accepts all emails (catch-all).',
                    unknown: 'Unable to verify this email address.'
                };

                const mockResults: EmailVerificationResult[] = emails.map(email => {
                    const status = statuses[Math.floor(Math.random() * statuses.length)];
                    return {
                        email: email,
                        status: status,
                        reason: reasons[status]
                    };
                });

                setVerificationResults(mockResults);
                setShowResults(true);
                toast.success(`${emails.length} emails verified successfully`);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Upload failed';
                console.error('Bulk upload error:', error);
                throw new Error(errorMessage);
            } finally {
                console.debug('Bulk upload completed');
            }
        };


        // Handle back from results page
        const handleBackFromResults = () => {
            try {
                setShowResults(false);
                setVerificationResults([]);
            } catch (error) {
                console.error('Back from results error:', error);
            }
        };


        // Show results page if we have results
        if (showResults) {
            return (
                <VerificationResultsPage
                    results={verificationResults}
                    onBack={handleBackFromResults}
                    user={user || undefined}
                    onLogout={handleLogout}
                />
            );
        }


        return (
            <DashboardLayout
                user={user || undefined}
                onLogout={handleLogout}
            >
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
                                    onVerify={handleSingleVerify}
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
                                    onUpload={handleBulkUpload}
                                    maxFileSizeMB={100}
                                    maxRows={50000}
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