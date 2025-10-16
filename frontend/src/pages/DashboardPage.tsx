/**
 * Dashboard page component
 * Protected page showing user profile and account information
 */

import { motion } from 'framer-motion';
import { User, Mail, Calendar, Shield } from 'lucide-react';
import { DashboardLayout } from '../components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../components/ui';
import { useAuth } from '../hooks';

/**
 * Dashboard page with user profile and account info
 * @returns DashboardPage JSX element
 */
export function DashboardPage() {
    try {
        const { user, logout, refreshUser, isLoading } = useAuth();

        const handleRefreshProfile = async () => {
            try {
                await refreshUser();
            } catch (error) {
                console.error('Refresh profile error:', error);
            }
        };

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
                            Welcome back{user?.name ? `, ${user.name}` : ''}!
                        </h1>
                        <p className="text-gray-600">
                            Here's your account overview and recent activity.
                        </p>
                    </motion.div>

                    {/* Stats cards */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                        <Card>
                            <CardContent className="flex items-center space-x-4 p-6">
                                <div className="p-2 bg-primary-100 rounded-lg">
                                    <User className="h-6 w-6 text-primary-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Account Status</p>
                                    <p className="text-2xl font-bold text-gray-900">Active</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="flex items-center space-x-4 p-6">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <Shield className="h-6 w-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Security</p>
                                    <p className="text-2xl font-bold text-gray-900">Secure</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="flex items-center space-x-4 p-6">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Calendar className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Member Since</p>
                                    <p className="text-lg font-bold text-gray-900">Today</p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Profile information */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle>Profile Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center space-x-4">
                                    <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center">
                                        <User className="h-8 w-8 text-gray-600" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {user?.name || 'No name provided'}
                                        </h3>
                                        <p className="text-gray-600 flex items-center">
                                            <Mail className="h-4 w-4 mr-2" />
                                            {user?.email}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            User ID
                                        </label>
                                        <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                                            {user?.id}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            Account Type
                                        </label>
                                        <p className="text-sm text-gray-600">
                                            Standard User
                                        </p>
                                    </div>
                                </div>

                                <div className="flex space-x-4 pt-4 border-t">
                                    <Button
                                        onClick={handleRefreshProfile}
                                        loading={isLoading}
                                        variant="outline"
                                    >
                                        Refresh Profile
                                    </Button>
                                    
                                    <Button
                                        onClick={() => alert('Profile editing coming soon!')}
                                        variant="outline"
                                    >
                                        Edit Profile
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Recent activity placeholder */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Activity</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-8 text-gray-500">
                                    <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                    <p className="text-sm">No recent activity to display</p>
                                    <p className="text-xs mt-2">Activity will appear here as you use the app</p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Quick actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle>Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Button
                                        variant="outline"
                                        className="justify-start h-auto p-4"
                                        onClick={() => alert('Settings coming soon!')}
                                    >
                                        <div className="text-left">
                                            <p className="font-medium">Account Settings</p>
                                            <p className="text-sm text-gray-500">Manage your preferences</p>
                                        </div>
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="justify-start h-auto p-4"
                                        onClick={() => alert('Security settings coming soon!')}
                                    >
                                        <div className="text-left">
                                            <p className="font-medium">Security</p>
                                            <p className="text-sm text-gray-500">Password & 2FA settings</p>
                                        </div>
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="justify-start h-auto p-4"
                                        onClick={() => alert('Help center coming soon!')}
                                    >
                                        <div className="text-left">
                                            <p className="font-medium">Help & Support</p>
                                            <p className="text-sm text-gray-500">Get help when you need it</p>
                                        </div>
                                    </Button>
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
                    <Button
                        onClick={() => window.location.reload()}
                        variant="outline"
                    >
                        Refresh page
                    </Button>
                </div>
            </DashboardLayout>
        );
    }
}