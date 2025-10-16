/**
 * Protected route component for authentication-required pages
 * Redirects unauthenticated users to login page
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks';
import { LoadingSpinner } from './ui';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAuth?: boolean;
    redirectTo?: string;
}

/**
 * Protected route wrapper component
 * @param children - Components to render if authenticated
 * @param requireAuth - Whether authentication is required (default: true)
 * @param redirectTo - Where to redirect if not authenticated (default: /login)
 * @returns ProtectedRoute JSX element or redirect
 */
export function ProtectedRoute({
    children,
    requireAuth = true,
    redirectTo = '/login',
}: ProtectedRouteProps) {
    try {
        const { isAuthenticated, isLoading } = useAuth();
        const location = useLocation();

        // Show loading while checking auth status
        if (isLoading) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center space-y-4">
                        <LoadingSpinner size="lg" />
                        <p className="text-sm text-gray-600">Loading...</p>
                    </div>
                </div>
            );
        }

        // If auth is required and user is not authenticated, redirect to login
        if (requireAuth && !isAuthenticated) {
            return (
                <Navigate 
                    to={redirectTo} 
                    state={{ from: location.pathname }}
                    replace
                />
            );
        }

        // If auth is not required and user is authenticated, redirect to dashboard
        if (!requireAuth && isAuthenticated) {
            const from = (location.state as any)?.from || '/dashboard';
            return (
                <Navigate 
                    to={from} 
                    replace 
                />
            );
        }

        // Render children if conditions are met
        return <>{children}</>;

    } catch (error) {
        console.error('ProtectedRoute error:', error);
        
        // Fallback to login redirect on error
        return (
            <Navigate 
                to="/login" 
                replace 
            />
        );
    }
}

/**
 * Public route wrapper - redirects authenticated users to dashboard
 * @param children - Components to render if not authenticated
 * @returns PublicRoute JSX element or redirect
 */
export function PublicRoute({ children }: { children: React.ReactNode }) {
    try {
        return (
            <ProtectedRoute requireAuth={false}>
                {children}
            </ProtectedRoute>
        );
    } catch (error) {
        console.error('PublicRoute error:', error);
        return <>{children}</>;
    }
}