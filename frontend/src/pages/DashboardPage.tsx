/**
 * Dashboard page component
 * Main email verifier interface with single and bulk verification
 */

import { motion } from 'framer-motion';
import { DashboardLayout } from '../components/layout';
import { SingleVerifier, BulkVerifier } from '../components/verifier';
import { useAuth } from '../hooks';
import { toast } from 'react-toastify';


/**
 * Main dashboard page with email verifier
 * @returns DashboardPage JSX element
 */
export function DashboardPage() {
    try {
        const { user, logout } = useAuth();


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

                toast.success(`Email verified successfully: ${email}`);

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

                toast.success(`${emails.length} emails queued for verification`);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Upload failed';
                console.error('Bulk upload error:', error);
                throw new Error(errorMessage);
            } finally {
                console.debug('Bulk upload completed');
            }
        };


        return (
            <DashboardLayout
                user={user || undefined}
                onLogout={handleLogout}
            >
                {/* Main Content - Fit in one screen */}
                <div className="h-full overflow-hidden flex items-center justify-center px-4 sm:px-6 lg:px-8">
                    <div className="w-full max-w-7xl space-y-8 py-4">
                        {/* Single Email Verifier */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <SingleVerifier
                                onVerify={handleSingleVerify}
                            />
                        </motion.div>

                        {/* Bulk Email Verifier */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <BulkVerifier
                                onUpload={handleBulkUpload}
                                maxFileSizeMB={100}
                                maxRows={50000}
                            />
                        </motion.div>
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