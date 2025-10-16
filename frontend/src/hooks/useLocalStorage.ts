/**
 * Custom hook for localStorage with type safety and error handling
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing localStorage with type safety
 * @param key - localStorage key
 * @param initialValue - Initial value if key doesn't exist
 * @returns [value, setValue, removeValue]
 */
export function useLocalStorage<T>(
    key: string,
    initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
    try {
        // Get initial value from localStorage or use default
        const [storedValue, setStoredValue] = useState<T>(() => {
            try {
                if (typeof window === 'undefined') {
                    return initialValue;
                }

                const item = window.localStorage.getItem(key);
                return item ? JSON.parse(item) : initialValue;
            } catch (error) {
                console.error(`Error reading localStorage key "${key}":`, error);
                return initialValue;
            }
        });

        // Set value in localStorage and state
        const setValue = useCallback((value: T | ((prev: T) => T)) => {
            try {
                setStoredValue(prevValue => {
                    const valueToStore = value instanceof Function ? value(prevValue) : value;
                    
                    try {
                        if (typeof window !== 'undefined') {
                            window.localStorage.setItem(key, JSON.stringify(valueToStore));
                        }
                    } catch (error) {
                        console.error(`Error setting localStorage key "${key}":`, error);
                    }
                    
                    return valueToStore;
                });
            } catch (error) {
                console.error(`Error in setValue for key "${key}":`, error);
            }
        }, [key]);

        // Remove value from localStorage and reset to initial value
        const removeValue = useCallback(() => {
            try {
                setStoredValue(initialValue);
                
                if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(key);
                }
            } catch (error) {
                console.error(`Error removing localStorage key "${key}":`, error);
            }
        }, [key, initialValue]);

        // Listen for changes to localStorage from other tabs/windows
        useEffect(() => {
            try {
                const handleStorageChange = (e: StorageEvent) => {
                    try {
                        if (e.key === key && e.newValue !== null) {
                            setStoredValue(JSON.parse(e.newValue));
                        } else if (e.key === key && e.newValue === null) {
                            setStoredValue(initialValue);
                        }
                    } catch (error) {
                        console.error(`Error handling storage change for key "${key}":`, error);
                    }
                };

                if (typeof window !== 'undefined') {
                    window.addEventListener('storage', handleStorageChange);
                    
                    return () => {
                        window.removeEventListener('storage', handleStorageChange);
                    };
                }
            } catch (error) {
                console.error(`Error setting up storage listener for key "${key}":`, error);
            }
        }, [key, initialValue]);

        return [storedValue, setValue, removeValue];
    } catch (error) {
        console.error(`useLocalStorage hook error for key "${key}":`, error);
        
        // Return safe defaults
        return [
            initialValue,
            () => {},
            () => {},
        ];
    }
}