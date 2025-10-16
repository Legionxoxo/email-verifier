/**
 * Axios utility functions with proper error handling for frontend
 * Provides safe HTTP request functions that don't crash on non-200 responses
 */

import axios, { type AxiosRequestConfig, type AxiosResponse, AxiosError } from 'axios';
import { config } from '../data/env';

/**
 * Response type for axios utilities
 */
export interface ApiResponse<T = any> {
    success: boolean;
    data: T | null;
    status: number;
    error?: string | Error;
    headers?: any;
}

/**
 * Token refresh state management
 */
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value: string) => void;
    reject: (error: any) => void;
}> = [];

/**
 * Process queued requests after token refresh
 */
const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token!);
        }
    });
    
    failedQueue = [];
};

/**
 * Create axios instance with interceptors for token management
 */
const axiosInstance = axios.create({
    timeout: config.api.timeout,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Request interceptor to add authentication token
 */
axiosInstance.interceptors.request.use(
    (requestConfig) => {
        const token = localStorage.getItem(config.auth.jwtStorageKey);
        if (token && requestConfig.headers) {
            requestConfig.headers.Authorization = `Bearer ${token}`;
        }
        return requestConfig;
    },
    (error) => Promise.reject(error)
);

/**
 * Activity tracking for session extension
 */
let lastActivityTime = Date.now();
let activityExtensionInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Track user activity and extend session if needed
 */
const trackActivity = () => {
    lastActivityTime = Date.now();
    
    // Clear existing interval and set new one
    if (activityExtensionInterval) {
        clearInterval(activityExtensionInterval);
    }
    
    // Define time constants
    const thirtyMinutes = 30 * 60 * 1000;
    const oneHour = 60 * 60 * 1000;
    
    // Check for session extension every 30 minutes
    activityExtensionInterval = setInterval(async () => {
        const timeSinceActivity = Date.now() - lastActivityTime;
        
        // If user was active within last 30 minutes and token is older than 1 hour, refresh it
        if (timeSinceActivity < thirtyMinutes) {
            const token = localStorage.getItem(config.auth.jwtStorageKey);
            if (token) {
                try {
                    // Decode token to check its age (simple base64 decode, not verification)
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    const tokenAge = Date.now() - (payload.iat * 1000);
                    
                    if (tokenAge > oneHour) {
                        const refreshToken = localStorage.getItem(config.auth.refreshTokenStorageKey);
                        if (refreshToken) {
                            const refreshResponse = await axiosInstance.post(`${config.api.baseUrl}/api/auth/refresh`, {
                                refreshToken
                            });
                            
                            if (refreshResponse.data?.success && refreshResponse.data?.data?.tokens) {
                                const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data.data.tokens;
                                localStorage.setItem(config.auth.jwtStorageKey, accessToken);
                                localStorage.setItem(config.auth.refreshTokenStorageKey, newRefreshToken);
                                console.debug('Token refreshed due to user activity');
                            }
                        }
                    }
                } catch (error) {
                    console.debug('Activity-based token refresh failed:', error);
                }
            }
        }
    }, thirtyMinutes);
};

// Initialize activity tracking
if (typeof window !== 'undefined') {
    // Track various user interactions
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        window.addEventListener(event, trackActivity, { passive: true });
    });
    
    // Start activity tracking
    trackActivity();
}

/**
 * Response interceptor for automatic token refresh and auth clearing
 */
