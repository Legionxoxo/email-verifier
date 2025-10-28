/**
 * Protected route component for authentication-required pages
 * Redirects unauthenticated users to login page
 * Simple version without AuthContext
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { config } from '../data/env';


interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAuth?: boolean;
    redirectTo?: string;
}


/**
 * Check if user is authenticated by checking localStorage
 * @returns boolean indicating if user is authenticated
 */
function isAuthenticated(): boolean {
    try {
        const userStr = localStorage.getItem(config.auth.userStorageKey);
        if (!userStr) {
            return false;
        }

        const user = JSON.parse(userStr);
        return !!user && !!user.email;
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    } finally {
        // Debug logging omitted for production
    }
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
        const location = useLocation();
        const authenticated = isAuthenticated();


        // If auth is required and user is not authenticated, redirect to login
        if (requireAuth && !authenticated) {
            return (
                <Navigate
                    to={redirectTo}
                    state={{ from: location.pathname }}
                    replace
                />
            );
        }


        // If auth is not required and user is authenticated, redirect to dashboard
        if (!requireAuth && authenticated) {
            const from = (location.state as Record<string, string>)?.from || '/dashboard';
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
    } finally {
        // Debug logging omitted for production
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
    } finally {
        // Debug logging omitted for production
    }
}