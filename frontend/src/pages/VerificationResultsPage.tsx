/**
 * Verification Results Page
 * Displays verification results with analysis and detailed email list
 * Features infinite scroll pagination with Intersection Observer
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout';
import { Button } from '../components/ui/Button';
import { ResultAnalysis } from '../components/results/ResultAnalysis';
import { ResultsList } from '../components/results/ResultsList';
import { useAuth } from '../hooks';
import { verificationApi } from '../lib/api';
import type { User } from '../contexts/AuthContext';


// ============================================================
// INFINITE SCROLL CONFIGURATION - Modify these values as needed
// ============================================================
const SCROLL_CONFIG = {
    INITIAL_PAGE: 1,              // First page to load
    THRESHOLD: 0.8,               // Trigger at 80% scroll (20% from bottom)
    ROOT_MARGIN: '200px',         // Start loading 200px before reaching threshold
};
// ============================================================


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
    const [page, setPage] = useState<number>(SCROLL_CONFIG.INITIAL_PAGE);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [isFetchingMore, setIsFetchingMore] = useState<boolean>(false);
    const [csvUploadId, setCsvUploadId] = useState<string | undefined>(undefined);
    const [listName, setListName] = useState<string | null | undefined>(undefined);
    const [originalFilename, setOriginalFilename] = useState<string | undefined>(undefined);
    const [statistics, setStatistics] = useState<{
        valid: number;
        invalid: number;
        catch_all: number;
        unknown: number;
    } | null>(null);

    // Ref for intersection observer (using callback ref for better timing)
    const observerTarget = useRef<HTMLDivElement>(null);
    const [observerElement, setObserverElement] = useState<HTMLDivElement | null>(null);

    // Use props if provided (component mode), otherwise use hooks (route mode)
    const user = propsUser || authUser;
    const onLogout = propsOnLogout || authLogout;


    // Fetch initial results from API if not provided via props
    useEffect(() => {
        if (propsResults || !verificationRequestId) return;

        const fetchResults = async () => {
            try {
                setLoading(true);
                setError('');

                console.log('Fetching verification results for:', verificationRequestId);

                const details = await verificationApi.getVerificationResults(verificationRequestId, page);
                console.log('Verification results:', details);

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

                // Check if there are more pages
                if (details.pagination) {
                    setHasMore(details.pagination.has_more);
                }

                // Store statistics from API response
                if (details.statistics) {
                    setStatistics(details.statistics);
                }

                // Store CSV details if this is a CSV verification
                if (details.request_type === 'csv' && details.csv_details) {
                    setCsvUploadId(details.csv_details.csv_upload_id);
                    setListName(details.csv_details.list_name);
                    setOriginalFilename(details.csv_details.original_filename);
                }

            } catch (error) {
                console.error('Failed to fetch results:', error);
                setError(error instanceof Error ? error.message : 'Failed to load results');
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [verificationRequestId, propsResults]);


    // Fetch more results when user scrolls (memoized to prevent unnecessary recreations)
    const fetchMoreResults = useCallback(async () => {
        if (isFetchingMore || !hasMore || !verificationRequestId) return;

        try {
            setIsFetchingMore(true);
            const nextPage = page + 1;

            const details = await verificationApi.getVerificationResults(verificationRequestId, nextPage);

            if (details.results && details.results.length > 0) {
                const mappedResults: EmailVerificationResult[] = details.results.map(r => ({
                    email: r.email,
                    status: r.status,
                    reason: r.message
                }));

                setResults(prev => [...prev, ...mappedResults]);
                setPage(nextPage);

                if (details.pagination) {
                    setHasMore(details.pagination.has_more);
                }
            } else {
                setHasMore(false);
            }

        } catch (error) {
            console.error('Failed to fetch more results:', error);
        } finally {
            setIsFetchingMore(false);
        }
    }, [isFetchingMore, hasMore, verificationRequestId, page]);


    // Intersection Observer for infinite scroll (more performant than scroll events)
    useEffect(() => {
        // Wait until element is available and we have more results to load
        if (!observerElement || !hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                // When the target element becomes visible, fetch more results
                if (entries[0].isIntersecting && !isFetchingMore) {
                    fetchMoreResults();
                }
            },
            {
                root: null, // viewport
                rootMargin: SCROLL_CONFIG.ROOT_MARGIN,
                threshold: 0.1, // Trigger when 10% of element is visible
            }
        );

        observer.observe(observerElement);

        return () => observer.disconnect();
    }, [observerElement, fetchMoreResults, hasMore, isFetchingMore]);


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

        // Use statistics from API if available, otherwise calculate from loaded results
        const stats = statistics
            ? {
                total: statistics.valid + statistics.invalid + statistics.catch_all + statistics.unknown,
                valid: statistics.valid,
                invalid: statistics.invalid,
                catchAll: statistics.catch_all,
                unknown: statistics.unknown
            }
            : {
                total: results.length,
                valid: results.filter(r => r.status === 'valid').length,
                invalid: results.filter(r => r.status === 'invalid').length,
                catchAll: results.filter(r => r.status === 'catch-all').length,
                unknown: results.filter(r => r.status === 'unknown').length
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
                            <ResultsList
                                results={results}
                                totalCount={stats.total}
                                csvUploadId={csvUploadId}
                                listName={listName}
                                originalFilename={originalFilename}
                            />

                            {/* Infinite scroll trigger element */}
                            {hasMore && (
                                <div
                                    ref={(el) => {
                                        observerTarget.current = el;
                                        setObserverElement(el);
                                    }}
                                    className="py-4"
                                >
                                    {isFetchingMore && (
                                        <div className="flex justify-center items-center space-x-2">
                                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
                                            <span className="text-sm text-gray-600">Loading more results...</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* End of results message */}
                            {!hasMore && results.length > 0 && (
                                <div className="py-4 text-center">
                                    <p className="text-sm text-gray-500">
                                        You've reached the end of the results
                                    </p>
                                </div>
                            )}
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
