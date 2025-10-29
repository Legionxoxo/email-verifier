/**
 * Single Email Verifier Component
 * Allows users to verify individual email addresses
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { verificationApi } from '../../lib/api';
import { Button } from '../ui/Button';


// Interface for component props
interface SingleVerifierProps {
    onVerifyingChange?: (isVerifying: boolean) => void;
}


/**
 * Single Email Verifier Component
 * @param props - Component props
 * @returns JSX element
 */
export function SingleVerifier({ onVerifyingChange }: SingleVerifierProps) {
    const navigate = useNavigate();
    const [email, setEmail] = useState<string>('');
    const [isVerifying, setIsVerifying] = useState<boolean>(false);


    /**
     * Handle email verification
     */
    const handleVerify = async () => {
        try {
            // Validate email
            if (!email.trim()) {
                toast.error('Please enter an email address');
                return;
            }

            // Basic email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                toast.error('Please enter a valid email address');
                return;
            }

            // Disable button immediately to prevent multiple clicks
            setIsVerifying(true);
            if (onVerifyingChange) onVerifyingChange(true);

            // Call API to submit single email verification
            const response = await verificationApi.verifySingleEmail(email.toLowerCase().trim());

            toast.success('Verification started!');

            // Navigate to verification progress page with the verification_request_id
            navigate(`/verify/${response.verification_request_id}`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Verification failed';
            console.error('Verification error:', error);
            toast.error(errorMessage);
            // Reset state on error
            setIsVerifying(false);
            if (onVerifyingChange) onVerifyingChange(false);
        }
    };




    return (
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Heading */}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-center text-[#2F327D] mb-6 leading-tight">
                Enter any email you wish to verify
            </h1>

            {/* Input and Button Container */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-center max-w-2xl mx-auto">
                {/* Email Input */}
                <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                        const newEmail = e.target.value;
                        setEmail(newEmail);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isVerifying) {
                            handleVerify();
                        }
                    }}
                    placeholder="username@domain.com"
                    disabled={isVerifying}
                    className={`flex-1 px-5 py-3 text-base border border-[#93C5FD] rounded-xl outline-none
                                focus:border-[#4169E1]
                                disabled:bg-gray-100 disabled:cursor-not-allowed
                                placeholder:text-gray-400 transition-all duration-200 bg-white`}
                    style={{ boxShadow: 'none' }}
                    aria-label="Email address to verify"
                />

                {/* Verify Button */}
                <Button
                    onClick={handleVerify}
                    disabled={isVerifying || !email.trim()}
                    loading={isVerifying}
                    className="px-8 py-6 bg-[#4169E1] hover:bg-[#3558C7] text-white font-medium text-base
                                rounded-xl shadow-sm hover:shadow-md min-w-[140px] border-[#4169E1]"
                    aria-label="Verify email button"
                >
                    <span>Verify</span>
                    <Search className="w-5 h-5 ml-2" />
                </Button>
            </div>
        </div>
    );
}