axiosInstance.interceptors.response.use(
    (response) => {
        // Track API calls as user activity
        trackActivity();
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // CRITICAL: Check for X-Clear-Auth header on ANY 401 response before attempting refresh
        if (error.response?.status === 401) {
            // Skip token refresh for authentication endpoints (login, register, OTP verification)
            const authEndpoints = ['/api/auth/login', '/api/auth/signup', '/api/auth/verify-otp', '/api/auth/signup/verify'];
            const isAuthEndpoint = authEndpoints.some(endpoint => originalRequest.url?.includes(endpoint));
            
            if (isAuthEndpoint) {
                // For authentication endpoints, let the original 401 error pass through
                // Don't attempt token refresh or show session expired messages
                return Promise.reject(error);
            }
            
            // Check if backend indicates auth should be cleared (user deleted/inactive)
            if (error.response.headers && error.response.headers['x-clear-auth'] === 'true') {
                // Clear all authentication data immediately
                localStorage.removeItem(config.auth.jwtStorageKey);
                localStorage.removeItem(config.auth.refreshTokenStorageKey);
                localStorage.removeItem(config.auth.userStorageKey);
                
                // Process any queued requests with error
                processQueue(new Error('User account no longer exists'), null);
                
                // Redirect to login if not already there
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                
                return Promise.reject(new Error('Session cleared - user account no longer exists'));
            }

            // Only attempt token refresh if we haven't already tried and no clear-auth header
            if (!originalRequest._retry) {
                if (isRefreshing) {
                    // Token refresh is already in progress, queue this request
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    }).then(token => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return axiosInstance(originalRequest);
                    }).catch(err => {
                        return Promise.reject(err);
                    });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const refreshToken = localStorage.getItem(config.auth.refreshTokenStorageKey);
                    
                    if (!refreshToken) {
                        // No refresh token available - clear auth and redirect
                        localStorage.removeItem(config.auth.jwtStorageKey);
                        localStorage.removeItem(config.auth.refreshTokenStorageKey);
                        localStorage.removeItem(config.auth.userStorageKey);
                        
                        processQueue(new Error('No refresh token available'), null);
                        
                        if (window.location.pathname !== '/login') {
                            window.location.href = '/login';
                        }
                        
                        throw new Error('No refresh token available');
                    }

                    // Call refresh endpoint
                    const refreshResponse = await axiosInstance.post(`${config.api.baseUrl}/api/auth/refresh`, {
                        refreshToken
                    });

                    // Check if backend indicates auth should be cleared during refresh
                    if (refreshResponse.headers && refreshResponse.headers['x-clear-auth'] === 'true') {
                        // Clear all authentication data immediately
                        localStorage.removeItem(config.auth.jwtStorageKey);
                        localStorage.removeItem(config.auth.refreshTokenStorageKey);
                        localStorage.removeItem(config.auth.userStorageKey);
                        
                        // Redirect to login
                        if (window.location.pathname !== '/login') {
                            window.location.href = '/login';
                        }
                        
                        throw new Error('User account no longer exists');
                    }

                    if (refreshResponse.data?.success && refreshResponse.data?.data?.tokens) {
                        const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data.data.tokens;
                        
                        // Update tokens in localStorage
                        localStorage.setItem(config.auth.jwtStorageKey, accessToken);
                        localStorage.setItem(config.auth.refreshTokenStorageKey, newRefreshToken);
                        
                        // Update authorization header
                        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                        
                        // Process queued requests
                        processQueue(null, accessToken);
                        
                        // Retry original request
                        return axiosInstance(originalRequest);
                    } else {
                        throw new Error('Token refresh failed');
                    }
                } catch (refreshError) {
                    // Token refresh failed, clear tokens and logout
                    console.debug('Token refresh failed, logging out:', refreshError);
                    
                    localStorage.removeItem(config.auth.jwtStorageKey);
                    localStorage.removeItem(config.auth.refreshTokenStorageKey);
                    localStorage.removeItem(config.auth.userStorageKey);
                    
                    processQueue(refreshError, null);
                    
                    // Force redirect to login
                    window.location.href = '/login';
                    
                    return Promise.reject(new Error('Session expired - please login again'));
                } finally {
                    isRefreshing = false;
                }
            }
        }

        return Promise.reject(error);
    }
);

/**
 * Default axios configuration
 */
const defaultConfig: AxiosRequestConfig = {
    timeout: config.api.timeout,
    headers: {
        'Content-Type': 'application/json',
    },
};

