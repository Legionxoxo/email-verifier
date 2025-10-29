/**
 * Verification Progress Page
 * Standalone page showing verification progress with URL-based persistence
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout';
import { VerificationProgress, type VerificationStep } from '../components/ui';
import { Button } from '../components/ui';
import { verificationApi } from '../lib/api';


/**
 * Verification Progress Page Component
 * Displays verification progress and navigates to results when complete
 */
export function VerificationProgressPage() {
    const { verificationRequestId } = useParams<{ verificationRequestId: string }>();
    const navigate = useNavigate();

    const [currentStep, setCurrentStep] = useState<VerificationStep>('received');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [isRetrying, setIsRetrying] = useState<boolean>(false);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);


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
        }
    };


    // Handle back to dashboard
    const handleBackToDashboard = () => {
        try {
            navigate('/dashboard', { replace: true });
        } catch (error) {
            console.error('Navigation error:', error);
        }
    };


    // Poll API for verification status
    useEffect(() => {
        if (!verificationRequestId) {
            console.error('No verification request ID provided');
            navigate('/dashboard', { replace: true });
            return;
        }

        let isMounted = true;

        const pollVerificationStatus = async () => {
            try {
                // Fetch verification status (status only, no results)
                const details = await verificationApi.getVerificationStatus(verificationRequestId);

                if (!isMounted) return;

                // Use progress_step from backend if available, otherwise fallback to status mapping
                if (details.progress_step) {
                    setCurrentStep(details.progress_step as VerificationStep);
                } else {
                    // Fallback to status mapping for backward compatibility
                    switch (details.status) {
                        case 'pending':
                            setCurrentStep('received');
                            break;
                        case 'processing':
                            setCurrentStep('processing');
                            break;
                        case 'completed':
                            setCurrentStep('complete');
                            break;
                        case 'failed':
                            setCurrentStep('failed');
                            break;
                    }
                }

                // Handle completion and navigation
                if (details.status === 'completed') {
                    // Stop polling
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }

                    // Wait 2 seconds to show completion, then navigate
                    setTimeout(() => {
                        if (isMounted) {
                            navigate(`/results/${verificationRequestId}`, { replace: true });
                        }
                    }, 2000);
                }

                // Handle failure
                if (details.status === 'failed') {
                    setCurrentStep('failed');
                    setErrorMessage('Verification failed. Please try again.');

                    // Stop polling
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }
                }

            } catch (error) {
                console.error('Polling error:', error);

                if (!isMounted) return;

                setCurrentStep('failed');
                setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch verification status');

                // Stop polling on error
                if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                }
            }
        };

        // Initial poll
        pollVerificationStatus();

        // Set up polling interval (every 2 seconds)
        pollingIntervalRef.current = setInterval(pollVerificationStatus, 2000);

        // Cleanup on unmount
        return () => {
            isMounted = false;
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [verificationRequestId, navigate]);


    return (
        <DashboardLayout>
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
