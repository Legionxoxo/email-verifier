/**
 * Authentication context for comprehensive user state management
 * Provides authentication state and methods throughout the application
 * 
 * This context manages:
 * - User authentication state and tokens
 * - Login, registration, and OTP verification flows
 * - Automatic token validation and refresh
 * - Password reset functionality
 * - Session management and cleanup
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authApi } from '../lib/api';
import { config } from '../data/env';
import { toast } from 'react-toastify';


// Type definitions for authentication context

/**
 * User interface representing authenticated user data
 */
export interface User {
    id: string;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    isVerified?: boolean;
}

/**
 * Authentication state interface
 * Represents the current authentication status and user data
 */
interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    // Signup flow state
    signupStep: 'registration' | 'email_verification';
    signupEmail: string;
    // Login verification flow state
    loginStep: 'login' | 'otp_verification';
    loginEmail: string;
    // Password reset flow state
    passwordResetStep: 'email' | 'otp_verification';
    passwordResetEmail: string;
    // Email change flow state
    emailChangeStep: 'change_request' | 'otp_verification';
    emailChangeEmail: string;
}

/**
 * Authentication action types for state management
 * Defines all possible state transitions
 */
type AuthAction =
    | { type: 'AUTH_START' }
    | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
    | { type: 'AUTH_ERROR'; payload: string }
    | { type: 'AUTH_LOGOUT' }
    | { type: 'CLEAR_ERROR' }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_SIGNUP_STEP'; payload: 'registration' | 'email_verification' }
    | { type: 'SET_SIGNUP_EMAIL'; payload: string }
    | { type: 'CLEAR_SIGNUP_STATE' }
    | { type: 'SET_LOGIN_STEP'; payload: 'login' | 'otp_verification' }
    | { type: 'SET_LOGIN_EMAIL'; payload: string }
    | { type: 'CLEAR_LOGIN_STATE' }
    | { type: 'SET_PASSWORD_RESET_STEP'; payload: 'email' | 'otp_verification' }
    | { type: 'SET_PASSWORD_RESET_EMAIL'; payload: string }
    | { type: 'CLEAR_PASSWORD_RESET_STATE' }
    | { type: 'SET_EMAIL_CHANGE_STEP'; payload: 'change_request' | 'otp_verification' }
    | { type: 'SET_EMAIL_CHANGE_EMAIL'; payload: string }
    | { type: 'CLEAR_EMAIL_CHANGE_STATE' };

/**
 * Authentication context interface
 * Combines state and action methods for complete auth functionality
 */
interface AuthContextType extends AuthState {
    // Core authentication methods
    login: (email: string, password: string) => Promise<{ requiresVerification?: boolean; email?: string; redirectToOTP?: boolean } | void>;
    register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ requiresVerification: boolean; email: string; step?: string; userId?: string; isExistingUser?: boolean }>;
    logout: () => Promise<void>;
    
    // OTP and verification methods
    verifySignupOTP: (email: string, otp: string) => Promise<void>;
    sendOTP: (email: string) => Promise<void>;
    verifyOTP: (email: string, otp: string) => Promise<void>;
    
    // Password and profile methods
    resetPassword: (email: string) => Promise<void>;
    refreshUser: () => Promise<void>;
    
    // Settings methods
    requestPasswordReset: (email: string) => Promise<void>;
    completePasswordReset: (email: string, otp: string, newPassword: string) => Promise<void>;
    requestEmailChange: (newEmail: string, currentPassword: string) => Promise<void>;
    verifyEmailChange: (newEmail: string, otp: string) => Promise<void>;
    updateProfile: (profileData: { firstName: string; lastName: string }) => Promise<void>;
    
    // State management methods
    clearError: () => void;
    
    // Signup flow state management
    setSignupStep: (step: 'registration' | 'email_verification') => void;
    setSignupEmail: (email: string) => void;
    clearSignupState: () => void;
    
    // Login verification flow state management
    setLoginStep: (step: 'login' | 'otp_verification') => void;
    setLoginEmail: (email: string) => void;
    clearLoginState: () => void;
    
    // Password reset flow state management
    setPasswordResetStep: (step: 'email' | 'otp_verification') => void;
    setPasswordResetEmail: (email: string) => void;
    clearPasswordResetState: () => void;
    
    // Email change flow state management
    setEmailChangeStep: (step: 'change_request' | 'otp_verification') => void;
    setEmailChangeEmail: (email: string) => void;
    clearEmailChangeState: () => void;
}