/**
 * Sleep utility function
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after specified time
 */
export function sleep(ms: number): Promise<void> {
    try {
        if (typeof ms !== 'number' || ms < 0) {
            throw new Error('Sleep duration must be a positive number');
        }
        
        return new Promise(resolve => setTimeout(resolve, ms));
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Sleep function error:', errorMessage);
        throw error;
    } finally {
        if (config.app.isDevelopment) {
            console.debug(`Sleep function called with ${ms}ms`);
        }
    }
}

/**
 * Safe HTTP GET request that handles errors gracefully
 * @param url - Request URL
 * @param requestConfig - Axios configuration options
 * @returns Promise resolving to response data or error information
 */
export async function axiosGet<T = any>(
    url: string, 
    requestConfig: AxiosRequestConfig = {}
): Promise<ApiResponse<T>> {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }
        
        const mergedConfig = { ...defaultConfig, ...requestConfig };
        
        const response: AxiosResponse<T> = await axiosInstance.get(url, mergedConfig);
        
        return {
            success: true,
            data: response.data,
            status: response.status,
            headers: response.headers,
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (config.app.isDevelopment) {
            console.error(`HTTP GET error for ${url}:`, errorMessage);
        }
        
        // Handle axios errors specifically
        if (error instanceof AxiosError) {
            if (error.response) {
                // Extract backend message from response data if available
                let backendMessage = errorMessage;
                if (error.response.data && typeof error.response.data === 'object' && error.response.data.message) {
                    backendMessage = String(error.response.data.message);
                }
                
                // Server responded with error status - create enhanced error with status and validation errors
                const enhancedError = new Error(backendMessage);
                (enhancedError as any).status = error.response.status;
                (enhancedError as any).validationErrors = error.response.data?.errors || [];
                
                return {
                    success: false,
                    error: enhancedError,
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers,
                };
            } else if (error.request) {
                // Request was made but no response received
                return {
                    success: false,
                    error: 'No response received from server',
                    status: 0,
                    data: null,
                };
            }
        }
        
        // Something else went wrong
        return {
            success: false,
            error: errorMessage,
            status: 0,
            data: null,
        };
        
    } finally {
        if (config.app.isDevelopment) {
            console.debug(`HTTP GET request completed for ${url}`);
        }
    }
}

/**
 * Safe HTTP POST request that handles errors gracefully
 * @param url - Request URL
 * @param data - Request body data
 * @param requestConfig - Axios configuration options
 * @returns Promise resolving to response data or error information
 */
export async function axiosPost<T = any>(
    url: string,
    data: any = {},
    requestConfig: AxiosRequestConfig = {}
): Promise<ApiResponse<T>> {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }
        
        const mergedConfig = { ...defaultConfig, ...requestConfig };
        
        const response: AxiosResponse<T> = await axiosInstance.post(url, data, mergedConfig);
        
        return {
            success: true,
            data: response.data,
            status: response.status,
            headers: response.headers,
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (config.app.isDevelopment) {
            console.error(`HTTP POST error for ${url}:`, errorMessage);
        }
        
        // Handle axios errors specifically
        if (error instanceof AxiosError) {
            if (error.response) {
                // Extract backend message from response data if available
                let backendMessage = errorMessage;
                if (error.response.data && typeof error.response.data === 'object' && error.response.data.message) {
                    backendMessage = String(error.response.data.message);
                }
                
                // Server responded with error status - create enhanced error with status and validation errors
                const enhancedError = new Error(backendMessage);
                (enhancedError as any).status = error.response.status;
                (enhancedError as any).validationErrors = error.response.data?.errors || [];
                
                return {
                    success: false,
                    error: enhancedError,
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers,
                };
            } else if (error.request) {
                // Request was made but no response received
                return {
                    success: false,
                    error: 'No response received from server',
                    status: 0,
                    data: null,
                };
            }
        }
        
        // Something else went wrong
        return {
            success: false,
            error: errorMessage,
            status: 0,
            data: null,
        };
        
    } finally {
        if (config.app.isDevelopment) {
            console.debug(`HTTP POST request completed for ${url}`);
        }
    }
}

