/**
 * Verification Progress Page
 * Standalone page showing verification progress with URL-based persistence
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { DashboardLayout } from '../components/layout';
import { VerificationProgress, type VerificationStep } from '../components/ui';
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


    // Simulate verification progress
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

                // Step 3: Anti-Greylisting - Generate mock results here
                setCurrentStep('antiGreyListing');

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
            navigate('/dashboard', { replace: true });
        }
    }, [jobId, navigate, location.state]);


    return (
        <DashboardLayout
            user={user || undefined}
            onLogout={handleLogout}
        >
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4">
                <VerificationProgress currentStep={currentStep} />
            </div>
        </DashboardLayout>
    );
}
