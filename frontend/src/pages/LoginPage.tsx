/**
 * Login page component
 * Simple login with email and password
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AuthLayout } from '../components/layout';
import { LoginForm } from '../components/forms';
import { authApi } from '../lib/api';
import { config } from '../data/env';
import { type LoginFormData } from '../lib/validations';


/**
 * Login page with simple authentication
 * @returns LoginPage JSX element
 */
export function LoginPage() {
    try {
        const [isLoading, setIsLoading] = useState(false);
        const navigate = useNavigate();
        const location = useLocation();


        // Get redirect path from location state
        const from = (location.state as Record<string, string>)?.from || '/dashboard';


        const handleLogin = async (data: LoginFormData) => {
            try {
                setIsLoading(true);

                const response = await authApi.login(data.email, data.password);

                // Store user email in localStorage for simple auth
                localStorage.setItem(config.auth.userStorageKey, JSON.stringify({
                    email: response.data.user.email
                }));

                toast.success('Login successful');
                navigate(from, { replace: true });

            } catch (error) {
                console.error('Login error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Login failed. Please try again.';
                toast.error(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };


        return (
            <AuthLayout
                title="Welcome back"
                subtitle="Sign in to your account to continue"
            >
                <LoginForm
                    onLogin={handleLogin}
                    loading={isLoading}
                />
            </AuthLayout>
        );
    } catch (error) {
        console.error('LoginPage render error:', error);

        return (
            <AuthLayout
                title="Sign in"
                subtitle="Welcome back"
            >
                <div className="text-center space-y-4">
                    <p className="text-sm text-error-600">
                        Something went wrong. Please refresh the page and try again.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors cursor-pointer"
                    >
                        Refresh page
                    </button>
                </div>
            </AuthLayout>
        );
    } finally {
        // Debug logging omitted for production
    }
}