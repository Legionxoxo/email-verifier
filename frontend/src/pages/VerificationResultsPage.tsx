/**
 * Verification Results Page
 * Displays verification results with analysis and detailed email list
 */

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout';
import { Button } from '../components/ui/Button';
import { ResultAnalysis } from '../components/results/ResultAnalysis';
import { ResultsList } from '../components/results/ResultsList';
import { useAuth } from '../hooks';
import { verificationApi } from '../lib/api';
import type { User } from '../contexts/AuthContext';


// Email verification result interface
export interface EmailVerificationResult {
    email: string;
    status: 'valid' | 'invalid' | 'catch-all' | 'unknown';
    reason: string;
}


// Interface for component props (for backward compatibility when used as component)
interface VerificationResultsPageProps {
    results?: EmailVerificationResult[];
    onBack?: () => void;
    user?: User;
    onLogout?: () => Promise<void>;
}


/**
 * Verification Results Page Component
 * @param props - Component props (optional, for backward compatibility)
 * @returns JSX element
 */
export function VerificationResultsPage({
    results: propsResults,
    onBack: propsOnBack,
    user: propsUser,
    onLogout: propsOnLogout
}: VerificationResultsPageProps = {}) {
    const navigate = useNavigate();
    const { verificationRequestId } = useParams<{ verificationRequestId: string }>();
    const { user: authUser, logout: authLogout } = useAuth();

    // State for fetched results
    const [results, setResults] = useState<EmailVerificationResult[]>(propsResults || []);
    const [loading, setLoading] = useState<boolean>(!propsResults);
    const [error, setError] = useState<string>('');

    // Use props if provided (component mode), otherwise use hooks (route mode)
    const user = propsUser || authUser;
    const onLogout = propsOnLogout || authLogout;


    // Fetch results from API if not provided via props
    useEffect(() => {
        if (propsResults || !verificationRequestId) return;

        const fetchResults = async () => {
            try {
                setLoading(true);
                setError('');

                console.log('Fetching verification results for:', verificationRequestId);

                const details = await verificationApi.getVerificationDetails(verificationRequestId);
                console.log('Verification details:', details);

                if (details.status !== 'completed') {
                    setError('Verification is not completed yet');
                    return;
                }

                // Map API results to local format
                const mappedResults: EmailVerificationResult[] = (details.results || []).map(r => ({
                    email: r.email,
                    status: r.status,
                    reason: r.message
                }));

                setResults(mappedResults);

            } catch (error) {
                console.error('Failed to fetch results:', error);
                setError(error instanceof Error ? error.message : 'Failed to load results');
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [verificationRequestId, propsResults]);


    // Handle back navigation
    const handleBack = () => {
        try {
            if (propsOnBack) {
                // Component mode - use provided callback
                propsOnBack();
            } else {
                // Route mode - navigate to dashboard
                navigate('/dashboard', { replace: true });
            }
        } catch (error) {
            console.error('Back navigation error:', error);
        }
    };


    // Handle logout
    const handleLogout = async () => {
        try {
            if (onLogout) {
                await onLogout();
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            console.debug('Logout handler completed');
        }
    };


    try {
        // Show loading state
        if (loading) {
            return (
                <DashboardLayout
                    user={user || undefined}
                    onLogout={handleLogout}
                >
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center space-y-4 p-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto" />
                            <p className="text-lg font-medium text-gray-900">
                                Loading results...
                            </p>
                        </div>
                    </div>
                </DashboardLayout>
            );
        }

        // Show error state
        if (error) {
            return (
                <DashboardLayout
                    user={user || undefined}
                    onLogout={handleLogout}
                >
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center space-y-4 p-8">
                            <p className="text-lg font-medium text-red-600">
                                Failed to load results
                            </p>
                            <p className="text-sm text-gray-600">
                                {error}
                            </p>
                            <Button
                                onClick={handleBack}
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
                user={user || undefined}
                onLogout={handleLogout}
            >
                <div className="px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header with back button */}
                    <div className="mb-8">
                        <div className="flex items-center space-x-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleBack}
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
                user={user || undefined}
                onLogout={handleLogout}
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
                            onClick={handleBack}
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
