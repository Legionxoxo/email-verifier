/**
 * Dashboard layout component
 * Simple, mobile-friendly layout for authenticated user pages
 */

import React from 'react';
import { LogOut, User, Receipt, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../ui';

interface DashboardLayoutProps {
    children: React.ReactNode;
    user?: {
        id: string;
        email: string;
        name?: string;
    };
    onLogout?: () => void;
}

/**
 * Simple dashboard layout with header and main content
 * @param children - Page content
 * @param user - Current user data
 * @param onLogout - Logout handler
 * @returns DashboardLayout JSX element
 */
export function DashboardLayout({
    children,
    user,
    onLogout,
}: DashboardLayoutProps) {
    try {
        const location = useLocation();
        
        const handleLogout = () => {
            try {
                if (onLogout) {
                    onLogout();
                }
            } catch (error) {
                console.error('Error during logout:', error);
            }
        };

        const isActiveRoute = (path: string) => {
            return location.pathname === path || location.pathname.startsWith(path + '/');
        };

        return (
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                    <div className="px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            {/* Logo and title */}
                            <div className="flex items-center space-x-3">
                                <Link to="/dashboard" className="flex items-center space-x-3 cursor-pointer">
                                    <div className="h-8 w-8 bg-gray-900 rounded flex items-center justify-center">
                                        <span className="text-white font-bold text-sm">M</span>
                                    </div>
                                    <div>
                                        <h1 className="text-lg font-semibold text-gray-900">
                                            MicroSAAS Dashboard
                                        </h1>
                                    </div>
                                </Link>
                            </div>

                            {/* Navigation and user actions */}
                            <div className="flex items-center space-x-4">
                                {/* Navigation links */}
                                <nav className="hidden md:flex items-center space-x-1">
                                    <Link
                                        to="/dashboard"
                                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                                            isActiveRoute('/dashboard')
                                                ? 'bg-gray-100 text-gray-900'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        Dashboard
                                    </Link>
                                    <Link
                                        to="/billing"
                                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center space-x-1 ${
                                            isActiveRoute('/billing')
                                                ? 'bg-gray-100 text-gray-900'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Receipt className="h-4 w-4" />
                                        <span>Billing</span>
                                    </Link>
                                    <Link
                                        to="/settings"
                                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center space-x-1 ${
                                            isActiveRoute('/settings')
                                                ? 'bg-gray-100 text-gray-900'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Settings className="h-4 w-4" />
                                        <span>Settings</span>
                                    </Link>
                                </nav>

                                {/* User info and logout */}
                                <div className="flex items-center space-x-3">
                                    <div className="hidden sm:block text-right">
                                        <p className="text-sm font-medium text-gray-900">
                                            {user?.name || 'User'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {user?.email}
                                        </p>
                                    </div>
                                    
                                    <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center sm:hidden">
                                        <User className="h-4 w-4 text-gray-600" />
                                    </div>
                                    
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleLogout}
                                        className="text-gray-600 hover:text-gray-900"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        <span className="hidden sm:inline ml-2">Sign out</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main content */}
                <main className="py-8">
                    <div className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        );
    } catch (error) {
        console.error('DashboardLayout render error:', error);
        
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-lg shadow p-6">
                        <h1 className="text-xl font-bold mb-4">Dashboard</h1>
                        {children}
                    </div>
                </div>
            </div>
        );
    }
}