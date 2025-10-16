/**
 * Signup email verification form component with enhanced UX
 * Handles OTP input and verification during the signup process
 * 
 * This component provides:
 * - Clear verification instructions and email display
 * - OTP input form with validation
 * - Resend functionality with cooldown timer
 * - Navigation back to signup form
 * - Progress indicators and user guidance
 */

import { type JSX } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from '../ui';
import { OTPForm } from './OTPForm';
import { type OTPVerificationFormData } from '../../lib/validations';


// Component props interface

/**
 * Props interface for SignupVerificationForm component
 * Defines all required and optional properties
 */
interface SignupVerificationFormProps {
    /** User email address to verify */
    email: string;
    /** Handler for OTP verification submission */
    onVerifyOTP: (data: OTPVerificationFormData) => Promise<void>;
    /** Handler for OTP resend request */
    onResendOTP: () => Promise<void>;
    /** Handler for navigation back to signup form */
    onBack: () => void;
    /** Loading state indicator */
    loading?: boolean;
    /** Whether resend button is disabled */
    resendDisabled?: boolean;
    /** Time remaining for resend cooldown */
    timeLeft?: number;
}

/**
 * Signup verification form component with comprehensive user guidance
 * Provides clear instructions and handles OTP verification flow
 * 
 * @param {SignupVerificationFormProps} props - Component props
 * @returns {JSX.Element} SignupVerificationForm component
 */
export function SignupVerificationForm({
    email,
    onVerifyOTP,
    onResendOTP,
    onBack,
    loading = false,
    resendDisabled = false,
    timeLeft = 0,
}: SignupVerificationFormProps): JSX.Element {
    try {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                {/* Verification Header */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                        <Mail className="w-8 h-8 text-primary-600" aria-hidden="true" />
                    </div>
                    
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Verify your email address
                        </h2>
                        <p className="text-gray-600 leading-relaxed">
                            We've sent a verification code to complete your account setup
                        </p>
                    </div>
                    
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-700">
                            <span className="text-gray-500">Verification sent to:</span>
                            <br />
                            <strong className="font-medium text-gray-900">{email}</strong>
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            Don't see the email? Check your spam folder or promotions tab
                        </p>
                    </div>
                </div>

                {/* OTP Form */}
                <OTPForm
                    email={email}
                    onVerifyOTP={onVerifyOTP}
                    onResendOTP={onResendOTP}
                    onBack={onBack}
                    loading={loading}
                    resendDisabled={resendDisabled}
                    timeLeft={timeLeft}
                />

                {/* User Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-3">
                        What happens next?
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-2" role="list">
                        <li className="flex items-start">
                            <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0" aria-hidden="true"></span>
                            <span>Enter the 6-digit verification code from your email</span>
                        </li>
                        <li className="flex items-start">
                            <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0" aria-hidden="true"></span>
                            <span>Your account will be verified and activated automatically</span>
                        </li>
                        <li className="flex items-start">
                            <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0" aria-hidden="true"></span>
                            <span>You'll be logged in and ready to start using the platform</span>
                        </li>
                    </ul>
                </div>

                {/* Navigation Options */}
                <div className="text-center pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onBack}
                        disabled={loading}
                        className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-md px-2 py-1"
                        aria-label="Go back to signup form"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                        Back to signup form
                    </button>
                </div>
            </motion.div>
        );
    } catch (error) {
        console.error('SignupVerificationForm render error:', error);
        
        return (
            <div className="space-y-6 p-6 text-center">
                <div className="text-red-600">
                    <p className="text-lg font-medium mb-2">
                        Verification form error
                    </p>
                    <p className="text-sm text-gray-600">
                        Something went wrong with the verification form. Please refresh the page and try again.
                    </p>
                </div>
                <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    fullWidth
                    className="cursor-pointer"
                >
                    Refresh Page
                </Button>
            </div>
        );
    }
}