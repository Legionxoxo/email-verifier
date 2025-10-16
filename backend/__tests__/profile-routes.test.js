/**
 * Profile Route Functions Tests
 * Unit tests for user profile functionality
 */

const { handleGetProfile } = require('../functions/route_fns/auth/profile');

describe('Profile Route Functions Unit Tests', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        // Mock request and response objects
        mockReq = {
            user: {
                userId: 1,
                email: 'test@example.com',
                firstName: 'Test',
                lastName: 'User',
                isVerified: true,
                createdAt: '2024-01-01T00:00:00.000Z'
            }
        };

        mockRes = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis()
        };
    });

    describe('handleGetProfile', () => {
        test('should return user profile successfully', async () => {
            await handleGetProfile(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Profile retrieved successfully',
                data: {
                    user: {
                        id: 1,
                        email: 'test@example.com',
                        firstName: 'Test',
                        lastName: 'User',
                        isVerified: true,
                        createdAt: '2024-01-01T00:00:00.000Z'
                    }
                }
            });
        });

        test('should handle missing user data', async () => {
            mockReq.user = null;

            await handleGetProfile(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to retrieve profile'
            });
        });

        test('should handle user data with missing properties', async () => {
            mockReq.user = {
                userId: 1,
                email: 'test@example.com'
                // Missing other properties
            };

            await handleGetProfile(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Profile retrieved successfully',
                data: {
                    user: {
                        id: 1,
                        email: 'test@example.com',
                        firstName: undefined,
                        lastName: undefined,
                        isVerified: undefined,
                        createdAt: undefined
                    }
                }
            });
        });

        test('should handle exception during profile retrieval', async () => {
            // Mock user object that will cause an error when accessed
            mockReq.user = new Proxy({}, {
                get() {
                    throw new Error('Property access failed');
                }
            });

            await handleGetProfile(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to retrieve profile'
            });
        });

        test('should handle complete user profile data', async () => {
            mockReq.user = {
                userId: 123,
                email: 'complete@example.com',
                firstName: 'Complete',
                lastName: 'Profile',
                isVerified: false,
                createdAt: '2024-12-01T12:00:00.000Z'
            };

            await handleGetProfile(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Profile retrieved successfully',
                data: {
                    user: {
                        id: 123,
                        email: 'complete@example.com',
                        firstName: 'Complete',
                        lastName: 'Profile',
                        isVerified: false,
                        createdAt: '2024-12-01T12:00:00.000Z'
                    }
                }
            });
        });
    });
});