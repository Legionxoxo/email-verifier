/**
 * Dashboard layout component
 * Simple, mobile-friendly layout for authenticated user pages
 */

import React from 'react';
import { LogOut, User, Settings, Key, History, Menu, X } from 'lucide-react';
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
 * @param onLogout - Logout handler
 * @returns DashboardLayout JSX element
 */
export function DashboardLayout({
    children,
    onLogout,
}: DashboardLayoutProps) {
    try {
        const location = useLocation();
        const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

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
                                {/* Mobile menu button */}
                                <button
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer"
                                    aria-label="Toggle menu"
                                >
                                    {isMobileMenuOpen ? (
                                        <X className="h-5 w-5" />
                                    ) : (
                                        <Menu className="h-5 w-5" />
                                    )}
                                </button>

                                {/* Navigation links - Desktop */}
                                <nav className="hidden md:flex items-center space-x-1">
                                    <Link
                                        to="/dashboard"
                                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${isActiveRoute('/dashboard')
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        Dashboard
                                    </Link>
                                    <Link
                                        to="/profile"
                                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center space-x-1 ${isActiveRoute('/profile')
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        <User className="h-4 w-4" />
                                        <span>Profile</span>
                                    </Link>
                                    <Link
                                        to="/settings"
                                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center space-x-1 ${isActiveRoute('/settings')
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        <Settings className="h-4 w-4" />
                                        <span>Settings</span>
                                    </Link>
                                    <Link
                                        to="/api-tokens"
                                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center space-x-1 ${isActiveRoute('/api-tokens')
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        <Key className="h-4 w-4" />
                                        <span>API Tokens</span>
                                    </Link>
                                    <Link
                                        to="/history"
                                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center space-x-1 ${isActiveRoute('/history')
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        <History className="h-4 w-4" />
                                        <span>History</span>
                                    </Link>
                                </nav>

                                {/* Logout button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLogout}
                                    className="text-gray-600 hover:text-gray-900 cursor-pointer"
                                >
                                    <LogOut className="h-4 w-4" />
                                    <span className="hidden sm:inline ml-2">Sign out</span>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Mobile menu dropdown */}
                    {isMobileMenuOpen && (
                        <div className="md:hidden border-t border-gray-200 bg-white">
                            <nav className="px-4 py-3 space-y-1">
                                <Link
                                    to="/dashboard"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${isActiveRoute('/dashboard')
                                        ? 'bg-gray-100 text-gray-900'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    <span>Dashboard</span>
                                </Link>
                                <Link
                                    to="/profile"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${isActiveRoute('/profile')
                                        ? 'bg-gray-100 text-gray-900'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    <User className="h-4 w-4" />
                                    <span>Profile</span>
                                </Link>
                                <Link
                                    to="/settings"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${isActiveRoute('/settings')
                                        ? 'bg-gray-100 text-gray-900'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    <Settings className="h-4 w-4" />
                                    <span>Settings</span>
                                </Link>
                                <Link
                                    to="/api-tokens"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${isActiveRoute('/api-tokens')
                                        ? 'bg-gray-100 text-gray-900'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    <Key className="h-4 w-4" />
                                    <span>API Tokens</span>
                                </Link>
                                <Link
                                    to="/history"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${isActiveRoute('/history')
                                        ? 'bg-gray-100 text-gray-900'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    <History className="h-4 w-4" />
                                    <span>History</span>
                                </Link>
                            </nav>
                        </div>
                    )}
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
    }
}