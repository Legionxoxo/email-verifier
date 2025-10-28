/**
 * Dashboard layout component
 * Simple, mobile-friendly layout for authenticated user pages
 */

import React from 'react';
import { LogOut, Key, History } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../ui';
import { config } from '../../data/env';


interface DashboardLayoutProps {
    children: React.ReactNode;
}

/**
 * Simple dashboard layout with header and main content
 * @param children - Page content
 * @returns DashboardLayout JSX element
 */
export function DashboardLayout({
    children,
}: DashboardLayoutProps) {
    try {
        const location = useLocation();
        const navigate = useNavigate();


        const handleLogout = () => {
            try {
                // Clear user from localStorage (simple auth - no tokens)
                localStorage.removeItem(config.auth.userStorageKey);

                toast.success('Logged out successfully');
                navigate('/login', { replace: true });
            } catch (error) {
                console.error('Error during logout:', error);
                toast.error('Logout failed. Please try again.');
            } finally {
                // Debug logging omitted for production
            }
        };

        const isActiveRoute = (path: string) => {
            return location.pathname === path || location.pathname.startsWith(path + '/');
        };

        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
                    <div className="px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            {/* Logo and title */}
                            <div className="flex items-center space-x-3">
                                <Link to="/dashboard" className="flex items-center space-x-3 cursor-pointer">
                                    <div className="h-8 w-8 bg-[#0285FF] rounded flex items-center justify-center">
                                        <span className="text-white font-bold text-sm">B</span>
                                    </div>
                                    <div className="hidden sm:block">
                                        <h1 className="text-lg font-semibold text-gray-900">
                                            BrandNav
                                        </h1>
                                    </div>
                                </Link>
                            </div>

                            {/* Navigation and user actions */}
                            <div className="flex items-center space-x-2">
                                {/* Navigation links - Always visible, icon-only on mobile */}
                                <nav className="flex items-center space-x-1">
                                    <Link
                                        to="/api-tokens"
                                        className={`p-2.5 md:px-3 md:py-2 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center md:space-x-2 ${isActiveRoute('/api-tokens')
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                        aria-label="API Keys"
                                    >
                                        <Key className="h-5 w-5" />
                                        <span className="hidden md:inline">API Keys</span>
                                    </Link>
                                    <Link
                                        to="/history"
                                        className={`p-2.5 md:px-3 md:py-2 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center md:space-x-2 ${isActiveRoute('/history')
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                        aria-label="History"
                                    >
                                        <History className="h-5 w-5" />
                                        <span className="hidden md:inline">History</span>
                                    </Link>
                                </nav>

                                {/* Logout button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLogout}
                                    className="text-gray-600 hover:text-gray-900 cursor-pointer p-2.5 md:px-3 md:py-2"
                                    aria-label="Sign out"
                                >
                                    <LogOut className="h-5 w-5" />
                                    <span className="hidden sm:inline ml-2">Sign out</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main content */}
                <main className="flex-1">
                    {children}
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
    } finally {
        // Debug logging omitted for production
    }
}