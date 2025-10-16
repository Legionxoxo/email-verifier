/**
 * Utility functions for class name manipulation and common operations
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names using clsx and tailwind-merge
 * @param inputs - Class values to combine
 * @returns Combined class string
 */
export function cn(...inputs: ClassValue[]): string {
    try {
        return twMerge(clsx(inputs));
    } catch (error) {
        console.error('Error combining class names:', error);
        return '';
    }
}

/**
 * Debounce function for API calls
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    
    return (...args: Parameters<T>) => {
        try {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        } catch (error) {
            console.error('Debounce error:', error);
        }
    };
}

/**
 * Sleep utility for async operations
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after specified time
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        try {
            setTimeout(resolve, ms);
        } catch (error) {
            console.error('Sleep error:', error);
            resolve();
        }
    });
}

/**
 * Format error message for user display with status code mapping
 * @param error - Error object or string
 * @param statusCode - HTTP status code for specific error mapping
 * @param validationErrors - Array of validation errors from backend
 * @param backendMessage - Specific message from backend API response
 * @returns User-friendly error message
 */
export function formatErrorMessage(error: unknown, statusCode?: number, validationErrors?: any[], backendMessage?: string): string {
    try {
        // PRIORITY 1: Use specific backend message if provided (e.g., from API response data.message)
        if (backendMessage && typeof backendMessage === 'string' && backendMessage.trim()) {
            return backendMessage;
        }
        
        // PRIORITY 2: Handle validation errors specifically (400 status with detailed errors)
        if (statusCode === 400 && validationErrors && validationErrors.length > 0) {
            // Format validation errors into user-friendly messages
            const errorMessages = validationErrors.map(err => err.msg || err.message).filter(Boolean);
            if (errorMessages.length > 0) {
                return errorMessages.join('. ') + '.';
            }
        }
        
        // PRIORITY 3: Extract backend message from error object if available
        if (error && typeof error === 'object' && 'message' in error) {
            const errorMessage = String(error.message);
            // Don't use generic axios messages as backend messages
            if (!errorMessage.includes('Request failed with status code') && 
                !errorMessage.includes('Network Error') && 
                !errorMessage.includes('timeout') &&
                errorMessage !== 'An account with this email already exists. Try logging in instead.' &&
                errorMessage !== 'Invalid information provided. Please check your details and try again.') {
                return errorMessage;
            }
        }
        
        // PRIORITY 4: Use string errors that are meaningful (not generic axios errors)
        if (typeof error === 'string') {
            // Check if it's a generic axios error message and make it user-friendly
            if (error.includes('Request failed with status code')) {
                return 'Connection error. Please check your internet connection and try again.';
            }
            // Don't use our own generic messages as backend messages
            if (error !== 'An account with this email already exists. Try logging in instead.' &&
                error !== 'Invalid information provided. Please check your details and try again.') {
                return error;
            }
        }
        
        // PRIORITY 5: Handle specific HTTP status codes with user-friendly messages (fallback only)
        if (statusCode) {
            switch (statusCode) {
                case 400:
                    return 'Invalid information provided. Please check your details and try again.';
                case 401:
                    return 'Incorrect email or password. Please check your credentials and try again.';
                case 403:
                    return 'Access denied. You don\'t have permission to perform this action.';
                case 404:
                    return 'Account not found. Please check your email address or create a new account.';
                case 409:
                    return 'An account with this email already exists. Try logging in instead.';
                case 422:
                    return 'Invalid data provided. Please check all fields and try again.';
                case 429:
                    return 'Too many attempts. Please wait a moment before trying again.';
                case 500:
                    return 'Server error. Please try again in a few moments.';
                case 502:
                case 503:
                case 504:
                    return 'Service temporarily unavailable. Please try again later.';
                default:
                    break;
            }
        }
        
        // PRIORITY 6: Handle Error objects with network-specific processing
        if (error instanceof Error) {
            // Check for common error patterns and make them user-friendly
            const message = error.message;
            if (message.includes('Request failed with status code')) {
                return 'Connection error. Please check your internet connection and try again.';
            }
            if (message.includes('Network Error')) {
                return 'Network connection error. Please check your internet and try again.';
            }
            if (message.includes('timeout')) {
                return 'Request timed out. Please try again.';
            }
            return message;
        }
        
        return 'An unexpected error occurred. Please try again.';
    } catch (e) {
        console.error('Error formatting error message:', e);
        return 'An unexpected error occurred. Please try again.';
    }
}

/**
 * Check if email format is valid
 * @param email - Email string to validate
 * @returns Boolean indicating if email is valid
 */
export function isValidEmail(email: string): boolean {
    try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    } catch (error) {
        console.error('Email validation error:', error);
        return false;
    }
}

/**
 * Generate a random string for keys/IDs
 * @param length - Length of the string to generate
 * @returns Random string
 */
export function generateRandomString(length: number = 8): string {
    try {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return result;
    } catch (error) {
        console.error('Random string generation error:', error);
        return Date.now().toString();
    }
}

/**
 * Format amount in Indian Rupee currency
 * @param amount - Amount in paise (smallest currency unit)
 * @param showFree - Whether to show "Free" for zero amounts
 * @returns Formatted currency string (e.g., "₹299.50", "Free")
 */
export function formatCurrency(amount: number, showFree: boolean = false): string {
    try {
        if (amount === 0 && showFree) {
            return 'Free';
        }
        
        // Convert paise to rupees (divide by 100)
        const rupees = amount / 100;
        
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(rupees);
    } catch (error) {
        console.error('Currency formatting error:', error);
        // Fallback formatting
        const rupees = amount / 100;
        return `₹${rupees.toFixed(2)}`;
    }
}

/**
 * Format amount in plain currency format without symbol for calculations
 * @param amount - Amount in paise (smallest currency unit)
 * @returns Plain number string (e.g., "299.50")
 */
export function formatAmount(amount: number): string {
    try {
        // Convert paise to rupees (divide by 100)
        const rupees = amount / 100;
        return rupees.toFixed(2);
    } catch (error) {
        console.error('Amount formatting error:', error);
        const rupees = amount / 100;
        return rupees.toFixed(2);
    }
}