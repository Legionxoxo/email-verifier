/**
 * User profile management for settings
 * Handles profile retrieval and updates with comprehensive validation
 * 
 * This module provides secure profile management functionality including:
 * - Profile information retrieval
 * - Profile updates with validation and sanitization
 * - User data consistency and security
 * - Comprehensive error handling and logging
 */

const { getDatabase } = require('../../../database/connection');


/**
 * Handle get user profile
 * Retrieves current user's profile information
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with user profile data
 */
async function handleGetProfile(req, res) {
    try {
        const userId = req.user?.userId;
        
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }
        
        const db = getDatabase();
        
        // Get user profile data
        const user = /** @type {{id: number, first_name: string, last_name: string, email: string, is_verified: number, razorpay_customer_id: string, created_at: string, updated_at: string} | undefined} */ (db.prepare(`
            SELECT id, first_name, last_name, email, is_verified, 
                   razorpay_customer_id, created_at, updated_at
            FROM users 
            WHERE id = ?
        `).get(userId));
        
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
            return;
        }
        
        // Prepare profile response (exclude sensitive data)
        const profileData = {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name || '',
            email: user.email,
            isVerified: Boolean(user.is_verified),
            hasRazorpayCustomer: Boolean(user.razorpay_customer_id),
            createdAt: user.created_at,
            updatedAt: user.updated_at,
            profileCompleteness: calculateProfileCompleteness(user)
        };
        
        console.log('Profile retrieved successfully:', {
            userId: userId,
            email: user.email,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            message: 'Profile retrieved successfully',
            data: {
                user: profileData
            }
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Profile retrieval failed:', {
            error: errorMessage,
            userId: req.user?.userId,
            timestamp: new Date().toISOString()
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve profile. Please try again.'
        });
        return;
        
    } finally {
        console.debug('Profile retrieval process completed');
    }
}


/**
 * Handle update user profile
 * Updates user's profile information with validation
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Sends JSON response with updated profile data
 */
async function handleUpdateProfile(req, res) {
    try {
        const userId = req.user?.userId;
        const { firstName, lastName } = req.body;
        
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }
        
        // At least one field must be provided for update
        if (firstName === undefined && lastName === undefined) {
            res.status(400).json({
                success: false,
                message: 'At least one field must be provided for update'
            });
            return;
        }
        
        const db = getDatabase();
        
        // Get current user data
        const currentUser = /** @type {{id: number, first_name: string, last_name: string, email: string} | undefined} */ (db.prepare(`
            SELECT id, first_name, last_name, email
            FROM users 
            WHERE id = ?
        `).get(userId));
        
        if (!currentUser) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        
        // Prepare update data - only update provided fields
        const updateFields = [];
        const updateValues = [];
        
        if (firstName !== undefined) {
            // Additional validation for firstName
            if (typeof firstName !== 'string' || firstName.trim().length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'First name cannot be empty'
                });
                return;
            }
            
            if (firstName.trim().length > 50) {
                res.status(400).json({
                    success: false,
                    message: 'First name must be 50 characters or less'
                });
                return;
            }
            
            updateFields.push('first_name = ?');
            updateValues.push(firstName.trim());
        }
        
        if (lastName !== undefined) {
            // lastName can be empty/null but if provided, must be valid
            if (lastName !== null && typeof lastName === 'string') {
                if (lastName.trim().length > 50) {
                    res.status(400).json({
                        success: false,
                        message: 'Last name must be 50 characters or less'
                    });
                    return;
                }
                updateFields.push('last_name = ?');
                updateValues.push(lastName.trim() || null);
            } else if (lastName === null || lastName === '') {
                updateFields.push('last_name = ?');
                updateValues.push(null);
            }
        }
        
        // Add updated_at timestamp
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(userId); // for WHERE clause
        
        // Build and execute update query
        const updateQuery = `
            UPDATE users 
            SET ${updateFields.join(', ')} 
            WHERE id = ?
        `;
        
        const updateResult = db.prepare(updateQuery).run(...updateValues);
        
        if (updateResult.changes === 0) {
            res.status(400).json({
                success: false,
                message: 'No changes were made to the profile'
            });
            return;
        }
        
        // Get updated user data
        const updatedUser = /** @type {{id: number, first_name: string, last_name: string, email: string, is_verified: number, created_at: string, updated_at: string} | undefined} */ (db.prepare(`
            SELECT id, first_name, last_name, email, is_verified, created_at, updated_at
            FROM users 
            WHERE id = ?
        `).get(userId));
        
        if (!updatedUser) {
            throw new Error('Failed to retrieve updated user data');
        }
        
        // Prepare updated profile response
        const profileData = {
            id: updatedUser.id,
            firstName: updatedUser.first_name,
            lastName: updatedUser.last_name || '',
            email: updatedUser.email,
            isVerified: Boolean(updatedUser.is_verified),
            createdAt: updatedUser.created_at,
            updatedAt: updatedUser.updated_at,
            profileCompleteness: calculateProfileCompleteness(updatedUser)
        };
        
        console.log('Profile updated successfully:', {
            userId: userId,
            email: updatedUser.email,
            changes: updateFields.filter(field => !field.includes('updated_at')),
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                message: 'Profile updated successfully',
                user: profileData
            }
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Profile update failed:', {
            error: errorMessage,
            userId: req.user?.userId,
            updateData: {
                firstName: req.body?.firstName,
                lastName: req.body?.lastName
            },
            timestamp: new Date().toISOString()
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to update profile. Please try again.'
        });
        return;
        
    } finally {
        console.debug('Profile update process completed');
    }
}