/**
 * Safe HTTP PUT request that handles errors gracefully
 * @param url - Request URL
 * @param data - Request body data
 * @param requestConfig - Axios configuration options
 * @returns Promise resolving to response data or error information
 */
export async function axiosPut<T = any>(
    url: string,
    data: any = {},
    requestConfig: AxiosRequestConfig = {}
): Promise<ApiResponse<T>> {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }
        
        const mergedConfig = { ...defaultConfig, ...requestConfig };
        
        const response: AxiosResponse<T> = await axiosInstance.put(url, data, mergedConfig);
        
        return {
            success: true,
            data: response.data,
            status: response.status,
            headers: response.headers,
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (config.app.isDevelopment) {
            console.error(`HTTP PUT error for ${url}:`, errorMessage);
        }
        
        // Handle axios errors specifically
        if (error instanceof AxiosError) {
            if (error.response) {
                // Extract backend message from response data if available
                let backendMessage = errorMessage;
                if (error.response.data && typeof error.response.data === 'object' && error.response.data.message) {
                    backendMessage = String(error.response.data.message);
                }
                
                // Server responded with error status - create enhanced error with status and validation errors
                const enhancedError = new Error(backendMessage);
                (enhancedError as any).status = error.response.status;
                (enhancedError as any).validationErrors = error.response.data?.errors || [];
                
                return {
                    success: false,
                    error: enhancedError,
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers,
                };
            } else if (error.request) {
                // Request was made but no response received
                return {
                    success: false,
                    error: 'No response received from server',
                    status: 0,
                    data: null,
                };
            }
        }
        
        // Something else went wrong
        return {
            success: false,
            error: errorMessage,
            status: 0,
            data: null,
        };
        
    } finally {
        if (config.app.isDevelopment) {
            console.debug(`HTTP PUT request completed for ${url}`);
        }
    }
}

/**
 * Safe HTTP DELETE request that handles errors gracefully
 * @param url - Request URL
 * @param requestConfig - Axios configuration options
 * @returns Promise resolving to response data or error information
 */
export async function axiosDelete<T = any>(
    url: string,
    requestConfig: AxiosRequestConfig = {}
): Promise<ApiResponse<T>> {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }
        
        const mergedConfig = { ...defaultConfig, ...requestConfig };
        
        const response: AxiosResponse<T> = await axiosInstance.delete(url, mergedConfig);
        
        return {
            success: true,
            data: response.data,
            status: response.status,
            headers: response.headers,
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (config.app.isDevelopment) {
            console.error(`HTTP DELETE error for ${url}:`, errorMessage);
        }
        
        // Handle axios errors specifically
        if (error instanceof AxiosError) {
            if (error.response) {
                // Extract backend message from response data if available
                let backendMessage = errorMessage;
                if (error.response.data && typeof error.response.data === 'object' && error.response.data.message) {
                    backendMessage = String(error.response.data.message);
                }
                
                // Server responded with error status - create enhanced error with status and validation errors
                const enhancedError = new Error(backendMessage);
                (enhancedError as any).status = error.response.status;
                (enhancedError as any).validationErrors = error.response.data?.errors || [];
                
                return {
                    success: false,
                    error: enhancedError,
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers,
                };
            } else if (error.request) {
                // Request was made but no response received
                return {
                    success: false,
                    error: 'No response received from server',
                    status: 0,
                    data: null,
                };
            }
        }
        
        // Something else went wrong
        return {
            success: false,
            error: errorMessage,
            status: 0,
            data: null,
        };
        
    } finally {
        if (config.app.isDevelopment) {
            console.debug(`HTTP DELETE request completed for ${url}`);
        }
    }
}