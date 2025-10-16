/**
 * Dashboard page component
 * Protected page showing main dashboard content
 */

import { motion } from 'framer-motion';
import { LayoutDashboard } from 'lucide-react';
import { DashboardLayout } from '../components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui';
import { useAuth } from '../hooks';

/**
 * Main dashboard page
 * @returns DashboardPage JSX element
 */
export function DashboardPage() {
    try {
        const { user, logout } = useAuth();

        const handleLogout = async () => {
            try {
                await logout();
            } catch (error) {
                console.error('Logout error:', error);
            }
        };


        return (
            <DashboardLayout
                user={user || undefined}
                onLogout={handleLogout}
            >
                <div className="space-y-8">
                    {/* Welcome section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                    >
                        <h1 className="text-3xl font-bold text-gray-900">
                            Dashboard
                        </h1>
                        <p className="text-gray-600">
                            Welcome to your dashboard. Content coming soon!
                        </p>
                    </motion.div>

                    {/* Empty dashboard placeholder */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle>Dashboard Content</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12 text-gray-500">
                                    <LayoutDashboard className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                                    <p className="text-lg font-medium mb-2">Dashboard Under Construction</p>
                                    <p className="text-sm">
                                        Dashboard content will be added here soon
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </DashboardLayout>
        );
    } catch (error) {
        console.error('DashboardPage render error:', error);

        return (
            <DashboardLayout>
                <div className="text-center space-y-4">
                    <p className="text-sm text-error-600">
                        Something went wrong loading your dashboard.
                    </p>
                </div>
            </DashboardLayout>
        );
    }
}