/**
 * Calculate profile completeness percentage
 * Helps users understand how complete their profile is
 * 
 * @param {Object} user - User data object
 * @param {string} user.first_name - User's first name
 * @param {string} user.last_name - User's last name
 * @param {string} user.email - User's email
 * @param {number} user.is_verified - User's verification status
 * @param {string} [user.razorpay_customer_id] - User's Razorpay customer ID
 * @returns {Object} Profile completeness data
 */
function calculateProfileCompleteness(user) {
    try {
        const completenessFactors = [
            { field: 'email', value: user.email, weight: 30, required: true },
            { field: 'firstName', value: user.first_name, weight: 25, required: true },
            { field: 'lastName', value: user.last_name, weight: 20, required: false },
            { field: 'emailVerified', value: user.is_verified, weight: 25, required: true }
        ];
        
        let totalScore = 0;
        let maxPossibleScore = 0;
        const missingFields = [];
        
        completenessFactors.forEach(factor => {
            maxPossibleScore += factor.weight;
            
            if (factor.field === 'emailVerified') {
                if (factor.value) {
                    totalScore += factor.weight;
                } else {
                    missingFields.push('Email verification');
                }
            } else if (factor.value && factor.value.toString().trim().length > 0) {
                totalScore += factor.weight;
            } else if (factor.required) {
                missingFields.push(factor.field === 'firstName' ? 'First name' : factor.field === 'lastName' ? 'Last name' : 'Email');
            }
        });
        
        const completenessPercentage = Math.round((totalScore / maxPossibleScore) * 100);
        
        return {
            percentage: completenessPercentage,
            isComplete: completenessPercentage === 100,
            missingFields: missingFields,
            suggestions: generateCompletionSuggestions(missingFields, completenessPercentage)
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Profile completeness calculation failed:', errorMessage);
        
        return {
            percentage: 0,
            isComplete: false,
            missingFields: ['Unable to calculate'],
            suggestions: []
        };
    } finally {
        console.debug('Profile completeness calculation completed');
    }
}


/**
 * Generate profile completion suggestions
 * Provides actionable suggestions to improve profile completeness
 * 
 * @param {Array<string>} missingFields - Array of missing field names
 * @param {number} completenessPercentage - Current completeness percentage
 * @returns {Array<string>} Array of suggestions
 */
function generateCompletionSuggestions(missingFields, completenessPercentage) {
    try {
        const suggestions = [];
        
        if (completenessPercentage === 100) {
            suggestions.push('Your profile is complete! 🎉');
            return suggestions;
        }
        
        if (missingFields.includes('Email verification')) {
            suggestions.push('Verify your email address to secure your account');
        }
        
        if (missingFields.includes('First name')) {
            suggestions.push('Add your first name to personalize your experience');
        }
        
        if (missingFields.includes('Last name')) {
            suggestions.push('Add your last name to complete your profile');
        }
        
        if (completenessPercentage < 75) {
            suggestions.push('Complete your profile to unlock all features');
        }
        
        return suggestions;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Suggestion generation failed:', errorMessage);
        return ['Complete your profile for better experience'];
    } finally {
        console.debug('Suggestion generation completed');
    }
}


// Export route handlers
module.exports = {
    handleGetProfile,
    handleUpdateProfile,
    calculateProfileCompleteness,
    generateCompletionSuggestions
};