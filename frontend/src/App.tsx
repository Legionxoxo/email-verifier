/**
 * Main application component
 * Sets up routing, authentication, and global providers
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';
import { 
    LoginPage, 
    SignupPage, 
    ForgotPasswordPage,
    DashboardPage, 
    NotFoundPage,
    BillingPage,
    PaymentPage,
    SettingsPage
} from './pages';


/**
 * Main App component with routing and authentication
 * @returns JSX element for the application
 */
export default function App() {
    try {
        return (
            <Router>
                <AuthProvider>
                    <div className="min-h-screen bg-gray-50">
                        {/* Toast notifications container */}
                        <ToastContainer
                            position="top-right"
                            autoClose={4000}
                            hideProgressBar={false}
                            newestOnTop={false}
                            closeOnClick
                            rtl={false}
                            pauseOnFocusLoss
                            draggable
                            pauseOnHover
                            theme="light"
                            toastStyle={{
                                background: '#fff',
                                color: '#374151',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontFamily: 'Manrope, Inter, system-ui, sans-serif',
                            }}
                        />

                        {/* Application routes */}
                        <Routes>
                            {/* Root redirect */}
                            <Route 
                                path="/" 
                                element={<Navigate to="/login" replace />} 
                            />

                            {/* Public routes (redirect if authenticated) */}
                            <Route 
                                path="/login" 
                                element={
                                    <PublicRoute>
                                        <LoginPage />
                                    </PublicRoute>
                                } 
                            />
                            
                            <Route 
                                path="/signup" 
                                element={
                                    <PublicRoute>
                                        <SignupPage />
                                    </PublicRoute>
                                } 
                            />

                            <Route 
                                path="/forgot-password" 
                                element={
                                    <PublicRoute>
                                        <ForgotPasswordPage />
                                    </PublicRoute>
                                } 
                            />

                            {/* Protected routes (require authentication) */}
                            <Route 
                                path="/dashboard" 
                                element={
                                    <ProtectedRoute>
                                        <DashboardPage />
                                    </ProtectedRoute>
                                } 
                            />

                            <Route 
                                path="/billing" 
                                element={
                                    <ProtectedRoute>
                                        <BillingPage />
                                    </ProtectedRoute>
                                } 
                            />

                            <Route 
                                path="/payment" 
                                element={
                                    <ProtectedRoute>
                                        <PaymentPage />
                                    </ProtectedRoute>
                                } 
                            />

                            <Route 
                                path="/settings" 
                                element={
                                    <ProtectedRoute>
                                        <SettingsPage />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Redirect /subscription to /billing for backward compatibility */}
                            <Route 
                                path="/subscription" 
                                element={<Navigate to="/billing" replace />}
                            />

                            {/* 404 page */}
                            <Route 
                                path="*" 
                                element={<NotFoundPage />} 
                            />
                        </Routes>
                    </div>
                </AuthProvider>
            </Router>
        );
    } catch (error) {
        console.error('App render error:', error);
        
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-gray-900">
                        Application Error
                    </h1>
                    <p className="text-gray-600">
                        Something went wrong loading the application.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        Reload Application
                    </button>
                </div>
            </div>
        );
    }
}