// Initial authentication state
const initialState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true, // Start with loading to check existing session
    error: null,
    // Signup flow state
    signupStep: 'registration',
    signupEmail: '',
    // Login verification flow state
    loginStep: 'login',
    loginEmail: '',
    // Password reset flow state
    passwordResetStep: 'email',
    passwordResetEmail: '',
    // Email change flow state
    emailChangeStep: 'change_request',
    emailChangeEmail: '',
};


/**
 * Authentication state reducer
 * Manages all authentication state transitions with error handling
 * 
 * @param {AuthState} state - Current authentication state
 * @param {AuthAction} action - Action to process
 * @returns {AuthState} New authentication state
 */
function authReducer(state: AuthState, action: AuthAction): AuthState {
    try {
        switch (action.type) {
            case 'AUTH_START':
                return {
                    ...state,
                    isLoading: true,
                    error: null,
                };

            case 'AUTH_SUCCESS':
                return {
                    ...state,
                    user: action.payload.user,
                    token: action.payload.token,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                };

            case 'AUTH_ERROR':
                return {
                    ...state,
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    isLoading: false,
                    error: action.payload,
                };

            case 'AUTH_LOGOUT':
                return {
                    ...state,
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    isLoading: false,
                    error: null,
                };

            case 'CLEAR_ERROR':
                return {
                    ...state,
                    error: null,
                };

            case 'SET_LOADING':
                return {
                    ...state,
                    isLoading: action.payload,
                };

            case 'SET_SIGNUP_STEP':
                return {
                    ...state,
                    signupStep: action.payload,
                };

            case 'SET_SIGNUP_EMAIL':
                return {
                    ...state,
                    signupEmail: action.payload,
                };

            case 'CLEAR_SIGNUP_STATE':
                return {
                    ...state,
                    signupStep: 'registration',
                    signupEmail: '',
                };

            case 'SET_LOGIN_STEP':
                return {
                    ...state,
                    loginStep: action.payload,
                };

            case 'SET_LOGIN_EMAIL':
                return {
                    ...state,
                    loginEmail: action.payload,
                };

            case 'CLEAR_LOGIN_STATE':
                return {
                    ...state,
                    loginStep: 'login',
                    loginEmail: '',
                };

            case 'SET_PASSWORD_RESET_STEP':
                return {
                    ...state,
                    passwordResetStep: action.payload,
                };

            case 'SET_PASSWORD_RESET_EMAIL':
                return {
                    ...state,
                    passwordResetEmail: action.payload,
                };

            case 'CLEAR_PASSWORD_RESET_STATE':
                return {
                    ...state,
                    passwordResetStep: 'email',
                    passwordResetEmail: '',
                };

            case 'SET_EMAIL_CHANGE_STEP':
                return {
                    ...state,
                    emailChangeStep: action.payload,
                };

            case 'SET_EMAIL_CHANGE_EMAIL':
                return {
                    ...state,
                    emailChangeEmail: action.payload,
                };

            case 'CLEAR_EMAIL_CHANGE_STATE':
                return {
                    ...state,
                    emailChangeStep: 'change_request',
                    emailChangeEmail: '',
                };

            default:
                console.warn('Unknown auth action type:', (action as any).type);
                return state;
        }
    } catch (error) {
        console.error('Auth reducer error:', error);
        // Return safe fallback state on reducer errors
        return {
            ...state,
            isLoading: false,
            error: 'Authentication state error occurred'
        };
    } finally {
        // Debug logging omitted for production
    }
}


