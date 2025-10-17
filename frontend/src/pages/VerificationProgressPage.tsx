/**
 * Verification Progress Page
 * Standalone page showing verification progress with URL-based persistence
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { DashboardLayout } from '../components/layout';
import { VerificationProgress, type VerificationStep } from '../components/ui';
import { Button } from '../components/ui';
import { useAuth } from '../hooks';
import type { EmailVerificationResult } from './VerificationResultsPage';


// Interface for location state
interface VerificationProgressState {
    type: 'single' | 'bulk';
    emails: string[];
}


/**
 * Verification Progress Page Component
 * Displays verification progress and navigates to results when complete
 */
export function VerificationProgressPage() {
    const { jobId } = useParams<{ jobId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const [currentStep, setCurrentStep] = useState<VerificationStep>('received');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [isRetrying, setIsRetrying] = useState<boolean>(false);


    // Handle logout
    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            console.debug('Logout handler completed');
        }
    };


    // Handle retry
    const handleRetry = () => {
        try {
            setIsRetrying(true);
            setErrorMessage('');
            setCurrentStep('received');
            // Reload the page to restart verification
            window.location.reload();
        } catch (error) {
            console.error('Retry error:', error);
        } finally {
            console.debug('Retry handler completed');
        }
    };


    // Handle back to dashboard
    const handleBackToDashboard = () => {
        try {
            navigate('/dashboard', { replace: true });
        } catch (error) {
            console.error('Navigation error:', error);
        } finally {
            console.debug('Back to dashboard handler completed');
        }
    };


    // Simulate verification progress (TODO: Replace with actual API polling)
    useEffect(() => {
        try {
            const runVerification = async () => {
                // Get emails from location state
                const state = location.state as VerificationProgressState | undefined;

                if (!state || !state.emails || state.emails.length === 0) {
                    console.error('No emails provided for verification');
                    navigate('/dashboard', { replace: true });
                    return;
                }

                const { type, emails } = state;

                // Step 1: Received
                setCurrentStep('received');
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Step 2: Processing
                setCurrentStep('processing');
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Step 3: Anti-Greylisting
                setCurrentStep('antiGreyListing');

                // Simulate random success/failure for testing
                const shouldFail = Math.random() < 0.2; // 20% chance of failure for testing

                if (shouldFail) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    setCurrentStep('failed');
                    setErrorMessage('Verification failed: Worker timeout. Please try again.');
                    return;
                }

                // Generate mock results during verification
                const statuses: Array<'valid' | 'invalid' | 'catch-all' | 'unknown'> = ['valid', 'invalid', 'catch-all', 'unknown'];
                const reasons: Record<string, string> = {
                    valid: 'This is a valid email address!',
                    invalid: "This email doesn't have an associated SMTP server.",
                    'catch-all': 'This domain accepts all emails (catch-all).',
                    unknown: 'Unable to verify this email address.'
                };

                const mockResults: EmailVerificationResult[] = emails.map(email => {
                    const status = statuses[Math.floor(Math.random() * statuses.length)];
                    return {
                        email: email,
                        status: status,
                        reason: reasons[status]
                    };
                });

                await new Promise(resolve => setTimeout(resolve, 1500));

                // Step 4: Complete - show green for 2 seconds
                setCurrentStep('complete');
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Navigate to results page with generated results
                navigate(`/results/${jobId}`, {
                    state: {
                        results: mockResults,
                        type: type
                    },
                    replace: true
                });
            };

            runVerification();
        } catch (error) {
            console.error('Verification progress error:', error);
            setCurrentStep('failed');
            setErrorMessage('An unexpected error occurred. Please try again.');
        }
    }, [jobId, navigate, location.state]);


    return (
        <DashboardLayout
            user={user || undefined}
            onLogout={handleLogout}
        >
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4 space-y-6">
                <VerificationProgress
                    currentStep={currentStep}
                    errorMessage={errorMessage}
                />

                {/* Action buttons for failed state */}
                {currentStep === 'failed' && (
                    <div className="flex space-x-4">
                        <Button
                            variant="outline"
                            onClick={handleBackToDashboard}
                            className="cursor-pointer"
                        >
                            Back to Dashboard
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleRetry}
                            disabled={isRetrying}
                            className="cursor-pointer"
                        >
                            {isRetrying ? 'Retrying...' : 'Retry'}
                        </Button>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
