/**
 * Form validation schemas using Zod
 * Provides type-safe validation with user-friendly error messages
 */

import * as z from 'zod';

// Custom error messages for better UX
const errorMessages = {
    required: 'This field is required',
    invalidEmail: 'Please enter a valid email address',
    passwordTooShort: 'Password must be at least 8 characters long',
    passwordTooWeak: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    otpInvalid: 'Please enter a valid 6-digit code',
    passwordMismatch: 'Passwords do not match',
    nameTooShort: 'Name must be at least 2 characters long',
    nameInvalid: 'Name can only contain letters, spaces, hyphens, and apostrophes',
};

/**
 * Email validation schema
 */
export const emailSchema = z
    .string()
    .min(1, errorMessages.required)
    .email(errorMessages.invalidEmail)
    .toLowerCase()
    .trim();

/**
 * Password validation schema with strength requirements
 */
export const passwordSchema = z
    .string()
    .min(1, errorMessages.required)
    .min(8, errorMessages.passwordTooShort)
    .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        errorMessages.passwordTooWeak
    );

/**
 * Name validation schema
 */
export const nameSchema = z
    .string()
    .min(1, errorMessages.required)
    .min(2, errorMessages.nameTooShort)
    .max(50, 'Name must be less than 50 characters')
    .regex(
        /^[a-zA-Z\s\-']+$/,
        errorMessages.nameInvalid
    )
    .trim();

/**
 * OTP validation schema
 */
export const otpSchema = z
    .string()
    .min(1, errorMessages.required)
    .length(6, errorMessages.otpInvalid)
    .regex(/^\d{6}$/, errorMessages.otpInvalid);

/**
 * Login form validation schema
 */
export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, errorMessages.required),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Registration form validation schema
 */
export const registerSchema = z
    .object({
        name: nameSchema,
        email: emailSchema,
        password: passwordSchema,
        confirmPassword: z.string().min(1, errorMessages.required),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: errorMessages.passwordMismatch,
        path: ['confirmPassword'],
    });

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * OTP verification form validation schema
 */
export const otpVerificationSchema = z.object({
    email: emailSchema,
    otp: otpSchema,
});

export type OTPVerificationFormData = z.infer<typeof otpVerificationSchema>;

/**
 * Password reset request form validation schema
 */
export const passwordResetRequestSchema = z.object({
    email: emailSchema,
});

export type PasswordResetRequestFormData = z.infer<typeof passwordResetRequestSchema>;

/**
 * Password reset form validation schema
 */
export const passwordResetSchema = z
    .object({
        password: passwordSchema,
        confirmPassword: z.string().min(1, errorMessages.required),
        token: z.string().min(1, 'Reset token is required'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: errorMessages.passwordMismatch,
        path: ['confirmPassword'],
    });

export type PasswordResetFormData = z.infer<typeof passwordResetSchema>;

/**
 * Login method selection schema
 */
export const loginMethodSchema = z.object({
    email: emailSchema,
    method: z.enum(['password', 'otp'], {
        required_error: 'Please select a login method',
    }),
});

export type LoginMethodFormData = z.infer<typeof loginMethodSchema>;

/**
 * Profile settings form validation schema
 */
export const profileSettingsSchema = z.object({
    firstName: nameSchema,
    lastName: nameSchema,
});

export type ProfileSettingsFormData = z.infer<typeof profileSettingsSchema>;

/**
 * Change email form validation schema - step 1 (password confirmation)
 */
export const changeEmailStepOneSchema = z.object({
    newEmail: emailSchema,
    currentPassword: z.string().min(1, errorMessages.required),
});

export type ChangeEmailStepOneFormData = z.infer<typeof changeEmailStepOneSchema>;

/**
 * Change email form validation schema - step 2 (OTP verification)
 */
export const changeEmailStepTwoSchema = z.object({
    otp: otpSchema,
    newEmail: emailSchema.optional(),
});

export type ChangeEmailStepTwoFormData = z.infer<typeof changeEmailStepTwoSchema>;

/**
 * Forgot password form validation schema
 */
export const forgotPasswordSchema = z.object({
    email: emailSchema,
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Reset password with OTP form validation schema
 */
export const resetPasswordWithOtpSchema = z
    .object({
        otp: otpSchema,
        newPassword: passwordSchema,
        confirmPassword: z.string().min(1, errorMessages.required),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: errorMessages.passwordMismatch,
        path: ['confirmPassword'],
    });

export type ResetPasswordWithOtpFormData = z.infer<typeof resetPasswordWithOtpSchema>;


// API Key Management Validation Schemas

/**
 * Create API key form validation schema
 */
export const createApiKeySchema = z.object({
    name: z
        .string()
        .min(1, 'API key name is required')
        .max(100, 'Name must be less than 100 characters')
        .trim(),
    expiryDays: z
        .number()
        .int('Expiry days must be a whole number')
        .min(1, 'Expiry must be at least 1 day')
        .max(365, 'Expiry cannot exceed 365 days')
        .optional()
        .nullable(),
});

export type CreateApiKeyFormData = z.infer<typeof createApiKeySchema>;


/**
 * Utility function to extract user-friendly error message from Zod error
 * @param error - Zod validation error
 * @returns User-friendly error message
 */
export function getZodErrorMessage(error: z.ZodError): string {
    try {
        const firstError = error.errors[0];
        return firstError?.message || 'Validation error occurred';
    } catch (e) {
        console.error('Error extracting Zod error message:', e);
        return 'Validation error occurred';
    }
}

/**
 * Utility function to get field-specific errors from Zod error
 * @param error - Zod validation error
 * @returns Object with field names as keys and error messages as values
 */
export function getZodFieldErrors(error: z.ZodError): Record<string, string> {
    try {
        const fieldErrors: Record<string, string> = {};
        
        error.errors.forEach((err) => {
            const fieldPath = err.path.join('.');
            if (fieldPath) {
                fieldErrors[fieldPath] = err.message;
            }
        });
        
        return fieldErrors;
    } catch (e) {
        console.error('Error extracting Zod field errors:', e);
        return {};
    }
}