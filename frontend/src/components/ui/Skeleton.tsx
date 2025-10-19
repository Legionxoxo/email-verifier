/**
 * Skeleton Loading Component
 * Displays placeholder animations while content is loading
 */

interface SkeletonProps {
    className?: string;
}

/**
 * Base Skeleton component for loading states
 */
export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] rounded ${className}`}
            style={{
                animation: 'shimmer 2s infinite linear'
            }}
        />
    );
}


interface TableSkeletonProps {
    rows?: number;
    columns?: number;
}

/**
 * Table Skeleton component for loading table data
 * @param rows - Number of skeleton rows to display (default: 5)
 * @param columns - Number of columns in the table (default: 4)
 */
export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex space-x-4 items-start py-3 px-6">
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <div
                            key={colIndex}
                            className={`
                                ${colIndex === 0 ? 'flex-1' : ''}
                                ${colIndex === columns - 1 ? 'w-20' : colIndex > 0 ? 'w-32' : ''}
                            `}
                        >
                            <Skeleton
                                className={`h-4 ${colIndex === 0 ? 'w-full' : colIndex === columns - 1 ? 'w-16' : 'w-24'}`}
                            />
                            {colIndex === 0 && (
                                <Skeleton className="h-3 w-20 mt-2" />
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}


interface CardSkeletonProps {
    rows?: number;
}

/**
 * Card Skeleton component for loading card/list items
 * @param rows - Number of skeleton cards to display (default: 3)
 */
export function CardSkeleton({ rows = 3 }: CardSkeletonProps) {
    return (
        <div className="space-y-4">
            {Array.from({ length: rows }).map((_, index) => (
                <div
                    key={index}
                    className="p-4 border border-gray-200 rounded-lg"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-4 w-64" />
                            <div className="flex items-center space-x-4">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        </div>
                        <Skeleton className="h-8 w-8 rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}
