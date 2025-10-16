/**
 * Result Analysis Component
 * Displays donut chart with verification statistics
 */

import { BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';


// Interface for stats
interface VerificationStats {
    total: number;
    valid: number;
    invalid: number;
    catchAll: number;
    unknown: number;
}


// Interface for component props
interface ResultAnalysisProps {
    stats: VerificationStats;
}


/**
 * Donut Chart Component
 * Creates an SVG donut chart
 */
function DonutChart({ stats }: { stats: VerificationStats }) {
    const { total, valid, invalid, catchAll, unknown } = stats;

    if (total === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-400">No data to display</p>
            </div>
        );
    }

    // Calculate percentages
    const validPercent = (valid / total) * 100;
    const invalidPercent = (invalid / total) * 100;
    const catchAllPercent = (catchAll / total) * 100;
    const unknownPercent = (unknown / total) * 100;

    // SVG donut chart properties
    const size = 160;
    const strokeWidth = 25;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const centerX = size / 2;
    const centerY = size / 2;

    // Calculate stroke dash arrays for each segment
    let currentOffset = 0;

    const segments = [
        {
            color: '#10b981', // green-500
            percent: validPercent,
            offset: currentOffset
        },
        {
            color: '#f59e0b', // orange-500 (catch-all)
            percent: catchAllPercent,
            offset: (currentOffset += (validPercent / 100) * circumference)
        },
        {
            color: '#f472b6', // pink-400
            percent: invalidPercent,
            offset: (currentOffset += (catchAllPercent / 100) * circumference)
        },
        {
            color: '#d1d5db', // gray-300
            percent: unknownPercent,
            offset: (currentOffset += (invalidPercent / 100) * circumference)
        }
    ];


    return (
        <div className="flex items-center justify-center">
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background circle */}
                <circle
                    cx={centerX}
                    cy={centerY}
                    r={radius}
                    fill="none"
                    stroke="#f3f4f6"
                    strokeWidth={strokeWidth}
                />

                {/* Segments - only render if percent > 0 */}
                {segments.map((segment, index) => {
                    if (segment.percent <= 0) return null;

                    const dashLength = (segment.percent / 100) * circumference;
                    const dashArray = `${dashLength} ${circumference - dashLength}`;

                    return (
                        <circle
                            key={index}
                            cx={centerX}
                            cy={centerY}
                            r={radius}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={dashArray}
                            strokeDashoffset={-segment.offset}
                            strokeLinecap="round"
                        />
                    );
                })}

                {/* Center text */}
                <text
                    x={centerX}
                    y={centerY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="transform rotate-90"
                    style={{ transformOrigin: `${centerX}px ${centerY}px` }}
                >
                    <tspan
                        x={centerX}
                        dy="-0.2em"
                        fontSize="36"
                        fontWeight="bold"
                        fill="#2F327D"
                    >
                        {total}
                    </tspan>
                    <tspan
                        x={centerX}
                        dy="1.8em"
                        fontSize="12"
                        fill="#9CA3AF"
                    >
                        Total Emails
                    </tspan>
                </text>
            </svg>
        </div>
    );
}


/**
 * Result Analysis Component
 * Shows donut chart and statistics legend
 */
export function ResultAnalysis({ stats }: ResultAnalysisProps) {
    const legendItems = [
        { label: 'Valid', value: stats.valid, color: 'bg-green-500' },
        { label: 'Catch-all', value: stats.catchAll, color: 'bg-orange-500' },
        { label: 'Invalid', value: stats.invalid, color: 'bg-pink-400' },
        { label: 'Unknown', value: stats.unknown, color: 'bg-gray-300' }
    ];


    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-[#2F327D]" />
                    <span>Result analysis</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Donut Chart */}
                    <DonutChart stats={stats} />

                    {/* Legend */}
                    <div className="space-y-1.5">
                        {legendItems.map((item, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between py-1.5"
                            >
                                <div className="flex items-center space-x-3">
                                    <div className={`w-4 h-4 rounded ${item.color}`} />
                                    <span className="text-sm font-medium text-gray-700">
                                        {item.label} :
                                    </span>
                                </div>
                                <span className="text-sm font-semibold text-gray-900">
                                    {item.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
