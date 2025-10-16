/**
 * Verification Results Page
 * Displays verification results with analysis and detailed email list
 */

import { ArrowLeft } from 'lucide-react';
import { DashboardLayout } from '../components/layout';
import { Button } from '../components/ui/Button';
import { ResultAnalysis } from '../components/results/ResultAnalysis';
import { ResultsList } from '../components/results/ResultsList';
import type { User } from '../contexts/AuthContext';


// Email verification result interface
export interface EmailVerificationResult {
    email: string;
    status: 'valid' | 'invalid' | 'catch-all' | 'unknown';
    reason: string;
}


// Interface for component props
interface VerificationResultsPageProps {
    results: EmailVerificationResult[];
    onBack: () => void;
    user?: User;
    onLogout?: () => Promise<void>;
}


/**
 * Verification Results Page Component
 * @param props - Component props
 * @returns JSX element
 */
export function VerificationResultsPage({ results, onBack, user, onLogout }: VerificationResultsPageProps) {
    try {
        // Calculate stats
        const totalEmails = results.length;
        const validCount = results.filter(r => r.status === 'valid').length;
        const invalidCount = results.filter(r => r.status === 'invalid').length;
        const catchAllCount = results.filter(r => r.status === 'catch-all').length;
        const unknownCount = results.filter(r => r.status === 'unknown').length;

        const stats = {
            total: totalEmails,
            valid: validCount,
            invalid: invalidCount,
            catchAll: catchAllCount,
            unknown: unknownCount
        };


        return (
            <DashboardLayout
                user={user}
                onLogout={onLogout}
            >
                <div className="px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header with back button */}
                    <div className="mb-8">
                        <div className="flex items-center space-x-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onBack}
                                className="flex items-center space-x-1 cursor-pointer"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span>Email Verifier</span>
                            </Button>
                        </div>
                    </div>

                    {/* Results Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left column - Result Analysis */}
                        <div>
                            <ResultAnalysis stats={stats} />
                        </div>

                        {/* Right column - Results List */}
                        <div>
                            <ResultsList results={results} totalCount={totalEmails} />
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );

    } catch (error) {
        console.error('VerificationResultsPage render error:', error);

        return (
            <DashboardLayout
                user={user}
                onLogout={onLogout}
            >
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4 p-8">
                        <p className="text-lg font-medium text-gray-900">
                            Failed to load results
                        </p>
                        <p className="text-sm text-gray-600">
                            Unable to display verification results. Please try again.
                        </p>
                        <Button
                            onClick={onBack}
                            variant="primary"
                            className="cursor-pointer"
                        >
                            Go Back
                        </Button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }
}
