/**
 * Verification Progress Component
 * 3-step progress indicator for email verification
 */

import { CheckCircle2, Server, FileCheck, Shield, XCircle } from 'lucide-react';


// Progress step type
export type VerificationStep = 'received' | 'processing' | 'antiGreyListing' | 'complete' | 'failed';


// Interface for component props
interface VerificationProgressProps {
    currentStep: VerificationStep;
    errorMessage?: string;
}


/**
 * Verification Progress Component
 * Shows 4-step verification progress with visual indicators
 */
export function VerificationProgress({ currentStep, errorMessage }: VerificationProgressProps) {
    const steps = [
        { id: 'received', icon: Server, label: 'Received' },
        { id: 'processing', icon: FileCheck, label: 'Processing' },
        { id: 'antiGreyListing', icon: Shield, label: 'Anti-Greylisting' },
        { id: 'complete', icon: CheckCircle2, label: 'Complete' }
    ];

    const getStepIndex = (step: VerificationStep) => {
        // 'failed' means we got to antiGreyListing step but failed
        if (step === 'failed') return 2; // Show as if we reached anti-greylisting
        return steps.findIndex(s => s.id === step);
    };

    const currentStepIndex = getStepIndex(currentStep);
    const isFailed = currentStep === 'failed';
    const isComplete = currentStep === 'complete';

    return (
        <div className="w-full max-w-2xl mx-auto py-8">
            <div className="relative px-8">
                {/* Progress line - positioned to connect icons */}
                <div className="absolute top-5 left-10 right-10 h-1 bg-gray-200 rounded-full">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                            isFailed
                                ? 'bg-gradient-to-r from-[#4169E1] to-red-500'
                                : 'bg-gradient-to-r from-[#4169E1] to-green-500'
                        }`}
                        style={{
                            width: `${(currentStepIndex / (steps.length - 1)) * 100}%`
                        }}
                    />
                </div>

                {/* Steps */}
                <div className="relative flex justify-between">
                    {steps.map((step, index) => {
                        const isActive = index === currentStepIndex && !isFailed && !isComplete;
                        const isCompleted = index < currentStepIndex || (index === currentStepIndex && isComplete);
                        const isFinalStep = index === steps.length - 1;
                        const Icon = step.icon;

                        return (
                            <div
                                key={step.id}
                                className="flex flex-col items-center"
                            >
                                {/* Circle indicator */}
                                <div
                                    className={`
                                        w-10 h-10 rounded-full flex items-center justify-center
                                        transition-all duration-300 transform
                                        ${isCompleted && !isFailed
                                            ? 'bg-green-500 scale-100'
                                            : isActive
                                                ? 'bg-[#4169E1] scale-110 shadow-lg'
                                                : isFailed && index === currentStepIndex
                                                    ? 'bg-red-500 scale-110 shadow-lg'
                                                    : isFailed && index < currentStepIndex
                                                        ? 'bg-orange-500 scale-100'
                                                        : 'bg-gray-200 scale-100'
                                        }
                                    `}
                                >
                                    {isFailed && index === currentStepIndex ? (
                                        <XCircle className="h-5 w-5 text-white" />
                                    ) : isCompleted ? (
                                        <CheckCircle2 className="h-5 w-5 text-white" />
                                    ) : (
                                        <Icon
                                            className={`h-5 w-5 transition-all duration-300 ${
                                                isActive ? 'text-white animate-pulse' : 'text-gray-400'
                                            }`}
                                        />
                                    )}
                                </div>

                                {/* Label */}
                                <span
                                    className={`
                                        mt-2 text-xs font-medium transition-colors duration-300
                                        ${isFailed && index === currentStepIndex
                                            ? 'text-red-600'
                                            : isActive
                                                ? 'text-[#2F327D]'
                                                : isCompleted
                                                    ? 'text-green-600'
                                                    : 'text-gray-400'
                                        }
                                    `}
                                >
                                    {isFailed && isFinalStep ? 'Failed' : step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Loading indicator or error message */}
            {isFailed ? (
                <div className="mt-6 text-center">
                    <div className="inline-flex flex-col items-center space-y-2">
                        <div className="flex items-center space-x-2 text-sm text-red-600">
                            <XCircle className="h-5 w-5" />
                            <span className="font-semibold">Verification Failed</span>
                        </div>
                        {errorMessage && (
                            <p className="text-xs text-gray-600 max-w-md">{errorMessage}</p>
                        )}
                    </div>
                </div>
            ) : !isComplete && (
                <div className="mt-6 text-center">
                    <div className="inline-flex items-center space-x-2 text-sm text-gray-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-[#4169E1]" />
                        <span>Verifying...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
