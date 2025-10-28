/**
 * Axios utility functions with proper error handling for frontend
 * Simple auth version - no tokens, no interceptors
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
 * Create axios instance with basic configuration
 */
const axiosInstance = axios.create({
    timeout: config.api.timeout,
    headers: {
        'Content-Type': 'application/json',
    },
});

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