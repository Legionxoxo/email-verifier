/**
 * API utility functions for authentication and HTTP requests
 * Uses centralized axios utilities for consistent error handling and type safety
 *
 * This module provides comprehensive API functionality including:
 * - Authentication operations (login, register, OTP verification)
 * - Error handling with user-friendly messages
 * - Type-safe request/response handling
 * - Automatic token management and refresh
 */

import { axiosGet, axiosPost, axiosPut } from './axios';
import { config } from '../data/env';
import { formatErrorMessage } from './utils';


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


// CSV Verification API Types

/**
 * CSV upload response interface
 * Returned after successfully uploading a CSV file
 */
export interface CSVUploadResponse {
    success: boolean;
    csv_upload_id: string;
    original_filename: string;
    has_header: boolean;
    preview: Record<string, string>[];
    headers: string[];
    row_count: number;
    column_count: number;
    file_size: number;
    upload_status: 'uploaded' | 'detecting' | 'ready' | 'submitted';
}

/**
 * Email column detection response interface
 * Returned after detecting the email column in CSV
 */
export interface EmailDetectionResponse {
    success: boolean;
    csv_upload_id: string;
    detected_column: string;
    detected_column_index: number;
    confidence: number;
    column_scores: Record<string, number>;
    upload_status: 'ready';
    warning?: string;
}

/**
 * CSV verification submission response interface
 * Returned after submitting CSV for verification
 */
export interface CSVVerificationResponse {
    success: boolean;
    message: string;
    csv_upload_id: string;
    verification_request_id: string;
    upload_status: 'submitted';
    verification_status: 'pending' | 'processing' | 'completed' | 'failed';
    total_emails: number;
}

/**
 * Verification request details interface
 * Contains full details of a verification request
 */
export interface VerificationRequest {
    verification_request_id: string;
    request_type: 'single' | 'csv' | 'api';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress_step?: 'received' | 'processing' | 'antiGreyListing' | 'complete' | 'failed';
    greylist_found?: boolean;
    blacklist_found?: boolean;
    emails?: string[];
    results?: VerificationResult[];
    pagination?: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
        has_more: boolean;
    };
    statistics?: VerificationStatistics;
    created_at: number;
    updated_at?: number;
    completed_at?: number;
    csv_details?: CSVDetails;
}

/**
 * CSV details interface
 * Contains CSV-specific metadata
 */
export interface CSVDetails {
    csv_upload_id: string;
    list_name?: string | null;
    original_filename: string;
    row_count: number;
    column_count: number;
    has_header: boolean;
    headers: string[];
    selected_email_column: string;
    detection_confidence: number;
    download_url: string;
}

/**
 * Verification result interface
 * Contains the verification result for a single email
 */
export interface VerificationResult {
    email: string;
    status: 'valid' | 'invalid' | 'catch-all' | 'unknown';
    message: string;
}

/**
 * Verification statistics interface
 * Contains aggregated statistics for verification results
 */
export interface VerificationStatistics {
    total_emails: number;
    valid: number;
    invalid: number;
    catch_all: number;
    unknown: number;
    percentages: {
        valid: number;
        invalid: number;
        catch_all: number;
        unknown: number;
    };
}

/**
 * Verification history item interface
 * Summary of a verification request in history list
 */
export interface VerificationHistoryItem {
    verification_request_id: string;
    request_type: 'single' | 'csv' | 'api';
    email_count: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: number;
    updated_at: number;
    completed_at?: number;
    csv_upload_id?: string;
    list_name?: string | null;
    original_filename?: string;
    file_size?: number;
    status_url?: string;
    results_url?: string | null;
    download_url?: string | null;
}

/**
 * History response interface
 * Paginated list of verification requests
 */
export interface HistoryResponse {
    success: boolean;
    requests: VerificationHistoryItem[];
    total: number;
    page: number;
    per_page: number;
}


// CSV Verification API Operations

/**
 * CSV Verification API functions with comprehensive error handling
 * Provides all CSV verification-related operations
 */
