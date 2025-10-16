/**
 * API utility functions for authentication and HTTP requests
 * Uses centralized axios utilities for consistent error handling and type safety
 * 
 * This module provides comprehensive API functionality including:
 * - Authentication operations (login, register, OTP verification)
 * - Subscription management and billing operations
 * - Error handling with user-friendly messages
 * - Type-safe request/response handling
 * - Automatic token management and refresh
 */

import { axiosGet, axiosPost, axiosPut } from './axios';
import { config } from '../data/env';
import { formatErrorMessage } from './utils';
import type { 
    SubscriptionApiResponse,
    PlansApiResponse,
    TransactionsApiResponse,
    RawTransactionsApiResponse,
    PaymentIntentResponse,
    UpgradeRequest,
    UpgradeResponse,
    CancelRequest,
    TransactionFilters,
    PaymentFormData,
    SubscriptionPlan,
    FreeUserResponse,
    UserSubscription,
    RawSubscriptionData,
    BillingTransaction,
    PaymentStatusResponse
} from '../types/subscription';


// API response type definitions

/**
 * Standard login response interface
 * Used for both regular login and signup verification flows
 * Also supports verification required responses
 */
export interface LoginResponse {
    success: boolean;
    message: string;
    code?: string;
    data: {
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            isVerified: boolean;
            name?: string;
        };
        tokens: {
            accessToken: string;
            refreshToken: string;
        };
    } | {
        email: string;
        requiresVerification: boolean;
        redirectToOTP: boolean;
        step: string;
    };
}

/**
 * User profile response interface
 * Contains detailed user information for profile display
 */
export interface UserProfileResponse {
    success: boolean;
    message: string;
    data: {
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            isVerified: boolean;
            createdAt: string;
        };
    };
}

/**
 * Generic API response interface for simple operations
 * Used for operations that don't require specific response data structure
 */
export interface GenericApiResponse {
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
}


// Helper functions

/**
 * Get authorization headers for authenticated requests
 * Retrieves JWT token from localStorage and formats it for API requests
 * 
 * @returns {Record<string, string>} Authorization headers object
 */
function getAuthHeaders(): Record<string, string> {
    try {
        const token = localStorage.getItem(config.auth.jwtStorageKey);
        if (token && token.trim()) {
            return {
                'Authorization': `Bearer ${token.trim()}`,
            };
        }
        return {};
        
    } catch (error) {
        console.error('Error retrieving auth headers:', error);
        return {};
    } finally {
        // Debug logging omitted for production
    }
}


// Authentication API operations

/**
 * Authentication API functions with comprehensive error handling
 * Provides all authentication-related operations including signup verification
 */