// Create authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication provider props interface
 */
interface AuthProviderProps {
    children: React.ReactNode;
}

/**
 * Authentication provider component with comprehensive session management
 * Manages authentication state, token validation, and automatic session recovery
 * 
 * @param {AuthProviderProps} props - Provider props
 * @param {React.ReactNode} props.children - Child components to wrap
 * @returns {JSX.Element} AuthProvider component with context
 */
export function AuthProvider({ children }: AuthProviderProps) {
    try {
        const [state, dispatch] = useReducer(authReducer, initialState);

        
        // Initialize authentication state on component mount
        useEffect(() => {
            /**
             * Initialize authentication state from stored tokens
             * Validates existing session and recovers user state
             */
            const initAuth = async (): Promise<void> => {
                try {
                    const token = localStorage.getItem(config.auth.jwtStorageKey);
                    const userStr = localStorage.getItem(config.auth.userStorageKey);

                    if (token && userStr && token.trim() && userStr.trim()) {
                        try {
                            // Verify stored token is still valid by fetching profile
                            const profile = await authApi.getProfile();
                            dispatch({
                                type: 'AUTH_SUCCESS',
                                payload: { user: profile, token: token.trim() }
                            });
                            
                            // Debug logging omitted for production
                        } catch (error) {
                            // Token verification failed - clear all auth data
                            // Debug logging omitted for production
                            
                            // Clear all authentication data from storage
                            localStorage.removeItem(config.auth.jwtStorageKey);
                            localStorage.removeItem(config.auth.userStorageKey); 
                            localStorage.removeItem(config.auth.refreshTokenStorageKey);
                            
                            // Update state to logged out
                            dispatch({ type: 'AUTH_LOGOUT' });
                        }
                    } else {
                        // No valid stored session found
                        dispatch({ type: 'AUTH_LOGOUT' });
                    }
                } catch (error) {
                    console.error('Auth initialization error:', error);
                    // Force logout on initialization errors
                    localStorage.removeItem(config.auth.jwtStorageKey);
                    localStorage.removeItem(config.auth.userStorageKey);
                    localStorage.removeItem(config.auth.refreshTokenStorageKey);
                    dispatch({ type: 'AUTH_LOGOUT' });
                } finally {
                    dispatch({ type: 'SET_LOADING', payload: false });
                }
            };

            // Add timeout failsafe to prevent infinite loading states
            const timeoutId = setTimeout(() => {
                console.warn('Auth initialization timed out, forcing logout');
                localStorage.removeItem(config.auth.jwtStorageKey);
                localStorage.removeItem(config.auth.userStorageKey);
                localStorage.removeItem(config.auth.refreshTokenStorageKey);
                dispatch({ type: 'AUTH_LOGOUT' });
                dispatch({ type: 'SET_LOADING', payload: false });
            }, 10000); // 10 second timeout

            initAuth().finally(() => {
                clearTimeout(timeoutId);
            });

            return () => {
                clearTimeout(timeoutId);
            };
        }, []);

        
        // Authentication method implementations
        
        /**
         * Login user with email and password
         * Authenticates user and stores session data
         * Returns verification info if account needs verification
         */
        const login = async (email: string, password: string): Promise<{ requiresVerification?: boolean; email?: string; redirectToOTP?: boolean } | void> => {
            try {
                dispatch({ type: 'AUTH_START' });
                
                const response = await authApi.login(email.trim(), password);
                
                // Type guard to check if this is a verification required response
                const isVerificationRequired = (data: any): data is { email: string; requiresVerification: boolean; redirectToOTP: boolean; step: string } => {
                    return data && typeof data === 'object' && 'redirectToOTP' in data;
                };
                
                // Type guard to check if this is a successful login response
                const isSuccessfulLogin = (data: any): data is { user: any; tokens: any } => {
                    return data && typeof data === 'object' && 'tokens' in data;
                };
                
                // Check if this is a verification required response
                if (response.code === 'VERIFICATION_REQUIRED' && isVerificationRequired(response.data)) {
                    dispatch({ type: 'SET_LOADING', payload: false });
                    
                    // Set login verification state in AuthContext to persist across remounts
                    dispatch({ type: 'SET_LOGIN_EMAIL', payload: response.data.email });
                    dispatch({ type: 'SET_LOGIN_STEP', payload: 'otp_verification' });
                    
                    return {
                        requiresVerification: true,
                        email: response.data.email,
                        redirectToOTP: true
                    };
                }
                
                // Normal successful login - verify data structure
                if (isSuccessfulLogin(response.data)) {
                    // Store authentication data in localStorage
                    localStorage.setItem(config.auth.jwtStorageKey, response.data.tokens.accessToken);
                    localStorage.setItem(config.auth.userStorageKey, JSON.stringify(response.data.user));
                    localStorage.setItem(config.auth.refreshTokenStorageKey, response.data.tokens.refreshToken);
                    
                    // Clear login verification state on successful login
                    dispatch({ type: 'CLEAR_LOGIN_STATE' });
                    
                    dispatch({
                        type: 'AUTH_SUCCESS',
                        payload: { user: response.data.user, token: response.data.tokens.accessToken }
                    });
                    
                    toast.success('Welcome back!');
                } else {
                    throw new Error('Invalid login response format');
                }
            } catch (error) {
                let message = error instanceof Error ? error.message : 'Login failed';
                
                // Check for unverified account error (fallback for old error handling)
                if (message.includes('not verified') || message.includes('ACCOUNT_NOT_VERIFIED')) {
                    message = 'Your account is not verified. Please check your email and complete verification, or use OTP login to verify automatically.';
                    toast.error(message, { autoClose: 6000 }); // Show longer for important message
                } else {
                    toast.error(message);
                }
                
                dispatch({ type: 'AUTH_ERROR', payload: message });
                throw error;
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Register new user with email verification flow
         * Creates account and initiates email verification process
         */
        const register = async (
            email: string, 
            password: string, 
            firstName: string = '', 
            lastName: string = ''
        ): Promise<{ requiresVerification: boolean; email: string; step?: string; userId?: string; isExistingUser?: boolean }> => {
            
            try {
                dispatch({ type: 'AUTH_START' });
                const response = await authApi.register(
                    email.trim(), 
                    password, 
                    firstName.trim(), 
                    lastName.trim()
                );
                
                // Registration creates unverified account - user needs to verify email
                dispatch({ type: 'SET_LOADING', payload: false });
                
                // Automatically set signup flow state when verification is required
                if (response.requiresVerification) {
                    dispatch({ type: 'SET_SIGNUP_EMAIL', payload: response.email });
                    dispatch({ type: 'SET_SIGNUP_STEP', payload: 'email_verification' });
                }
                
                // Return verification requirements for signup flow
                const returnData = {
                    requiresVerification: response.requiresVerification,
                    email: response.email,
                    step: response.step,
                    userId: response.userId,
                    isExistingUser: response.isExistingUser
                };
                
                
                return returnData;
                
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Registration failed';
                dispatch({ type: 'AUTH_ERROR', payload: message });
                toast.error(message);
                throw error;
            }
        };

        /**
         * Verify signup OTP and complete account setup
         * Verifies email and automatically logs in user
         */
        const verifySignupOTP = async (email: string, otp: string): Promise<void> => {
            try {
                dispatch({ type: 'AUTH_START' });
                
                const response = await authApi.verifySignupOTP(email.trim(), otp.trim());
                
                // Type guard to check if this is a successful login response
                const isSuccessfulLogin = (data: any): data is { user: any; tokens: any } => {
                    return data && typeof data === 'object' && 'tokens' in data;
                };
                
                if (isSuccessfulLogin(response.data)) {
                    // Store authentication data after successful verification
                    localStorage.setItem(config.auth.jwtStorageKey, response.data.tokens.accessToken);
                    localStorage.setItem(config.auth.userStorageKey, JSON.stringify(response.data.user));
                    localStorage.setItem(config.auth.refreshTokenStorageKey, response.data.tokens.refreshToken);
                    
                    // Clear signup flow state after successful verification
                    dispatch({ type: 'CLEAR_SIGNUP_STATE' });
                    
                    dispatch({
                        type: 'AUTH_SUCCESS',
                        payload: { user: response.data.user, token: response.data.tokens.accessToken }
                    });
                    
                    toast.success('Welcome! Your account is now verified and ready to use.');
                } else {
                    throw new Error('Invalid verification response format');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Verification failed';
                dispatch({ type: 'AUTH_ERROR', payload: message });
                toast.error(message);
                throw error;
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Send OTP verification code to email
         * Requests OTP without changing global loading state
         */
        const sendOTP = async (email: string): Promise<void> => {
            try {
                // Don't change global loading state for OTP requests
                // This prevents unnecessary component remounts
                await authApi.sendOTP(email.trim());
                
                toast.success('Login code sent to your email!');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to send OTP';
                // Clear any previous errors but don't change loading state
                dispatch({ type: 'CLEAR_ERROR' });
                toast.error(message);
                throw error;
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Verify OTP code and complete login
         * Used for OTP-based login flow
         */
        const verifyOTP = async (email: string, otp: string): Promise<void> => {
            try {
                dispatch({ type: 'AUTH_START' });
                
                const response = await authApi.verifyOTP(email.trim(), otp.trim());
                
                // Type guard to check if this is a successful login response
                const isSuccessfulLogin = (data: any): data is { user: any; tokens: any } => {
                    return data && typeof data === 'object' && 'tokens' in data;
                };
                
                if (isSuccessfulLogin(response.data)) {
                    // Store authentication data after successful OTP verification
                    localStorage.setItem(config.auth.jwtStorageKey, response.data.tokens.accessToken);
                    localStorage.setItem(config.auth.userStorageKey, JSON.stringify(response.data.user));
                    localStorage.setItem(config.auth.refreshTokenStorageKey, response.data.tokens.refreshToken);
                    
                    // Clear login verification state on successful OTP verification
                    dispatch({ type: 'CLEAR_LOGIN_STATE' });
                    
                    dispatch({
                        type: 'AUTH_SUCCESS',
                        payload: { user: response.data.user, token: response.data.tokens.accessToken }
                    });
                    
                    toast.success('Welcome!');
                } else {
                    throw new Error('Invalid OTP verification response format');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Invalid verification code';
                dispatch({ type: 'AUTH_ERROR', payload: message });
                toast.error(message);
                throw error;
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Request password reset via email
         * Sends password reset instructions to user
         */
        const resetPassword = async (email: string): Promise<void> => {
            try {
                dispatch({ type: 'AUTH_START' });
                
                await authApi.resetPassword(email.trim());
                
                dispatch({ type: 'SET_LOADING', payload: false });
                toast.success('Password reset link sent to your email!');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to send reset link';
                dispatch({ type: 'AUTH_ERROR', payload: message });
                toast.error(message);
                throw error;
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Logout user and clear all authentication data
         * Handles both API logout and local cleanup
         */
        const logout = async (): Promise<void> => {
            try {
                // Attempt to notify server of logout
                try {
                    await authApi.logout();
                } catch (error) {
                    // Continue with logout even if API call fails
                    console.warn('Logout API call failed, continuing with local cleanup:', error);
                }
                
                // Always clear all authentication data from localStorage
                localStorage.removeItem(config.auth.jwtStorageKey);
                localStorage.removeItem(config.auth.userStorageKey);
                localStorage.removeItem(config.auth.refreshTokenStorageKey);
                
                dispatch({ type: 'AUTH_LOGOUT' });
                toast.success('Signed out successfully');
            } catch (error) {
                console.error('Logout error:', error);
                // Force logout cleanup even on errors
                localStorage.removeItem(config.auth.jwtStorageKey);
                localStorage.removeItem(config.auth.userStorageKey);
                localStorage.removeItem(config.auth.refreshTokenStorageKey);
                dispatch({ type: 'AUTH_LOGOUT' });
                toast.success('Signed out');
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Clear current authentication error state
         * Used for dismissing error messages
         */
        const clearError = (): void => {
            try {
                dispatch({ type: 'CLEAR_ERROR' });
            } catch (error) {
                console.error('Clear error function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Set signup step
         * Updates the current step in the signup flow
         */
        const setSignupStep = (step: 'registration' | 'email_verification'): void => {
            try {
                dispatch({ type: 'SET_SIGNUP_STEP', payload: step });
            } catch (error) {
                console.error('Set signup step function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Set signup email
         * Updates the email being used in the signup flow
         */
        const setSignupEmail = (email: string): void => {
            try {
                dispatch({ type: 'SET_SIGNUP_EMAIL', payload: email });
            } catch (error) {
                console.error('Set signup email function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Clear signup state
         * Resets the signup flow to initial state
         */
        const clearSignupState = (): void => {
            try {
                dispatch({ type: 'CLEAR_SIGNUP_STATE' });
            } catch (error) {
                console.error('Clear signup state function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Set login verification step
         * Updates the current step in the login verification flow
         */
        const setLoginStep = (step: 'login' | 'otp_verification'): void => {
            try {
                dispatch({ type: 'SET_LOGIN_STEP', payload: step });
            } catch (error) {
                console.error('Set login step function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Set login verification email
         * Updates the email being used in the login verification flow
         */
        const setLoginEmail = (email: string): void => {
            try {
                dispatch({ type: 'SET_LOGIN_EMAIL', payload: email });
            } catch (error) {
                console.error('Set login email function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Clear login verification state
         * Resets the login verification flow to initial state
         */
        const clearLoginState = (): void => {
            try {
                dispatch({ type: 'CLEAR_LOGIN_STATE' });
            } catch (error) {
                console.error('Clear login state function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Set password reset step
         * Updates the current step in the password reset flow
         */
        const setPasswordResetStep = (step: 'email' | 'otp_verification'): void => {
            try {
                dispatch({ type: 'SET_PASSWORD_RESET_STEP', payload: step });
            } catch (error) {
                console.error('Set password reset step function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Set password reset email
         * Updates the email being used in the password reset flow
         */
        const setPasswordResetEmail = (email: string): void => {
            try {
                dispatch({ type: 'SET_PASSWORD_RESET_EMAIL', payload: email });
            } catch (error) {
                console.error('Set password reset email function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Clear password reset state
         * Resets the password reset flow to initial state
         */
        const clearPasswordResetState = (): void => {
            try {
                dispatch({ type: 'CLEAR_PASSWORD_RESET_STATE' });
            } catch (error) {
                console.error('Clear password reset state function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Set email change step
         * Updates the current step in the email change flow
         */
        const setEmailChangeStep = (step: 'change_request' | 'otp_verification'): void => {
            try {
                dispatch({ type: 'SET_EMAIL_CHANGE_STEP', payload: step });
            } catch (error) {
                console.error('Set email change step function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Set email change email
         * Updates the email being changed to in the email change flow
         */
        const setEmailChangeEmail = (email: string): void => {
            try {
                dispatch({ type: 'SET_EMAIL_CHANGE_EMAIL', payload: email });
            } catch (error) {
                console.error('Set email change email function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Clear email change state
         * Resets the email change flow to initial state
         */
        const clearEmailChangeState = (): void => {
            try {
                dispatch({ type: 'CLEAR_EMAIL_CHANGE_STATE' });
            } catch (error) {
                console.error('Clear email change state function failed:', error);
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Refresh current user profile data
         * Updates user information from server
         */
        const refreshUser = async (): Promise<void> => {
            try {
                if (state.token && state.isAuthenticated) {
                    const profile = await authApi.getProfile();
                    
                    // Update user data in localStorage
                    localStorage.setItem(config.auth.userStorageKey, JSON.stringify(profile));
                    
                    dispatch({
                        type: 'AUTH_SUCCESS',
                        payload: { user: profile, token: state.token }
                    });
                } else {
                    console.warn('Cannot refresh user: no valid authentication token');
                }
            } catch (error) {
                console.error('Refresh user error:', error);
                
                // Check if error indicates session is no longer valid
                if (error instanceof Error && error.message.includes('Session cleared')) {
                    // Axios interceptor already handled cleanup, just update state
                    dispatch({ type: 'AUTH_LOGOUT' });
                    return;
                }
                
                // For other errors, perform complete logout
                await logout();
                throw error;
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Request password reset via email
         * Sends password reset OTP to user's email address
         */
        const requestPasswordReset = async (email: string): Promise<void> => {
            try {
                dispatch({ type: 'AUTH_START' });
                
                await authApi.requestPasswordReset(email.trim());
                
                // Set password reset state for step transition
                dispatch({ type: 'SET_PASSWORD_RESET_EMAIL', payload: email.trim() });
                dispatch({ type: 'SET_PASSWORD_RESET_STEP', payload: 'otp_verification' });
                
                dispatch({ type: 'SET_LOADING', payload: false });
                toast.success('Password reset code sent to your email!');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to send password reset';
                dispatch({ type: 'AUTH_ERROR', payload: message });
                toast.error(message);
                throw error;
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Complete password reset with OTP and new password
         * Verifies OTP and sets new password for user account
         */
        const completePasswordReset = async (email: string, otp: string, newPassword: string): Promise<void> => {
            try {
                dispatch({ type: 'AUTH_START' });
                
                await authApi.completePasswordReset(email.trim(), otp.trim(), newPassword);
                
                // Clear password reset state after successful completion
                dispatch({ type: 'CLEAR_PASSWORD_RESET_STATE' });
                
                dispatch({ type: 'SET_LOADING', payload: false });
                toast.success('Password reset successfully! You can now login with your new password.');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to reset password';
                dispatch({ type: 'AUTH_ERROR', payload: message });
                toast.error(message);
                throw error;
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Request email change with current password verification
         * Initiates email change process by sending OTP to new email
         */
        const requestEmailChange = async (newEmail: string, currentPassword: string): Promise<void> => {
            try {
                dispatch({ type: 'AUTH_START' });
                
                await authApi.requestEmailChange(newEmail.trim(), currentPassword);
                
                // Set email change flow state on successful request
                dispatch({ type: 'SET_EMAIL_CHANGE_EMAIL', payload: newEmail.trim() });
                dispatch({ type: 'SET_EMAIL_CHANGE_STEP', payload: 'otp_verification' });
                
                dispatch({ type: 'SET_LOADING', payload: false });
                toast.success('Verification code sent to your new email address!');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to request email change';
                
                // CRITICAL FIX: Don't dispatch AUTH_ERROR for validation errors
                // AUTH_ERROR should only be used for actual authentication failures (401s)
                // This was causing the user to be logged out on password validation errors
                dispatch({ type: 'SET_LOADING', payload: false });
                toast.error(message);
                throw error;
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Verify email change with OTP
         * Completes email change process by verifying OTP sent to new email
         */
        const verifyEmailChange = async (newEmail: string, otp: string): Promise<void> => {
            try {
                dispatch({ type: 'AUTH_START' });
                
                const response = await authApi.verifyEmailChange(newEmail.trim(), otp.trim());
                
                // Update user data in localStorage with new email
                localStorage.setItem(config.auth.userStorageKey, JSON.stringify(response.user));
                
                // Clear email change flow state on successful verification
                dispatch({ type: 'CLEAR_EMAIL_CHANGE_STATE' });
                
                dispatch({
                    type: 'AUTH_SUCCESS',
                    payload: { user: response.user, token: state.token! }
                });
                
                toast.success('Email address changed successfully!');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to verify email change';
                
                // CRITICAL FIX: Don't dispatch AUTH_ERROR for validation errors
                // AUTH_ERROR should only be used for actual authentication failures (401s)
                // This was causing the user to be logged out on OTP validation errors
                dispatch({ type: 'SET_LOADING', payload: false });
                toast.error(message);
                throw error;
            } finally {
                // Debug logging omitted for production
            }
        };

        /**
         * Update user profile information
         * Updates user's name and other profile details
         */
        const updateProfile = async (profileData: { firstName: string; lastName: string }): Promise<void> => {
            try {
                dispatch({ type: 'AUTH_START' });
                
                const response = await authApi.updateProfile({
                    firstName: profileData.firstName.trim(),
                    lastName: profileData.lastName.trim()
                });
                
                // Update user data in localStorage
                localStorage.setItem(config.auth.userStorageKey, JSON.stringify(response.user));
                
                dispatch({
                    type: 'AUTH_SUCCESS',
                    payload: { user: response.user, token: state.token! }
                });
                
                toast.success('Profile updated successfully!');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to update profile';
                
                // CRITICAL FIX: Don't dispatch AUTH_ERROR for validation errors
                // AUTH_ERROR should only be used for actual authentication failures (401s)
                // This was causing the user to be logged out on profile validation errors
                dispatch({ type: 'SET_LOADING', payload: false });
                toast.error(message);
                throw error;
            } finally {
                // Debug logging omitted for production
            }
        };

        
        // Create context value with state and methods
        const contextValue: AuthContextType = {
            // Current state
            ...state,
            
            // Authentication methods
            login,
            register,
            logout,
            
            // OTP methods
            verifySignupOTP,
            sendOTP,
            verifyOTP,
            
            // Utility methods
            resetPassword,
            refreshUser,
            clearError,
            
            // Settings methods
            requestPasswordReset,
            completePasswordReset,
            requestEmailChange,
            verifyEmailChange,
            updateProfile,
            
            // Signup flow state management
            setSignupStep,
            setSignupEmail,
            clearSignupState,
            
            // Login verification flow state management
            setLoginStep,
            setLoginEmail,
            clearLoginState,
            
            // Password reset flow state management
            setPasswordResetStep,
            setPasswordResetEmail,
            clearPasswordResetState,
            
            // Email change flow state management
            setEmailChangeStep,
            setEmailChangeEmail,
            clearEmailChangeState,
        };

        return (
            <AuthContext.Provider value={contextValue}>
                {children}
            </AuthContext.Provider>
        );
    } catch (error) {
        console.error('AuthProvider render error:', error);
        
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center space-y-4 p-8 bg-white rounded-lg shadow-md">
                    <p className="text-red-600 mb-4 font-medium">
                        Failed to initialize authentication system
                    </p>
                    <p className="text-gray-600 text-sm mb-6">
                        Please refresh the page to try again
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors cursor-pointer"
                    >
                        Reload Application
                    </button>
                </div>
            </div>
        );
    } finally {
        // Debug logging omitted for production
    }
}


/**
 * Custom hook to access authentication context
 * Provides type-safe access to authentication state and methods
 * 
 * @returns {AuthContextType} Authentication context value with state and methods
 * @throws {Error} If used outside of AuthProvider
 */
export function useAuth(): AuthContextType {
    try {
        const context = useContext(AuthContext);
        if (context === undefined) {
            throw new Error('useAuth must be used within an AuthProvider. Make sure your component is wrapped with AuthProvider.');
        }
        return context;
    } catch (error) {
        console.error('useAuth hook error:', error);
        throw error;
    } finally {
        // Debug logging omitted for production
    }
}