export const verificationApi = {
    /**
     * Upload CSV file for verification
     * Uploads file, parses structure, generates preview
     *
     * @param {FormData} formData - FormData containing csvFile and hasHeader
     * @returns {Promise<CSVUploadResponse>} Promise resolving to upload response
     * @throws {Error} If file is invalid or upload fails
     */
    async uploadCSV(formData: FormData): Promise<CSVUploadResponse> {
        try {
            const response = await axiosPost<{
                success: boolean;
                data: CSVUploadResponse;
            }>(
                `${config.api.baseUrl}/api/verifier/csv/upload`,
                formData,
                {
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            if (!response.success || !response.data) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'CSV upload failed');
                (error as any).status = response.status;
                throw error;
            }

            return response.data.data;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'CSV upload failed';
            const statusCode = (error as any)?.status;
            const validationErrors = (error as any)?.validationErrors;
            throw new Error(formatErrorMessage(message, statusCode, validationErrors));
        }
    },

    /**
     * Detect email column in uploaded CSV
     * Analyzes CSV to find column containing emails
     *
     * @param {string} csvUploadId - CSV upload ID
     * @param {string} listName - Name for the email list
     * @param {boolean} hasHeader - Whether CSV has header row
     * @returns {Promise<EmailDetectionResponse>} Promise resolving to detection results
     * @throws {Error} If detection fails
     */
    async detectEmailColumn(csvUploadId: string, listName: string, hasHeader: boolean): Promise<EmailDetectionResponse> {
        try {
            const response = await axiosPost<{
                success: boolean;
                data: EmailDetectionResponse;
            }>(
                `${config.api.baseUrl}/api/verifier/csv/detect-email`,
                {
                    csv_upload_id: csvUploadId,
                    list_name: listName,
                    has_header: hasHeader
                },
                { headers: getAuthHeaders() }
            );

            if (!response.success || !response.data) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Email detection failed');
                (error as any).status = response.status;
                throw error;
            }

            return response.data.data;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Email detection failed';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        }
    },

    /**
     * Submit CSV for verification
     * Extracts emails from selected column and queues for verification
     *
     * @param {string} csvUploadId - CSV upload ID
     * @param {number} emailColumnIndex - Index of column containing emails
     * @returns {Promise<CSVVerificationResponse>} Promise resolving to verification start confirmation
     * @throws {Error} If submission fails
     */
    async submitCSVVerification(csvUploadId: string, emailColumnIndex: number): Promise<CSVVerificationResponse> {
        try {
            const response = await axiosPost<{
                success: boolean;
                message: string;
                data: {
                    csv_upload_id: string;
                    verification_request_id: string;
                    upload_status: 'submitted';
                    verification_status: 'pending' | 'processing' | 'completed' | 'failed';
                    total_emails: number;
                }
            }>(
                `${config.api.baseUrl}/api/verifier/csv/verify`,
                { csv_upload_id: csvUploadId, email_column_index: emailColumnIndex },
                { headers: getAuthHeaders() }
            );

            if (!response.success || !response.data) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Verification submission failed');
                (error as any).status = response.status;
                throw error;
            }

            return {
                success: response.success,
                message: response.data.message,
                ...response.data.data
            };

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Verification submission failed';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        }
    },

    /**
     * Get verification status
     * Retrieves only status and progress information, NO results
     * Use this for polling verification progress
     *
     * @param {string} verificationRequestId - Verification request ID
     * @returns {Promise<VerificationRequest>} Promise resolving to verification status
     * @throws {Error} If request not found or retrieval fails
     */
    async getVerificationStatus(verificationRequestId: string): Promise<VerificationRequest> {
        try {
            const url = `${config.api.baseUrl}/api/verifier/verification/${verificationRequestId}/status`;

            const response = await axiosGet<{
                success: boolean;
                data: VerificationRequest;
            }>(
                url,
                { headers: getAuthHeaders() }
            );

            if (!response.success || !response.data) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to get verification status');
                (error as any).status = response.status;
                throw error;
            }

            return response.data.data;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get verification status';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        }
    },

    /**
     * Get verification results
     * Retrieves paginated results for completed verifications
     * Use this to fetch results after verification is complete
     *
     * @param {string} verificationRequestId - Verification request ID
     * @param {number} page - Page number for pagination (default: 1)
     * @param {number} perPage - Results per page (default: 20)
     * @returns {Promise<VerificationRequest>} Promise resolving to verification results
     * @throws {Error} If request not found or verification not completed
     */
    async getVerificationResults(verificationRequestId: string, page: number = 1, perPage: number = 20): Promise<VerificationRequest> {
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('page', page.toString());
            queryParams.append('per_page', perPage.toString());

            const url = `${config.api.baseUrl}/api/verifier/verification/${verificationRequestId}/results?${queryParams.toString()}`;

            const response = await axiosGet<{
                success: boolean;
                data: VerificationRequest;
            }>(
                url,
                { headers: getAuthHeaders() }
            );

            if (!response.success || !response.data) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to get verification results');
                (error as any).status = response.status;
                throw error;
            }

            return response.data.data;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get verification results';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        }
    },

    /**
     * Get verification history
     * Retrieves paginated list of all verification requests
     *
     * @param {Object} params - Query parameters
     * @param {number} params.page - Page number (default: 1)
     * @param {number} params.per_page - Items per page (default: 50)
     * @param {string} params.type - Filter by request type
     * @param {string} params.status - Filter by status
     * @param {string} params.period - Filter by time period
     * @returns {Promise<HistoryResponse>} Promise resolving to history list
     * @throws {Error} If retrieval fails
     */
    async getHistory(params?: {
        page?: number;
        per_page?: number;
        type?: 'single' | 'csv' | 'api';
        status?: 'pending' | 'processing' | 'completed' | 'failed';
        period?: 'this_month' | 'last_month' | 'last_6_months';
    }): Promise<HistoryResponse> {
        try {
            const queryParams = new URLSearchParams();
            if (params?.page) queryParams.append('page', params.page.toString());
            if (params?.per_page) queryParams.append('per_page', params.per_page.toString());
            if (params?.type) queryParams.append('type', params.type);
            if (params?.status) queryParams.append('status', params.status);
            if (params?.period) queryParams.append('period', params.period);

            const url = `${config.api.baseUrl}/api/verifier/history${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

            const response = await axiosGet<{
                success: boolean;
                data: {
                    requests: VerificationHistoryItem[];
                    total: number;
                    page: number;
                    per_page: number;
                }
            }>(
                url,
                { headers: getAuthHeaders() }
            );

            if (!response.success || !response.data) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Failed to get history');
                (error as any).status = response.status;
                throw error;
            }

            return {
                success: response.success,
                ...response.data.data
            };

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get history';
            const statusCode = (error as any)?.status;
            throw new Error(formatErrorMessage(message, statusCode));
        }
    },

    /**
     * Download CSV results
     * Downloads CSV file with verification results appended
     *
     * @param {string} csvUploadId - CSV upload ID
     * @returns {Promise<Blob>} Promise resolving to CSV file blob
     * @throws {Error} If download fails
     */
    async downloadCSVResults(csvUploadId: string): Promise<Blob> {
        try {
            const token = localStorage.getItem(config.auth.jwtStorageKey);

            const response = await fetch(
                `${config.api.baseUrl}/api/verifier/csv/${csvUploadId}/download`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Download failed with status ${response.status}`);
            }

            const blob = await response.blob();
            return blob;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to download CSV results';
            throw new Error(formatErrorMessage(message));
        }
    },

    /**
     * Verify single email address
     * Submits a single email for verification
     *
     * @param {string} email - Email address to verify
     * @returns {Promise<{ verification_request_id: string; message: string }>} Promise resolving to verification request ID
     * @throws {Error} If verification fails
     */
    async verifySingleEmail(email: string): Promise<{ verification_request_id: string; message: string }> {
        try {
            const response = await axiosPost<{
                success: boolean;
                message: string;
                data: {
                    verification_request_id: string;
                    email: string;
                    status: string;
                }
            }>(
                `${config.api.baseUrl}/api/verifier/verify-single`,
                { email },
                { headers: getAuthHeaders() }
            );

            if (!response.success || !response.data) {
                const error = new Error(response.error instanceof Error ? response.error.message : response.error || 'Single email verification failed');
                (error as any).status = response.status;
                throw error;
            }

            return {
                verification_request_id: response.data.data.verification_request_id,
                message: response.data.message
            };

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Single email verification failed';
            const statusCode = (error as any)?.status;
            const validationErrors = (error as any)?.validationErrors;
            throw new Error(formatErrorMessage(message, statusCode, validationErrors));
        }
    },
};