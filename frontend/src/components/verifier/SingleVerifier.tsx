/**
 * Single Email Verifier Component
 * Allows users to verify individual email addresses
 */

import { useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'react-toastify';


// Interface for component props
interface SingleVerifierProps {
    onVerify?: (email: string) => Promise<void>;
}


/**
 * Single Email Verifier Component
 * @param props - Component props
 * @returns JSX element
 */
export function SingleVerifier({ onVerify }: SingleVerifierProps) {
    const [email, setEmail] = useState<string>('');
    const [isVerifying, setIsVerifying] = useState<boolean>(false);


    /**
     * Handle email verification
     */
    const handleVerify = async () => {
        try {
            console.log('=== SINGLE EMAIL VERIFICATION STARTED ===');
            console.log('Email to verify:', email);

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

            setIsVerifying(true);

            // Call verify function
            if (onVerify) {
                console.log('Calling onVerify callback with email:', email.toLowerCase().trim());
                await onVerify(email.toLowerCase().trim());
            } else {
                // TODO: Implement actual verification API call
                console.log('No onVerify callback, using mock verification');
                console.log('Verifying email:', email);
                await new Promise(resolve => setTimeout(resolve, 2000));
                toast.success('Email verified successfully!');
                console.log('Mock verification completed');
            }

            console.log('=== SINGLE EMAIL VERIFICATION COMPLETED ===');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Verification failed';
            console.error('Verification error:', error);
            toast.error(errorMessage);
        } finally {
            setIsVerifying(false);
            console.debug('Verification process completed');
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
                        console.log('Single Email Input:', newEmail);
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
                <button
                    onClick={handleVerify}
                    disabled={isVerifying || !email.trim()}
                    className="px-8 py-3 bg-[#4169E1] hover:bg-[#3558C7] text-white font-medium text-base
                             rounded-xl transition-all duration-200 flex items-center justify-center gap-2
                             disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300
                             shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer
                             min-w-[140px]"
                    aria-label="Verify email button"
                >
                    {isVerifying ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Verifying...</span>
                        </>
                    ) : (
                        <>
                            <span>Verify</span>
                            <Search className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
