/**
 * Settings page with tab navigation and deep linking support
 * Comprehensive settings management including profile and security
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft,
    User,
    Shield,
    Mail,
    Key,
    AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { 
    ProfileSettingsForm,
    ChangeEmailForm,
    SettingsPasswordResetForm
} from '../components/forms';
import { useAuth } from '../contexts/AuthContext';
import { formatErrorMessage } from '../lib/utils';

type TabMode = 'profile' | 'security';
type SecurityView = 'overview' | 'change-email' | 'forgot-password';

/**
 * Settings page with comprehensive settings management
 * @returns SettingsPage JSX element
 */
export function SettingsPage() {
    try {
        // URL parameters for deep linking
        const [searchParams, setSearchParams] = useSearchParams();
        const navigate = useNavigate();
        const tabParam = searchParams.get('tab') as TabMode;
        const viewParam = searchParams.get('view') as SecurityView;
        
        // Authentication context
        const { 
            user, 
            updateProfile, 
            requestEmailChange, 
            verifyEmailChange,
            emailChangeEmail 
        } = useAuth();
        
        // State management
        const initialTab = tabParam && ['profile', 'security'].includes(tabParam) 
            ? tabParam 
            : 'profile';
        const [currentTab, setCurrentTab] = React.useState<TabMode>(initialTab);
        
        const initialSecurityView = viewParam && ['overview', 'change-email', 'forgot-password'].includes(viewParam)
            ? viewParam
            : 'overview';
        const [securityView, setSecurityView] = React.useState<SecurityView>(initialSecurityView);
        
        const [loading, setLoading] = React.useState(false);
        const [error, setError] = React.useState<string>('');

        // Handle tab changes with URL updates
        const handleTabChange = (tab: TabMode) => {
            try {
                setCurrentTab(tab);
                setSecurityView('overview'); // Reset security view when changing tabs
                
                // Update URL without triggering a full page reload
                const newParams = new URLSearchParams(searchParams);
                newParams.set('tab', tab);
                newParams.delete('view'); // Clear view param when changing tabs
                setSearchParams(newParams, { replace: true });
            } catch (error) {
                console.error('Tab change error:', error);
            }
        };

        // Handle security view changes with URL updates
        const handleSecurityViewChange = (view: SecurityView) => {
            try {
                setSecurityView(view);
                
                // Update URL without triggering a full page reload
                const newParams = new URLSearchParams(searchParams);
                if (view !== 'overview') {
                    newParams.set('view', view);
                } else {
                    newParams.delete('view');
                }
                setSearchParams(newParams, { replace: true });
            } catch (error) {
                console.error('Security view change error:', error);
            }
        };

        // Handle back navigation
        const handleBackNavigation = () => {
            try {
                if (securityView !== 'overview' && currentTab === 'security') {
                    // If in a security sub-view, go back to security overview
                    handleSecurityViewChange('overview');
                } else {
                    // Go back to dashboard
                    navigate('/dashboard');
                }
            } catch (error) {
                console.error('Back navigation error:', error);
                // Fallback to browser history
                window.history.back();
            }
        };

        // Profile settings handlers
        const handleProfileUpdate = async (data: { firstName: string; lastName: string }) => {
            try {
                setLoading(true);
                setError('');
                
                await updateProfile(data);
                
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to update profile';
                setError(formatErrorMessage(message));
            } finally {
                setLoading(false);
            }
        };

        // Email change handlers
        const handleChangeEmailStep1 = async (data: { newEmail: string; currentPassword: string }) => {
            try {
                setLoading(true);
                setError('');
                
                await requestEmailChange(data.newEmail, data.currentPassword);
                
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to initiate email change';
                setError(formatErrorMessage(message));
            } finally {
                setLoading(false);
            }
        };

        const handleChangeEmailStep2 = async (data: { otp: string; newEmail?: string }) => {
            try {
                setLoading(true);
                setError('');
                
                // Get newEmail from form, AuthContext state, or fallback to user email
                const emailToVerify = data.newEmail || emailChangeEmail || user?.email || '';
                
                await verifyEmailChange(emailToVerify, data.otp);
                
                // On success, return to overview
                handleSecurityViewChange('overview');
                
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to verify email change';
                setError(formatErrorMessage(message));
            } finally {
                setLoading(false);
            }
        };

        // Navigation handler for password reset
        const handleBackToOverview = () => {
            try {
                handleSecurityViewChange('overview');
            } catch (error) {
                console.error('Back to overview error:', error);
            }
        };

        // Clear error handler
        const clearError = () => {
            setError('');
        };

        // Render profile tab content
        const renderProfileTab = () => {
            return (
                <div className="space-y-6">
                    {/* Profile Settings Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <User className="h-5 w-5" />
                                <span>Personal Information</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ProfileSettingsForm
                                initialData={{
                                    firstName: user?.firstName || '',
                                    lastName: user?.lastName || '',
                                }}
                                onSubmit={handleProfileUpdate}
                                loading={loading}
                            />
                        </CardContent>
                    </Card>

                    {/* Account Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">Email Address</p>
                                    <p className="text-sm text-gray-600">{user?.email || 'Not available'}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">User ID</p>
                                    <p className="text-sm text-gray-600 font-mono">{user?.id || 'Not available'}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between py-3">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">Account Status</p>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <div className={`w-2 h-2 rounded-full ${user?.isVerified ? 'bg-green-500' : 'bg-orange-500'}`} />
                                        <p className={`text-sm ${user?.isVerified ? 'text-green-700' : 'text-orange-700'}`}>
                                            {user?.isVerified ? 'Verified' : 'Unverified'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        };

        // Render security tab content
        const renderSecurityTab = () => {
            switch (securityView) {
                case 'change-email':
                    return (
                        <div className="space-y-6">
                            <div className="flex items-center space-x-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSecurityViewChange('overview')}
                                    className="flex items-center space-x-1"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    <span>Back</span>
                                </Button>
                                <h2 className="text-xl font-semibold text-gray-900">Change Email Address</h2>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center space-x-2">
                                        <Mail className="h-5 w-5" />
                                        <span>Update Email Address</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ChangeEmailForm
                                        currentEmail={user?.email || ''}
                                        onStepOneSubmit={handleChangeEmailStep1}
                                        onStepTwoSubmit={handleChangeEmailStep2}
                                        loading={loading}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    );

                case 'forgot-password':
                    return (
                        <div className="space-y-6">
                            <div className="flex items-center space-x-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSecurityViewChange('overview')}
                                    className="flex items-center space-x-1"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    <span>Back</span>
                                </Button>
                                <h2 className="text-xl font-semibold text-gray-900">Reset Password</h2>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center space-x-2">
                                        <Key className="h-5 w-5" />
                                        <span>Password Reset Request</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <SettingsPasswordResetForm
                                        onComplete={handleBackToOverview}
                                        onCancel={handleBackToOverview}
                                        loading={loading}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    );

                default:
                    return (
                        <div className="space-y-6">
                            {/* Email Management */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center space-x-2">
                                        <Mail className="h-5 w-5" />
                                        <span>Email Management</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900">Current Email</p>
                                                <p className="text-sm text-gray-600">{user?.email || 'Not available'}</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSecurityViewChange('change-email')}
                                                className="cursor-pointer"
                                            >
                                                Change Email
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Password Management */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center space-x-2">
                                        <Key className="h-5 w-5" />
                                        <span>Password Management</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900">Password</p>
                                                <p className="text-sm text-gray-600">Last updated recently</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSecurityViewChange('forgot-password')}
                                                className="cursor-pointer"
                                            >
                                                Reset Password
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    );
            }
        };


        // Render current tab content
        const renderTabContent = () => {
            switch (currentTab) {
                case 'profile':
                    return renderProfileTab();
                case 'security':
                    return renderSecurityTab();
                default:
                    return renderProfileTab();
            }
        };

        if (!user) {
            return (
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto" />
                        <p className="text-gray-600">Loading user information...</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        {/* Desktop layout: side by side (default) */}
                        <div className="hidden sm:flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBackNavigation}
                                    className="flex items-center space-x-1 cursor-pointer"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    <span>Back</span>
                                </Button>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                                    <p className="text-gray-600 mt-1">
                                        Manage your account preferences and security settings
                                    </p>
                                </div>
                            </div>
                            
                            {/* Navigation tabs */}
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant={currentTab === 'profile' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleTabChange('profile')}
                                    className="cursor-pointer"
                                >
                                    <User className="h-4 w-4 mr-2" />
                                    Profile
                                </Button>
                                <Button
                                    variant={currentTab === 'security' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleTabChange('security')}
                                    className="cursor-pointer"
                                >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Security
                                </Button>
                            </div>
                        </div>

                        {/* Mobile layout: stacked */}
                        <div className="sm:hidden space-y-4">
                            {/* Top row: Title and Back button */}
                            <div className="flex items-start space-x-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBackNavigation}
                                    className="flex items-center space-x-1 min-h-[44px] cursor-pointer flex-shrink-0 mt-1"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    <span>Back</span>
                                </Button>
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-lg font-bold text-gray-900 leading-tight">Settings</h1>
                                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                                        Manage your account preferences and security settings
                                    </p>
                                </div>
                            </div>
                            
                            {/* Bottom row: Navigation tabs - optimized for mobile touch */}
                            <div className="flex items-center justify-between space-x-1 px-2">
                                <Button
                                    variant={currentTab === 'profile' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleTabChange('profile')}
                                    className="text-sm px-3 py-2 min-h-[44px] cursor-pointer flex-1"
                                >
                                    <User className="h-4 w-4 mr-2" />
                                    Profile
                                </Button>
                                <Button
                                    variant={currentTab === 'security' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handleTabChange('security')}
                                    className="text-sm px-3 py-2 min-h-[44px] cursor-pointer flex-1"
                                >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Security
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Error display */}
                    {error && (
                        <div className="mb-6">
                            <Card className="border-red-200 bg-red-50">
                                <CardContent className="p-4">
                                    <div className="flex items-center space-x-2">
                                        <AlertCircle className="h-5 w-5 text-red-600" />
                                        <span className="text-sm text-red-800">{error}</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearError}
                                            className="ml-auto cursor-pointer"
                                        >
                                            Dismiss
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Main content */}
                    <motion.div
                        key={`${currentTab}-${securityView}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {renderTabContent()}
                    </motion.div>
                </div>
            </div>
        );
    } catch (error) {
        console.error('SettingsPage render error:', error);
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="max-w-md">
                    <CardContent className="text-center py-8">
                        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Unable to load the settings page. Please refresh and try again.
                        </p>
                        <Button
                            onClick={() => window.location.reload()}
                            variant="primary"
                            className="cursor-pointer"
                        >
                            Refresh Page
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }
}