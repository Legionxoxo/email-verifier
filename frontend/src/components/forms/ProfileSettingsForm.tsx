/**
 * Profile settings form component
 * Handles user profile information updates (name, display info)
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { User, Save } from 'lucide-react';
import { Button, Input } from '../ui';
import { profileSettingsSchema, type ProfileSettingsFormData } from '../../lib/validations';

interface ProfileSettingsFormProps {
    initialData: {
        firstName: string;
        lastName: string;
    };
    onSubmit: (data: ProfileSettingsFormData) => Promise<void>;
    loading?: boolean;
}

/**
 * Profile settings form component
 * @param initialData - Initial form data from user profile
 * @param onSubmit - Handler for form submission
 * @param loading - Loading state
 * @returns ProfileSettingsForm JSX element
 */
export function ProfileSettingsForm({
    initialData,
    onSubmit,
    loading = false,
}: ProfileSettingsFormProps) {
    try {
        const {
            register,
            handleSubmit,
            formState: { errors, isValid, isDirty },
            watch,
            reset,
        } = useForm<ProfileSettingsFormData>({
            resolver: zodResolver(profileSettingsSchema),
            mode: 'onChange',
            defaultValues: {
                firstName: initialData.firstName,
                lastName: initialData.lastName,
            },
        });

        const firstName = watch('firstName');
        const lastName = watch('lastName');

        const handleFormSubmit = async (data: ProfileSettingsFormData) => {
            try {
                await onSubmit(data);
                // Reset form dirty state after successful submission
                reset(data);
            } catch (error) {
                console.error('Profile settings form submit error:', error);
                throw error;
            }
        };

        const handleReset = () => {
            try {
                reset(initialData);
            } catch (error) {
                console.error('Form reset error:', error);
            }
        };

        // Calculate display name
        const displayName = [firstName?.trim(), lastName?.trim()]
            .filter(Boolean)
            .join(' ') || 'No name provided';

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                <form 
                    onSubmit={handleSubmit(handleFormSubmit)} 
                    className="space-y-6"
                >
                    {/* Name fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            {...register('firstName')}
                            type="text"
                            label="First name"
                            placeholder="Enter your first name"
                            startIcon={<User className="h-4 w-4" />}
                            error={errors.firstName?.message}
                            fullWidth
                            autoComplete="given-name"
                            required
                        />

                        <Input
                            {...register('lastName')}
                            type="text"
                            label="Last name"
                            placeholder="Enter your last name"
                            error={errors.lastName?.message}
                            fullWidth
                            autoComplete="family-name"
                            required
                        />
                    </div>

                    {/* Display name preview */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Display Name Preview</span>
                        </div>
                        <p className="text-gray-900 font-medium">{displayName}</p>
                        <p className="text-xs text-gray-500 mt-1">
                            This is how your name will appear throughout the application
                        </p>
                    </div>

                    {/* Form actions */}
                    <div className="pt-4 border-t border-gray-200">
                        {/* Mobile layout - stacked */}
                        <div className="flex flex-col space-y-4 sm:hidden">
                            <div className="text-sm text-gray-600">
                                {isDirty ? (
                                    <span className="text-orange-600 flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-orange-500 rounded-full" />
                                        <span>You have unsaved changes</span>
                                    </span>
                                ) : (
                                    <span className="text-green-600 flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                                        <span>Profile is up to date</span>
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center space-x-3">
                                {isDirty && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={handleReset}
                                        disabled={loading}
                                        className="flex-1 cursor-pointer"
                                    >
                                        Reset Changes
                                    </Button>
                                )}

                                <Button
                                    type="submit"
                                    variant="primary"
                                    loading={loading}
                                    disabled={!isValid || !isDirty}
                                    className={`${isDirty ? 'flex-1' : 'w-full'} flex items-center justify-center space-x-2 cursor-pointer`}
                                >
                                    <Save className="h-4 w-4" />
                                    <span>Save Changes</span>
                                </Button>
                            </div>
                        </div>

                        {/* Desktop layout - same line */}
                        <div className="hidden sm:flex sm:items-center sm:justify-between">
                            <div className="text-sm text-gray-600">
                                {isDirty ? (
                                    <span className="text-orange-600 flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-orange-500 rounded-full" />
                                        <span>You have unsaved changes</span>
                                    </span>
                                ) : (
                                    <span className="text-green-600 flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                                        <span>Profile is up to date</span>
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center space-x-3 ml-4">
                                {isDirty && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={handleReset}
                                        disabled={loading}
                                        className="cursor-pointer"
                                    >
                                        Reset Changes
                                    </Button>
                                )}

                                <Button
                                    type="submit"
                                    variant="primary"
                                    loading={loading}
                                    disabled={!isValid || !isDirty}
                                    className="flex items-center justify-center space-x-2 cursor-pointer"
                                >
                                    <Save className="h-4 w-4" />
                                    <span>Save Changes</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Profile completion indicator */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                            <div className={`w-3 h-3 rounded-full ${
                                firstName?.trim() && lastName?.trim() 
                                    ? 'bg-green-500' 
                                    : 'bg-orange-500'
                            }`} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-medium text-blue-900">
                                Profile Completion
                            </h4>
                            <p className="text-sm text-blue-700 mt-1">
                                {firstName?.trim() && lastName?.trim() 
                                    ? 'Your profile is complete with both first and last name.'
                                    : 'Complete your profile by adding both your first and last name.'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    } catch (error) {
        console.error('ProfileSettingsForm render error:', error);
        
        return (
            <div className="space-y-4">
                <p className="text-sm text-red-600">
                    Something went wrong with the profile form. Please refresh the page and try again.
                </p>
                <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    className="cursor-pointer"
                >
                    Refresh page
                </Button>
            </div>
        );
    }
}