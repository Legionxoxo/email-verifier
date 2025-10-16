/**
 * Loading spinner component with multiple size variants
 */

import { cn } from '../../lib/utils';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    color?: 'primary' | 'white' | 'gray';
}

/**
 * Loading spinner component
 * @param size - Spinner size
 * @param className - Additional CSS classes
 * @param color - Spinner color variant
 * @returns LoadingSpinner JSX element
 */
export function LoadingSpinner({ 
    size = 'md', 
    className,
    color = 'primary'
}: LoadingSpinnerProps) {
    try {
        const sizes = {
            sm: 'h-4 w-4',
            md: 'h-6 w-6',
            lg: 'h-8 w-8',
            xl: 'h-12 w-12',
        };

        const colors = {
            primary: 'border-primary-500',
            white: 'border-white',
            gray: 'border-gray-500',
        };

        const spinnerClasses = cn(
            'animate-spin rounded-full border-2 border-t-transparent',
            sizes[size],
            colors[color],
            className
        );

        return (
            <div 
                className={spinnerClasses}
                role="status"
                aria-label="Loading"
            >
                <span className="sr-only">Loading...</span>
            </div>
        );
    } catch (error) {
        console.error('LoadingSpinner render error:', error);
        return (
            <div className="h-6 w-6 border-2 border-gray-300 rounded-full animate-spin">
                <span className="sr-only">Loading...</span>
            </div>
        );
    }
}