export const authApi = {
    /**
     * Authenticate user with email and password
     * Validates credentials and returns user data with auth tokens
     * Or returns verification required response
     * 
     * @param {string} email - User email address
     * @param {string} password - User password
     * @returns {Promise<LoginResponse>} Promise resolving to login response with user and tokens or verification required
     * @throws {Error} If credentials are invalid or network error occurs
     */
    async login(email: string, password: string): Promise<LoginResponse> {
        try {
            const response = await axiosPost<LoginResponse>(
                `${config.api.baseUrl}/api/auth/login`,
                { email, password }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Login failed');
                (error as any).status = response.status;
                throw error;
            }
            
            return response.data!;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Login failed';
            // Check if it's an axios error with response status from our axios utilities
            const statusCode = (error as any)?.status;
            const validationErrors = (error as any)?.validationErrors;
            throw new Error(formatErrorMessage(message, statusCode, validationErrors));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Register new user account with email verification
     * Creates unverified account and sends OTP for email verification
     * 
     * @param {string} email - User email address
     * @param {string} password - User password
     * @param {string} firstName - User first name
     * @param {string} lastName - User last name
     * @returns {Promise<{ userId: string; email: string; requiresVerification: boolean; step: string; isExistingUser?: boolean }>} Promise resolving to registration response data
     * @throws {Error} If email already exists or validation fails
     */
    async register(
        email: string, 
        password: string, 
        firstName: string, 
        lastName: string
    ): Promise<{ userId: string; email: string; requiresVerification: boolean; step: string; isExistingUser?: boolean }> {
        try {
            const requestBody = { email, password, firstName, lastName };
            
            const response = await axiosPost<GenericApiResponse & { data: { userId: string; email: string; requiresVerification: boolean; step: string; isExistingUser?: boolean } }>(
                `${config.api.baseUrl}/api/auth/signup`,
                requestBody
            );
            
            if (!response.success || !response.data) {
                console.error('❌ API response indicates failure');
                
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Registration failed');
                (error as any).status = response.status;
                throw error;
            }
            
            const returnData = response.data.data!;
            
            return returnData;
            
        } catch (error) {
            console.error('❌ API register error:', error);
            
            const message = error instanceof Error ? error.message : 'Registration failed';
            // Check if it's an axios error with response status from our axios utilities
            const statusCode = (error as any)?.status;
            const validationErrors = (error as any)?.validationErrors;
            throw new Error(formatErrorMessage(message, statusCode, validationErrors));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Resend OTP for unverified signup users
     * Allows users who haven't verified their email to receive a new verification code
     * 
     * @param {string} email - User email address to resend OTP to
     * @returns {Promise<GenericApiResponse>} Promise resolving to resend confirmation
     * @throws {Error} If user not found, already verified, or resend fails
     */
    async resendSignupOTP(email: string): Promise<GenericApiResponse> {
        try {
            const response = await axiosPost<GenericApiResponse>(
                `${config.api.baseUrl}/api/auth/signup/resend`,
                { email }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to resend verification code');
                (error as any).status = response.status;
                throw error;
            }
            
            return response.data!;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to resend verification code';
            // Check if it's an axios error with response status from our axios utilities
            const statusCode = (error as any).status || (error as any).response?.status;
            
            // Debug logging omitted for production
            
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Verify signup email with OTP and complete account setup
     * Verifies OTP code, marks account as verified, and automatically logs in user
     * 
     * @param {string} email - User email address to verify
     * @param {string} otp - 6-digit OTP verification code from email
     * @returns {Promise<LoginResponse>} Promise resolving to login response with user and tokens
     * @throws {Error} If OTP is invalid, expired, or verification fails
     */
    async verifySignupOTP(email: string, otp: string): Promise<LoginResponse> {
        try {
            const response = await axiosPost<LoginResponse>(
                `${config.api.baseUrl}/api/auth/signup/verify`,
                { email, otp }
            );
            
            if (!response.success) {
                // Extract specific error message from backend response
                let errorMessage = 'Email verification failed';
                
                // Priority order: backend message > error message > generic fallback
                if (response.data && typeof response.data === 'object' && 'message' in response.data) {
                    errorMessage = String(response.data.message);
                } else if (response.error instanceof Error) {
                    errorMessage = response.error.message;
                } else if (typeof response.error === 'string' && response.error.trim()) {
                    errorMessage = response.error.trim();
                }
                
                const error = new Error(errorMessage);
                (error as any).status = response.status;
                throw error;
            }
            
            return response.data!;
            
        } catch (error) {
            // Preserve backend error messages for better user experience
            let message = 'Invalid verification code. Please try again.';
            
            if (error instanceof Error && error.message.trim()) {
                message = error.message;
            } else if (typeof error === 'string' && error.trim()) {
                message = error.trim();
            }
            
            // Only format generic network errors, preserve specific backend messages
            if (message.includes('Request failed with status code') || 
                message.includes('Network Error') || 
                message.includes('timeout') ||
                message.includes('fetch')) {
                message = formatErrorMessage(error);
            }
            
            throw new Error(message);
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Send OTP verification code to user email
     * Triggers OTP generation and email delivery for login verification
     * 
     * @param {string} email - User email address to send OTP to
     * @returns {Promise<{ message: string }>} Promise resolving to success message
     * @throws {Error} If email is invalid or OTP sending fails
     */
    async sendOTP(email: string): Promise<{ message: string }> {
        try {
            const response = await axiosPost<GenericApiResponse>(
                `${config.api.baseUrl}/api/auth/send-otp`,
                { email }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to send OTP');
                (error as any).status = response.status;
                throw error;
            }
            
            return { message: response.data!.message };
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to send OTP';
            // Check if it's an axios error with response status from our axios utilities
            const statusCode = (error as any)?.status;
            const validationErrors = (error as any)?.validationErrors;
            throw new Error(formatErrorMessage(message, statusCode, validationErrors));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Verify OTP code and complete login process
     * Validates OTP and logs in user with authentication tokens
     * 
     * @param {string} email - User email address
     * @param {string} otp - 6-digit OTP verification code
     * @returns {Promise<LoginResponse>} Promise resolving to login response with user and tokens
     * @throws {Error} If OTP is invalid, expired, or verification fails
     */
    async verifyOTP(email: string, otp: string): Promise<LoginResponse> {
        try {
            const response = await axiosPost<LoginResponse>(
                `${config.api.baseUrl}/api/auth/verify-otp`,
                { email, otp }
            );
            
            if (!response.success) {
                // For failed API responses, try to extract the backend message first
                let errorMessage = 'OTP verification failed';
                
                // Check if we have backend response data with message
                if (response.data && typeof response.data === 'object' && 'message' in response.data) {
                    errorMessage = response.data.message as string;
                } else if (response.error instanceof Error) {
                    errorMessage = response.error.message;
                } else if (typeof response.error === 'string') {
                    errorMessage = response.error;
                }
                
                const error = new Error(errorMessage);
                (error as any).status = response.status;
                throw error;
            }
            
            return response.data!;
            
        } catch (error) {
            // Preserve specific backend error messages for OTP verification
            let message = 'Invalid verification code. Please try again.';
            
            if (error instanceof Error && error.message.trim()) {
                message = error.message;
            } else if (typeof error === 'string' && error.trim()) {
                message = error.trim();
            }
            
            // Only format generic network errors, preserve backend validation messages
            if (message.includes('Request failed with status code') || 
                message.includes('Network Error') || 
                message.includes('timeout') ||
                message.includes('fetch')) {
                message = formatErrorMessage(error);
            }
            
            throw new Error(message);
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Request password reset via email
     * Sends password reset instructions to user email
     * 
     * @param {string} email - User email address for password reset
     * @returns {Promise<{ message: string }>} Promise resolving to success message
     * @throws {Error} If email is invalid or reset request fails
     */
    async resetPassword(email: string): Promise<{ message: string }> {
        try {
            const response = await axiosPost<GenericApiResponse>(
                `${config.api.baseUrl}/api/auth/forgot-password`,
                { email }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Password reset request failed');
                (error as any).status = response.status;
                throw error;
            }
            
            return { message: response.data!.message };
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to send reset link';
            // Check if it's an axios error with response status from our axios utilities
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Get authenticated user profile information
     * Retrieves current user data using stored authentication token
     * 
     * @returns {Promise<UserProfileResponse['data']['user']>} Promise resolving to user profile data
     * @throws {Error} If user is not authenticated or profile retrieval fails
     */
    async getProfile(): Promise<UserProfileResponse['data']['user']> {
        try {
            const response = await axiosGet<UserProfileResponse>(
                `${config.api.baseUrl}/api/auth/profile`,
                { headers: getAuthHeaders() }
            );
            
            // X-Clear-Auth header is now handled globally by axios interceptor
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to get profile');
                (error as any).status = response.status;
                throw error;
            }
            
            return response.data!.data.user;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get profile';
            // Check if it's an axios error with response status from our axios utilities
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Logout user and clear authentication data
     * Invalidates tokens on server and clears local storage
     * 
     * @returns {Promise<{ message: string }>} Promise resolving to logout confirmation
     */
    async logout(): Promise<{ message: string }> {
        try {
            const refreshToken = localStorage.getItem(config.auth.refreshTokenStorageKey);
            
            const response = await axiosPost<GenericApiResponse>(
                `${config.api.baseUrl}/api/auth/logout`,
                { refreshToken },
                { headers: getAuthHeaders() }
            );
            
            // Always clear local storage even if API call fails
            localStorage.removeItem(config.auth.jwtStorageKey);
            localStorage.removeItem(config.auth.userStorageKey);
            localStorage.removeItem(config.auth.refreshTokenStorageKey);
            
            return { message: response.data?.message || 'Logged out successfully' };
            
        } catch (error) {
            // Always clear local storage even on error
            localStorage.removeItem(config.auth.jwtStorageKey);
            localStorage.removeItem(config.auth.userStorageKey);
            localStorage.removeItem(config.auth.refreshTokenStorageKey);
            
            const message = error instanceof Error ? error.message : 'Logout completed';
            return { message: formatErrorMessage(message) };
            
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Refresh authentication tokens
     * Uses refresh token to obtain new access and refresh tokens
     * 
     * @returns {Promise<{ accessToken: string; refreshToken: string }>} Promise resolving to new token pair
     * @throws {Error} If refresh token is invalid or refresh fails
     */
    async refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
        try {
            const refreshToken = localStorage.getItem(config.auth.refreshTokenStorageKey);
            
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }
            
            const response = await axiosPost<{
                success: boolean;
                data: {
                    tokens: {
                        accessToken: string;
                        refreshToken: string;
                    };
                };
            }>(
                `${config.api.baseUrl}/api/auth/refresh`,
                { refreshToken }
            );
            
            // X-Clear-Auth header is now handled globally by axios interceptor
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Token refresh failed');
                (error as any).status = response.status;
                throw error;
            }
            
            return response.data!.data.tokens;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Token refresh failed';
            // Check if it's an axios error with response status from our axios utilities
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Request password reset via email
     * Sends password reset OTP to user's email address
     * 
     * @param {string} email - User email address for password reset
     * @returns {Promise<{ message: string }>} Promise resolving to success message
     * @throws {Error} If email is invalid or reset request fails
     */
    async requestPasswordReset(email: string): Promise<{ message: string }> {
        try {
            const response = await axiosPost<GenericApiResponse>(
                `${config.api.baseUrl}/api/settings/forgot-password`,
                { email }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Password reset request failed');
                (error as any).status = response.status;
                throw error;
            }
            
            return { message: response.data!.message };
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to send password reset';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Complete password reset with OTP and new password
     * Verifies OTP and sets new password for user account
     * 
     * @param {string} email - User email address
     * @param {string} otp - OTP verification code
     * @param {string} newPassword - New password to set
     * @returns {Promise<{ message: string }>} Promise resolving to success message
     * @throws {Error} If OTP is invalid or password reset fails
     */
    async completePasswordReset(email: string, otp: string, newPassword: string): Promise<{ message: string }> {
        try {
            // Send direct fields - let backend handle all security validation
            const response = await axiosPost<GenericApiResponse>(
                `${config.api.baseUrl}/api/settings/reset-password`,
                { email, otp, newPassword }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Password reset failed');
                (error as any).status = response.status;
                throw error;
            }
            
            return { message: response.data!.message };
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to reset password';
            const statusCode = (error as any)?.status;
            const validationErrors = (error as any)?.validationErrors;
            throw new Error(formatErrorMessage(message, statusCode, validationErrors));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Request email change with current password verification
     * Initiates email change process by sending OTP to new email
     * 
     * @param {string} newEmail - New email address
     * @param {string} currentPassword - Current account password for verification
     * @returns {Promise<{ message: string }>} Promise resolving to success message
     * @throws {Error} If password is invalid or email change request fails
     */
    async requestEmailChange(newEmail: string, currentPassword: string): Promise<{ message: string }> {
        try {
            const response = await axiosPost<GenericApiResponse>(
                `${config.api.baseUrl}/api/settings/change-email`,
                { newEmail, currentPassword },
                { headers: getAuthHeaders() }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Email change request failed');
                (error as any).status = response.status;
                throw error;
            }
            
            return { message: response.data!.message };
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to request email change';
            const statusCode = (error as any)?.status;
            const validationErrors = (error as any)?.validationErrors;
            throw new Error(formatErrorMessage(message, statusCode, validationErrors));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Verify email change with OTP
     * Completes email change process by verifying OTP sent to new email
     * 
     * @param {string} newEmail - New email address to verify
     * @param {string} otp - OTP verification code
     * @returns {Promise<{ message: string; user: User }>} Promise resolving to success message and updated user
     * @throws {Error} If OTP is invalid or email change verification fails
     */
    async verifyEmailChange(newEmail: string, otp: string): Promise<{ message: string; user: UserProfileResponse['data']['user'] }> {
        try {
            const response = await axiosPost<{
                success: boolean;
                message: string;
                user: UserProfileResponse['data']['user'];
            }>(
                `${config.api.baseUrl}/api/settings/verify-email-change`,
                { email: newEmail, otp },
                { headers: getAuthHeaders() }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Email change verification failed');
                (error as any).status = response.status;
                throw error;
            }
            
            return {
                message: response.data!.message,
                user: response.data!.user
            };
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to verify email change';
            const statusCode = (error as any)?.status;
            const validationErrors = (error as any)?.validationErrors;
            throw new Error(formatErrorMessage(message, statusCode, validationErrors));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Update user profile information
     * Updates user's name and other profile details
     * 
     * @param {Object} profileData - Profile data to update
     * @param {string} profileData.firstName - User's first name
     * @param {string} profileData.lastName - User's last name
     * @returns {Promise<{ message: string; user: User }>} Promise resolving to success message and updated user
     * @throws {Error} If update fails or validation errors occur
     */
    async updateProfile(profileData: { firstName: string; lastName: string }): Promise<{ message: string; user: UserProfileResponse['data']['user'] }> {
        try {
            const response = await axiosPut<{
                success: boolean;
                message: string;
                data: {
                    message: string;
                    user: UserProfileResponse['data']['user'];
                };
            }>(
                `${config.api.baseUrl}/api/settings/profile`,
                profileData,
                { 
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Profile update failed');
                (error as any).status = response.status;
                throw error;
            }
            
            return response.data!.data;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update profile';
            const statusCode = (error as any)?.status;
            const validationErrors = (error as any)?.validationErrors;
            throw new Error(formatErrorMessage(message, statusCode, validationErrors));
        } finally {
            // Debug logging omitted for production
        }
    },
};


// Subscription and billing API operations

/**
 * Subscription API functions with comprehensive error handling
 * Provides all subscription and billing-related operations
 */
export const subscriptionApi = {
    /**
     * Get available subscription plans
     * @returns Promise with plans array
     */
    async getPlans(): Promise<SubscriptionPlan[]> {
        try {
            const response = await axiosGet<PlansApiResponse>(
                `${config.api.baseUrl}/api/subscriptions/plans`
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to get plans');
                (error as any).status = response.status;
                throw error;
            }
            
            // Extract plans array from nested response structure
            const responseData = response.data!.data;
            const plans = responseData.plans || [];
            
            // Transform plans to ensure required fields are properly mapped
            // Map plan codes to legacy IDs for backward compatibility
            const planCodeToId = { 'free': 1, 'pro': 2, 'plus': 3 };
            
            return plans.map(plan => ({
                ...plan,
                // Generate legacy ID from plan_code for backward compatibility
                id: planCodeToId[plan.plan_code as keyof typeof planCodeToId] || Number(plan.id) || 1,
                // Ensure plan_code is the primary identifier
                plan_code: plan.plan_code,
                // Map backend price fields to frontend expectations
                price: plan.price_monthly || 0, // Default to monthly price
                currency: plan.price_currency || 'INR',
                interval: 'month' as const,
                // Map other backend fields to frontend aliases
                isPopular: plan.is_featured || false,
            }));
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get plans';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Get current user subscription
     * @returns Promise with subscription data
     */
    async getCurrentSubscription(): Promise<UserSubscription | null> {
        try {
            const response = await axiosGet<SubscriptionApiResponse>(
                `${config.api.baseUrl}/api/subscriptions/current`,
                { headers: getAuthHeaders() }
            );
            
            if (!response.success) {
                // Return null for 404 (no subscription found)
                if (response.status === 404) {
                    return null;
                }
                
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to get subscription');
                (error as any).status = response.status;
                throw error;
            }
            
            const apiData = response.data!.data;
            
            // Type guard to check if it's a free user response
            const isFreeUserResponse = (data: any): data is FreeUserResponse => {
                return data && data.subscription === null && data.currentPlan;
            };

            // Type guard to check if it's a raw subscription response
            const isRawSubscriptionResponse = (data: any): data is RawSubscriptionData => {
                return data && data.subscription && typeof data.subscription === 'object' && data.subscription.id;
            };
            
            // Handle free plan users (subscription is null but currentPlan exists)
            if (isFreeUserResponse(apiData)) {
                const currentPlan = apiData.currentPlan;
                const now = new Date().toISOString();
                
                // Create normalized subscription structure for free plan users
                const normalizedSubscription = {
                    id: 'free-plan',
                    userId: 'current-user',
                    planCode: currentPlan.plan_code || 'free',
                    plan: {
                        id: 1, // Legacy ID for backward compatibility
                        plan_code: currentPlan.plan_code || 'free',
                        name: currentPlan.name || 'Free',
                        displayName: currentPlan.name || 'Free',
                        description: currentPlan.description || 'Basic features to get started',
                        price_monthly: currentPlan.price_monthly || 0,
                        price_currency: 'INR',
                        features: currentPlan.features || [],
                        limits: currentPlan.limits || {},
                        trial_days: currentPlan.trial_days || 0,
                        // Legacy fields for backward compatibility
                        price: currentPlan.price_monthly || 0,
                        currency: 'INR',
                        interval: 'month' as const,
                        isPopular: false,
                    },
                    status: 'active' as const,
                    currentPeriodStart: now,
                    currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
                    cancelAtPeriodEnd: false,
                    createdAt: now,
                    updatedAt: now,
                    // Legacy field for backward compatibility
                    planId: 1
                };
                
                return normalizedSubscription;
            }
            
            // Handle raw subscription response from backend
            if (!isRawSubscriptionResponse(apiData)) {
                throw new Error('Invalid subscription data format');
            }
            
            // Transform paid subscription data to match frontend expectations
            const subscription = apiData.subscription;
            
            // Create normalized subscription structure for paid subscription users
            // Map plan codes to legacy IDs for backward compatibility
            const planCodeToId = { 'free': 1, 'pro': 2, 'plus': 3 };
            const legacyPlanId = planCodeToId[subscription.plan_code as keyof typeof planCodeToId] || subscription.plan_id || 2;
            
            const normalizedSubscription: UserSubscription = {
                id: subscription.id,
                userId: subscription.user_id,
                planCode: subscription.plan_code,
                plan: {
                    id: legacyPlanId, // Legacy ID for backward compatibility
                    plan_code: subscription.plan_code,
                    name: subscription.plan_name || 'Pro',
                    displayName: subscription.plan_name || 'Pro',
                    description: subscription.plan_description || 'Premium features',
                    price_monthly: subscription.price_monthly || 0,
                    price_currency: subscription.price_currency || 'INR',
                    features: subscription.features || [],
                    limits: subscription.limits || {},
                    trial_days: subscription.trial_days || 0,
                    // Legacy fields for backward compatibility
                    price: subscription.price_monthly || 0,
                    currency: subscription.price_currency || 'INR',
                    interval: subscription.billing_cycle === 'yearly' ? 'year' as const : 'month' as const,
                    isPopular: Boolean(subscription.is_featured),
                },
                status: subscription.status as 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing',
                currentPeriodStart: subscription.current_period_start,
                currentPeriodEnd: subscription.current_period_end,
                cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
                canceledAt: subscription.cancelled_at,
                trialStart: subscription.trial_start,
                trialEnd: subscription.trial_end,
                createdAt: subscription.created_at,
                updatedAt: subscription.updated_at,
                // Legacy field for backward compatibility
                planId: legacyPlanId
            };
            
            return normalizedSubscription;
            
        } catch (error) {
            if ((error as any)?.status === 404) {
                return null;
            }
            
            const message = error instanceof Error ? error.message : 'Failed to get subscription';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Create payment intent for new subscription (NOT for upgrades)
     * @param data - Payment form data
     * @returns Promise with payment intent data
     */
    async createPaymentIntent(data: PaymentFormData): Promise<PaymentIntentResponse['data']> {
        try {
            const response = await axiosPost<PaymentIntentResponse>(
                `${config.api.baseUrl}/api/subscriptions/create`,
                data,
                { headers: getAuthHeaders() }
            );
            
            if (!response.success) {
                // Extract backend message from response data if available
                let backendMessage = '';
                if (response.data && typeof response.data === 'object' && 'message' in response.data) {
                    backendMessage = String(response.data.message);
                }
                
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to create payment intent');
                (error as any).status = response.status;
                (error as any).backendMessage = backendMessage;
                throw error;
            }
            
            return response.data!.data;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create payment intent';
            const statusCode = (error as any)?.status;
            const validationErrors = (error as any)?.validationErrors;
            const backendMessage = (error as any)?.backendMessage;
            throw new Error(formatErrorMessage(message, statusCode, validationErrors, backendMessage));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Confirm payment and upgrade subscription
     * @param paymentIntentId - Payment intent ID from Razorpay
     * @param paymentId - Payment ID from Razorpay
     * @param signature - Payment signature from Razorpay (optional, for additional security)
     * @returns Promise with updated subscription
     */
    async confirmPayment(paymentIntentId: string, paymentId: string, signature?: string): Promise<UserSubscription> {
        try {
            const response = await axiosPost<SubscriptionApiResponse>(
                `${config.api.baseUrl}/api/subscriptions/verify-payment`,
                { 
                    razorpay_order_id: paymentIntentId, 
                    razorpay_payment_id: paymentId, 
                    razorpay_signature: signature || '' 
                },
                { headers: getAuthHeaders() }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to confirm payment');
                (error as any).status = response.status;
                throw error;
            }
            
            // This should always return a UserSubscription (paid subscription)
            return response.data!.data as UserSubscription;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to confirm payment';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },


    /**
     * Update subscription plan
     * @param request - Upgrade request data
     * @returns Promise with enhanced upgrade response including billing info
     */
    async updateSubscription(request: UpgradeRequest): Promise<UpgradeResponse['data']> {
        try {
            // Support both planCode and legacy planId for backward compatibility
            const requestData: any = {};
            
            if (request.planCode) {
                requestData.newPlanCode = request.planCode;
            } else if (request.planId) {
                // Convert legacy planId to planCode for backward compatibility
                const idToCodeMap = { 1: 'free', 2: 'pro', 3: 'plus' };
                requestData.newPlanCode = idToCodeMap[request.planId as keyof typeof idToCodeMap] || 'pro';
            } else {
                throw new Error('Either planCode or planId must be provided');
            }
            
            if (request.paymentMethodId) {
                requestData.paymentMethodId = request.paymentMethodId;
            }
            
            const response = await axiosPost<UpgradeResponse>(
                `${config.api.baseUrl}/api/subscriptions/upgrade`,
                requestData,
                { headers: getAuthHeaders() }
            );
            
            if (!response.success) {
                // Extract backend message from response data if available
                let backendMessage = '';
                if (response.data && typeof response.data === 'object' && 'message' in response.data) {
                    backendMessage = String(response.data.message);
                }
                
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to update subscription');
                (error as any).status = response.status;
                (error as any).backendMessage = backendMessage;
                throw error;
            }
            
            // Return the enhanced response with billing and proration info
            return response.data!.data;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update subscription';
            const statusCode = (error as any)?.status;
            const validationErrors = (error as any)?.validationErrors;
            const backendMessage = (error as any)?.backendMessage;
            throw new Error(formatErrorMessage(message, statusCode, validationErrors, backendMessage));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Cancel subscription
     * @param request - Cancellation request data
     * @returns Promise with updated subscription
     */
    async cancelSubscription(request: CancelRequest): Promise<UserSubscription> {
        try {
            const response = await axiosPost<SubscriptionApiResponse>(
                `${config.api.baseUrl}/api/subscriptions/cancel`,
                { immediate: !request.cancelAtPeriodEnd, reason: request.reason, feedback: request.feedback },
                { headers: getAuthHeaders() }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to cancel subscription');
                (error as any).status = response.status;
                throw error;
            }
            
            // Handle different response formats based on cancellation type  
            const apiData = response.data!.data as any;
            
            // For immediate cancellation, we get free plan structure (subscription = null)
            if (!apiData.subscription && apiData.currentPlan) {
                // This is a free user response - normalize it to UserSubscription format
                const currentPlan = apiData.currentPlan;
                const now = new Date().toISOString();
                
                const normalizedSubscription: UserSubscription = {
                    id: 'free-plan',
                    userId: 'current-user',
                    planCode: currentPlan.plan_code || 'free',
                    plan: {
                        id: 1, // Legacy ID for free plan
                        plan_code: currentPlan.plan_code || 'free',
                        name: currentPlan.name || 'Free',
                        displayName: currentPlan.name || 'Free',
                        description: currentPlan.description || 'Basic features to get started',
                        price_monthly: currentPlan.price_monthly || 0,
                        price_currency: 'INR',
                        features: currentPlan.features || [],
                        limits: currentPlan.limits || {},
                        trial_days: currentPlan.trial_days || 0,
                        // Legacy fields for backward compatibility
                        price: currentPlan.price_monthly || 0,
                        currency: 'INR',
                        interval: 'month' as const,
                        isPopular: false,
                    },
                    status: 'active' as const,
                    currentPeriodStart: now,
                    currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
                    cancelAtPeriodEnd: false,
                    createdAt: now,
                    updatedAt: now,
                    planId: 1 // Legacy field
                };
                
                return normalizedSubscription;
            }
            
            // For scheduled cancellation, we get updated subscription data
            if (apiData.subscription) {
                const subscription = apiData.subscription;
                const planCodeToId = { 'free': 1, 'pro': 2, 'plus': 3 };
                const legacyPlanId = planCodeToId[subscription.plan_code as keyof typeof planCodeToId] || subscription.plan_id || 2;
                
                const normalizedSubscription: UserSubscription = {
                    id: subscription.id,
                    userId: subscription.user_id,
                    planCode: subscription.plan_code,
                    plan: {
                        id: legacyPlanId,
                        plan_code: subscription.plan_code,
                        name: subscription.plan_name || 'Pro',
                        displayName: subscription.plan_name || 'Pro',
                        description: subscription.plan_description || 'Premium features',
                        price_monthly: subscription.price_monthly || 0,
                        price_currency: subscription.price_currency || 'INR',
                        features: subscription.features || [],
                        limits: subscription.limits || {},
                        trial_days: subscription.trial_days || 0,
                        // Legacy fields for backward compatibility
                        price: subscription.price_monthly || 0,
                        currency: subscription.price_currency || 'INR',
                        interval: subscription.billing_cycle === 'yearly' ? 'year' as const : 'month' as const,
                        isPopular: Boolean(subscription.is_featured),
                    },
                    status: subscription.status as 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing',
                    currentPeriodStart: subscription.current_period_start,
                    currentPeriodEnd: subscription.current_period_end,
                    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
                    canceledAt: subscription.cancelled_at,
                    trialStart: subscription.trial_start,
                    trialEnd: subscription.trial_end,
                    createdAt: subscription.created_at,
                    updatedAt: subscription.updated_at,
                    planId: legacyPlanId // Legacy field
                };
                
                return normalizedSubscription;
            }
            
            // Fallback - shouldn't happen but handle gracefully
            throw new Error('Invalid cancellation response format');
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to cancel subscription';
            const statusCode = (error as any)?.status;
            const validationErrors = (error as any)?.validationErrors;
            throw new Error(formatErrorMessage(message, statusCode, validationErrors));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Get billing transactions
     * @param filters - Transaction filters
     * @returns Promise with transactions data
     */
    async getTransactions(filters: TransactionFilters = {}): Promise<TransactionsApiResponse['data']> {
        try {
            const queryParams = new URLSearchParams();
            
            // Map frontend status to backend status format
            if (filters.status) {
                const frontendToBackendStatusMap: Record<string, string> = {
                    'succeeded': 'captured',
                    'failed': 'failed',
                    'pending': 'pending',
                    'refunded': 'refunded'
                };
                const backendStatus = frontendToBackendStatusMap[filters.status] || filters.status;
                queryParams.append('status', backendStatus);
            }
            if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
            if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
            if (filters.page) queryParams.append('page', filters.page.toString());
            if (filters.limit) queryParams.append('limit', filters.limit.toString());
            
            const url = `${config.api.baseUrl}/api/subscriptions/history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            
            const response = await axiosGet<RawTransactionsApiResponse>(
                url,
                { headers: getAuthHeaders() }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to get transactions');
                (error as any).status = response.status;
                throw error;
            }
            
            // Handle double-nested data structure from API response
            // API returns: { data: { data: { transactions: [], pagination: {} } } }
            const rawData = response.data!.data;
            
            // Validate data structure
            
            // Ensure we have valid data structure
            if (!rawData || !rawData.data || !rawData.data.transactions || !Array.isArray(rawData.data.transactions)) {
                console.warn('Invalid transaction data received:', rawData);
                return {
                    transactions: [],
                    total: 0,
                    page: 1,
                    limit: 10
                };
            }
            
            // Transform raw transaction data to BillingTransaction format
            const transformedTransactions: BillingTransaction[] = rawData.data.transactions.map((rawTransaction: any): BillingTransaction => {
                // Map status from backend format to frontend format
                const statusMap: Record<string, BillingTransaction['status']> = {
                    'captured': 'succeeded',
                    'failed': 'failed',
                    'pending': 'pending',
                    'refunded': 'refunded',
                    'cancelled': 'cancelled',
                    'created': 'pending'
                };
                
                // Map payment method names
                const methodMap: Record<string, string> = {
                    'card': 'Card',
                    'upi': 'UPI',
                    'netbanking': 'Net Banking',
                    'wallet': 'Wallet',
                    'razorpay_cancellation': 'Cancellation',
                    'razorpay_subscription': 'Subscription',
                    'razorpay_subscription_update': 'Plan Change',
                    'replacement': 'Plan Change'
                };
                
                return {
                    id: rawTransaction.razorpay_payment_id || rawTransaction.id?.toString() || 'unknown',
                    userId: rawTransaction.user_id?.toString() || 'unknown',
                    subscriptionId: rawTransaction.subscription_id?.toString() || 'unknown',
                    amount: rawTransaction.amount || 0,
                    currency: rawTransaction.currency || 'INR',
                    status: statusMap[rawTransaction.status] || 'pending',
                    description: rawTransaction.description || `${rawTransaction.plan_name || 'Plan'} Transaction`,
                    invoiceUrl: undefined, // Not provided in API response
                    paymentMethod: methodMap[rawTransaction.method] || rawTransaction.method || 'Unknown',
                    createdAt: rawTransaction.created_at || new Date().toISOString(),
                    failureReason: rawTransaction.failure_reason || undefined
                };
            });
            
            // Return transformed data in expected format
            return {
                transactions: transformedTransactions,
                total: rawData.data.pagination?.totalRecords || 0,
                page: rawData.data.pagination?.currentPage || 1,
                limit: rawData.data.pagination?.totalPages ? Math.ceil(rawData.data.pagination.totalRecords / rawData.data.pagination.totalPages) : 10
            };
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get transactions';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Download invoice for transaction
     * @param transactionId - Transaction ID
     * @returns Promise with invoice URL or blob
     */
    async downloadInvoice(transactionId: string): Promise<string> {
        try {
            // Note: Invoice download endpoint doesn't exist in backend yet
            // For now, return a placeholder URL
            return `${config.api.baseUrl}/api/subscriptions/invoice/${transactionId}`;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get invoice';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Get account credits
     * @returns Promise with credits data
     */
    async getCredits(): Promise<{ credits: any[], totalBalance: number }> {
        try {
            // Note: Credits endpoint doesn't exist in backend yet
            // For now, return empty credits data
            return { credits: [], totalBalance: 0 };
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get credits';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Apply account credits to next billing cycle
     * @returns Promise with updated credits
     */
    async applyCredits(): Promise<{ message: string }> {
        try {
            // Note: Apply credits endpoint doesn't exist in backend yet
            // For now, return success message
            return { message: 'Credits applied successfully' };
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to apply credits';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },

    /**
     * Get payment status for subscription
     * @param subscriptionId - Subscription ID to check status for
     * @returns Promise with payment status information
     */
    async getPaymentStatus(subscriptionId: string): Promise<PaymentStatusResponse['data']> {
        try {
            const response = await axiosGet<PaymentStatusResponse>(
                `${config.api.baseUrl}/api/subscriptions/${subscriptionId}/payment-status`,
                { headers: getAuthHeaders() }
            );
            
            if (!response.success) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to get payment status');
                (error as any).status = response.status;
                throw error;
            }
            
            return response.data!.data;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get payment status';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        } finally {
            // Debug logging omitted for production
        }
    },
};