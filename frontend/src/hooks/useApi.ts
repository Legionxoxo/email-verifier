/**
 * Custom hook for API calls with loading and error handling
 * Provides consistent API interaction patterns
 */

import { useState, useCallback } from 'react';
import { formatErrorMessage } from '../lib/utils';
import { toast } from 'react-toastify';

interface UseApiState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
    execute: (...args: any[]) => Promise<T>;
    reset: () => void;
    clearError: () => void;
}

/**
 * Custom hook for API calls with loading and error states
 * @param apiFunction - The API function to execute
 * @param showToast - Whether to show toast notifications
 * @returns API state and execution function
 */
export function useApi<T>(
    apiFunction: (...args: any[]) => Promise<T>,
    showToast: boolean = false
): UseApiReturn<T> {
    try {
        const [state, setState] = useState<UseApiState<T>>({
            data: null,
            loading: false,
            error: null,
        });

        const execute = useCallback(async (...args: any[]): Promise<T> => {
            try {
                setState(prev => ({
                    ...prev,
                    loading: true,
                    error: null,
                }));

                const result = await apiFunction(...args);

                setState({
                    data: result,
                    loading: false,
                    error: null,
                });

                if (showToast) {
                    toast.success('Operation completed successfully');
                }

                return result;
            } catch (error) {
                const errorMessage = formatErrorMessage(error);
                
                setState(prev => ({
                    ...prev,
                    loading: false,
                    error: errorMessage,
                }));

                if (showToast) {
                    toast.error(errorMessage);
                }

                throw error;
            }
        }, [apiFunction, showToast]);

        const reset = useCallback(() => {
            try {
                setState({
                    data: null,
                    loading: false,
                    error: null,
                });
            } catch (error) {
                console.error('useApi reset error:', error);
            }
        }, []);

        const clearError = useCallback(() => {
            try {
                setState(prev => ({
                    ...prev,
                    error: null,
                }));
            } catch (error) {
                console.error('useApi clearError error:', error);
            }
        }, []);

        return {
            ...state,
            execute,
            reset,
            clearError,
        };
    } catch (error) {
        console.error('useApi hook error:', error);
        
        // Return safe defaults
        return {
            data: null,
            loading: false,
            error: 'Hook initialization error',
            execute: async () => {
                throw new Error('API execution not available');
            },
            reset: () => {},
            clearError: () => {},
        };
    }
}