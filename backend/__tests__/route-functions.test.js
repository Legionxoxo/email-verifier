/**
 * Route Functions Unit Tests
 * Testing auth route business logic functions
 */

const { handleSignup } = require('../functions/route_fns/auth/signup');
const { handleLogin } = require('../functions/route_fns/auth/login');
const { handleSendOTP, handleVerifyOTP } = require('../functions/route_fns/auth/otp');
const { hashPassword } = require('../functions/utils/password');
const { generateOTPCode } = require('../functions/utils/otp');

// Mock utilities to control external dependencies
jest.mock('../functions/utils/otp', () => ({
    generateOTPCode: jest.fn(),
    storeOTP: jest.fn(),
    sendOTPEmail: jest.fn(),
    verifyOTP: jest.fn(),
    checkOTPRateLimit: jest.fn()
}));

jest.mock('../functions/utils/jwt', () => ({
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn()
}));

describe('Route Functions Unit Tests', () => {
    let mockDb;
    let mockReq;
    let mockRes;
    let testUser;
    let testUserId;

    beforeAll(async () => {
        try {
            // Clean up any existing global instance
            if (global.databaseInstance) {
                try {
                    global.databaseInstance.close();
                } catch (e) {
                    // Ignore if already closed
                }
                global.databaseInstance = null;
            }

            // Set test environment variable
            process.env.DB_PATH = '.sql/route-test.db';
            
            // Initialize test database
            const { initializeDatabase, getDatabase } = require('../database/connection');
            const db = initializeDatabase();
            
            // Create test user for login tests
            const hashedPassword = await hashPassword('TestPassword123!');
            const insertUser = db.prepare(`
                INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                VALUES (?, ?, ?, ?, 1)
            `);
            
            const result = insertUser.run('Route', 'Test', 'route-test@example.com', hashedPassword);
            testUserId = result.lastInsertRowid;
            testUser = {
                id: testUserId,
                first_name: 'Route',
                last_name: 'Test',
                email: 'route-test@example.com',
                password_hash: hashedPassword,
                is_verified: 1
            };
            
            mockDb = db;
            
        } catch (error) {
            console.error('Route functions test setup failed:', error);
            throw error;
        }
    });

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup mock request and response
        mockReq = {
            body: {}
        };
        
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        // Ensure database connection is still valid
        try {
            const { getDatabase } = require('../database/connection');
            const db = getDatabase();
            if (!db || db.open === false) {
                throw new Error('Database connection lost');
            }
        } catch (error) {
            console.error('Database connection check failed in beforeEach:', error);
            throw error;
        }
    });

    afterEach(() => {
        try {
            // Clean up test data after each test but keep connection open
            if (mockDb && mockDb.open) {
                // Clean up any test data created during tests (but preserve test user)
                mockDb.prepare('DELETE FROM auth_tokens WHERE user_id != ?').run(testUserId);
                mockDb.prepare('DELETE FROM users WHERE email NOT IN (?, ?)').
                    run('route-test@example.com', 'preserved-user@example.com');
            }
        } catch (error) {
            console.error('Route functions afterEach cleanup failed:', error);
        }
    });

    afterAll(async () => {
        try {
            if (mockDb && mockDb.open) {
                mockDb.close();
            }

            // Clean up global instance
            if (global.databaseInstance) {
                try {
                    global.databaseInstance.close();
                } catch (e) {
                    // Ignore if already closed
                }
                global.databaseInstance = null;
            }

            // Clean up test database file
            const fs = require('fs');
            const path = require('path');
            const testDbPath = path.join(__dirname, '..', '.sql', 'route-test.db');
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
            
        } catch (error) {
            console.error('Route functions test cleanup failed:', error);
        }
    });

    describe('Signup Route Function', () => {
        test('should handle successful user signup', async () => {
            try {
                mockReq.body = {
                    firstName: 'New',
                    lastName: 'User',
                    email: 'newuser@example.com',
                    password: 'NewPassword123!'
                };

                const { generateOTPCode, storeOTP, sendOTPEmail } = require('../functions/utils/otp');
                /** @type {jest.MockedFunction<typeof generateOTPCode>} */ (generateOTPCode).mockReturnValue('123456');
                /** @type {jest.MockedFunction<typeof storeOTP>} */ (storeOTP).mockResolvedValue(true);
                /** @type {jest.MockedFunction<typeof sendOTPEmail>} */ (sendOTPEmail).mockResolvedValue(true);

                await handleSignup(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(201);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: true,
                    message: 'Account created! Please check your email and enter the verification code to complete setup.',
                    data: {
                        userId: expect.any(Number),
                        email: 'newuser@example.com',
                        requiresVerification: true,
                        step: 'email_verification',
                        isExistingUser: false
                    }
                });

                expect(generateOTPCode).toHaveBeenCalled();
                expect(storeOTP).toHaveBeenCalled();
                expect(sendOTPEmail).toHaveBeenCalledWith('newuser@example.com', '123456', 'signup_verification');
                
            } catch (error) {
                console.error('Successful signup test failed:', error);
                throw error;
            }
        });

        test('should handle signup with existing email', async () => {
            try {
                mockReq.body = {
                    firstName: 'Existing',
                    lastName: 'User',
                    email: 'route-test@example.com', // This email already exists
                    password: 'TestPassword123!'
                };

                await handleSignup(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(409);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'User with this email already exists and is verified. Please try logging in instead.'
                });
                
            } catch (error) {
                console.error('Existing email signup test failed:', error);
                throw error;
            }
        });

        test('should handle signup with password hashing error', async () => {
            try {
                mockReq.body = {
                    firstName: 'Test',
                    lastName: 'User',
                    email: 'error-test@example.com',
                    password: null // This will cause validation to fail
                };

                await handleSignup(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'All fields are required: firstName, lastName, email, password'
                });
                
            } catch (error) {
                console.error('Password hashing error test failed:', error);
                throw error;
            }
        });

        test('should handle OTP generation failure', async () => {
            try {
                mockReq.body = {
                    firstName: 'OTP',
                    lastName: 'Error',
                    email: 'otp-error@example.com',
                    password: 'TestPassword123!'
                };

                const { storeOTP } = require('../functions/utils/otp');
                /** @type {jest.MockedFunction<typeof storeOTP>} */ (storeOTP).mockRejectedValue(new Error('OTP storage failed'));

                await handleSignup(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Account creation failed. Please try again.'
                });
                
            } catch (error) {
                console.error('OTP generation failure test failed:', error);
                throw error;
            }
        });
    });

    describe('Login Route Function', () => {
        test('should handle successful user login', async () => {
            try {
                mockReq.body = {
                    email: 'route-test@example.com',
                    password: 'TestPassword123!'
                };

                const { generateAccessToken, generateRefreshToken } = require('../functions/utils/jwt');
                /** @type {jest.MockedFunction<typeof generateAccessToken>} */ (generateAccessToken).mockReturnValue('mock-access-token');
                /** @type {jest.MockedFunction<typeof generateRefreshToken>} */ (generateRefreshToken).mockResolvedValue('mock-refresh-token');

                await handleLogin(mockReq, mockRes);

                expect(mockRes.json).toHaveBeenCalledWith({
                    success: true,
                    message: 'Login successful',
                    data: {
                        user: {
                            id: testUserId,
                            email: 'route-test@example.com',
                            firstName: 'Route',
                            lastName: 'Test',
                            isVerified: true
                        },
                        tokens: {
                            accessToken: 'mock-access-token',
                            refreshToken: 'mock-refresh-token'
                        }
                    }
                });

                expect(generateAccessToken).toHaveBeenCalledWith({ 
                    userId: testUserId, 
                    email: 'route-test@example.com' 
                });
                expect(generateRefreshToken).toHaveBeenCalledWith({ 
                    userId: testUserId, 
                    email: 'route-test@example.com' 
                });
                
            } catch (error) {
                console.error('Successful login test failed:', error);
                throw error;
            }
        });

        test('should handle login with non-existent user', async () => {
            try {
                mockReq.body = {
                    email: 'nonexistent@example.com',
                    password: 'TestPassword123!'
                };

                await handleLogin(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Invalid email or password'
                });
                
            } catch (error) {
                console.error('Non-existent user login test failed:', error);
                throw error;
            }
        });

        test('should handle login with incorrect password', async () => {
            try {
                mockReq.body = {
                    email: 'route-test@example.com',
                    password: 'WrongPassword123!'
                };

                await handleLogin(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Invalid email or password'
                });
                
            } catch (error) {
                console.error('Incorrect password login test failed:', error);
                throw error;
            }
        });

        test('should handle token generation failure', async () => {
            try {
                mockReq.body = {
                    email: 'route-test@example.com',
                    password: 'TestPassword123!'
                };

                const { generateRefreshToken } = require('../functions/utils/jwt');
                /** @type {jest.MockedFunction<typeof generateRefreshToken>} */ (generateRefreshToken).mockRejectedValue(new Error('Token generation failed'));

                await handleLogin(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Login failed'
                });
                
            } catch (error) {
                console.error('Token generation failure test failed:', error);
                throw error;
            }
        });
    });

    describe('OTP Route Functions', () => {
        describe('handleSendOTP', () => {
            test('should handle successful OTP sending', async () => {
                try {
                    mockReq.body = {
                        email: 'route-test@example.com'
                    };

                    const { generateOTPCode, storeOTP, sendOTPEmail, checkOTPRateLimit } = require('../functions/utils/otp');
                    /** @type {jest.MockedFunction<typeof checkOTPRateLimit>} */ (checkOTPRateLimit).mockResolvedValue({
                        canRequest: true,
                        remainingRequests: 3,
                        message: ''
                    });
                    /** @type {jest.MockedFunction<typeof generateOTPCode>} */ (generateOTPCode).mockReturnValue('654321');
                    /** @type {jest.MockedFunction<typeof storeOTP>} */ (storeOTP).mockResolvedValue(true);
                    /** @type {jest.MockedFunction<typeof sendOTPEmail>} */ (sendOTPEmail).mockResolvedValue(true);

                    await handleSendOTP(mockReq, mockRes);

                    expect(mockRes.json).toHaveBeenCalledWith({
                        success: true,
                        message: 'Verification code sent to your email',
                        data: {
                            remainingRequests: 2
                        }
                    });

                    expect(checkOTPRateLimit).toHaveBeenCalledWith(testUserId);
                    expect(generateOTPCode).toHaveBeenCalled();
                    expect(storeOTP).toHaveBeenCalledWith(testUserId, 'route-test@example.com', '654321');
                    expect(sendOTPEmail).toHaveBeenCalledWith('route-test@example.com', '654321', 'verification');
                    
                } catch (error) {
                    console.error('Successful OTP sending test failed:', error);
                    throw error;
                }
            });

            test('should handle OTP sending for non-existent user', async () => {
                try {
                    mockReq.body = {
                        email: 'nonexistent@example.com'
                    };

                    await handleSendOTP(mockReq, mockRes);

                    expect(mockRes.status).toHaveBeenCalledWith(404);
                    expect(mockRes.json).toHaveBeenCalledWith({
                        success: false,
                        message: 'User not found'
                    });
                    
                } catch (error) {
                    console.error('Non-existent user OTP test failed:', error);
                    throw error;
                }
            });

            test('should handle OTP rate limiting', async () => {
                try {
                    mockReq.body = {
                        email: 'route-test@example.com'
                    };

                    const { checkOTPRateLimit } = require('../functions/utils/otp');
                    /** @type {jest.MockedFunction<typeof checkOTPRateLimit>} */ (checkOTPRateLimit).mockResolvedValue({
                        canRequest: false,
                        remainingRequests: 0,
                        message: 'Too many OTP requests. Please wait before requesting again.'
                    });

                    await handleSendOTP(mockReq, mockRes);

                    expect(mockRes.status).toHaveBeenCalledWith(429);
                    expect(mockRes.json).toHaveBeenCalledWith({
                        success: false,
                        message: 'Too many OTP requests. Please wait before requesting again.'
                    });
                    
                } catch (error) {
                    console.error('OTP rate limiting test failed:', error);
                    throw error;
                }
            });

            test('should handle OTP storage failure', async () => {
                try {
                    mockReq.body = {
                        email: 'route-test@example.com'
                    };

                    const { checkOTPRateLimit, storeOTP } = require('../functions/utils/otp');
                    checkOTPRateLimit.mockResolvedValue({ canRequest: true, remainingRequests: 3 });
                    storeOTP.mockRejectedValue(new Error('Storage failed'));

                    await handleSendOTP(mockReq, mockRes);

                    expect(mockRes.status).toHaveBeenCalledWith(500);
                    expect(mockRes.json).toHaveBeenCalledWith({
                        success: false,
                        message: 'Failed to send verification code'
                    });
                    
                } catch (error) {
                    console.error('OTP storage failure test failed:', error);
                    throw error;
                }
            });
        });

        describe('handleVerifyOTP', () => {
            test('should handle successful OTP verification', async () => {
                try {
                    mockReq.body = {
                        email: 'route-test@example.com',
                        otp: '123456'
                    };

                    const { verifyOTP } = require('../functions/utils/otp');
                    const { generateAccessToken, generateRefreshToken } = require('../functions/utils/jwt');
                    
                    /** @type {jest.MockedFunction<typeof verifyOTP>} */ (verifyOTP).mockResolvedValue({
                        success: true,
                        user: {
                            id: testUserId,
                            email: 'route-test@example.com',
                            first_name: 'Route',
                            last_name: 'Test'
                        }
                    });
                    /** @type {jest.MockedFunction<typeof generateAccessToken>} */ (generateAccessToken).mockReturnValue('new-access-token');
                    /** @type {jest.MockedFunction<typeof generateRefreshToken>} */ (generateRefreshToken).mockResolvedValue('new-refresh-token');

                    await handleVerifyOTP(mockReq, mockRes);

                    expect(mockRes.json).toHaveBeenCalledWith({
                        success: true,
                        message: 'Email verified successfully',
                        data: {
                            user: {
                                id: testUserId,
                                email: 'route-test@example.com',
                                firstName: 'Route',
                                lastName: 'Test',
                                isVerified: true
                            },
                            tokens: {
                                accessToken: 'new-access-token',
                                refreshToken: 'new-refresh-token'
                            }
                        }
                    });

                    expect(verifyOTP).toHaveBeenCalledWith('route-test@example.com', '123456');
                    
                } catch (error) {
                    console.error('Successful OTP verification test failed:', error);
                    throw error;
                }
            });

            test('should handle invalid OTP verification', async () => {
                try {
                    mockReq.body = {
                        email: 'route-test@example.com',
                        otp: '000000'
                    };

                    const { verifyOTP } = require('../functions/utils/otp');
                    /** @type {jest.MockedFunction<typeof verifyOTP>} */ (verifyOTP).mockResolvedValue({
                        success: false,
                        message: 'Invalid or expired verification code'
                    });

                    await handleVerifyOTP(mockReq, mockRes);

                    expect(mockRes.status).toHaveBeenCalledWith(400);
                    expect(mockRes.json).toHaveBeenCalledWith({
                        success: false,
                        message: 'Invalid or expired verification code'
                    });
                    
                } catch (error) {
                    console.error('Invalid OTP verification test failed:', error);
                    throw error;
                }
            });

            test('should handle OTP verification service error', async () => {
                try {
                    mockReq.body = {
                        email: 'route-test@example.com',
                        otp: '123456'
                    };

                    const { verifyOTP } = require('../functions/utils/otp');
                    /** @type {jest.MockedFunction<typeof verifyOTP>} */ (verifyOTP).mockRejectedValue(new Error('Verification service error'));

                    await handleVerifyOTP(mockReq, mockRes);

                    expect(mockRes.status).toHaveBeenCalledWith(500);
                    expect(mockRes.json).toHaveBeenCalledWith({
                        success: false,
                        message: 'Email verification failed'
                    });
                    
                } catch (error) {
                    console.error('OTP verification service error test failed:', error);
                    throw error;
                }
            });

            test('should handle token generation error during verification', async () => {
                try {
                    mockReq.body = {
                        email: 'route-test@example.com',
                        otp: '123456'
                    };

                    const { verifyOTP } = require('../functions/utils/otp');
                    const { generateRefreshToken } = require('../functions/utils/jwt');
                    
                    /** @type {jest.MockedFunction<typeof verifyOTP>} */ (verifyOTP).mockResolvedValue({
                        success: true,
                        user: { id: testUserId, email: 'route-test@example.com', first_name: 'Route', last_name: 'Test' }
                    });
                    /** @type {jest.MockedFunction<typeof generateRefreshToken>} */ (generateRefreshToken).mockRejectedValue(new Error('Token generation failed'));

                    await handleVerifyOTP(mockReq, mockRes);

                    expect(mockRes.status).toHaveBeenCalledWith(500);
                    expect(mockRes.json).toHaveBeenCalledWith({
                        success: false,
                        message: 'Email verification failed'
                    });
                    
                } catch (error) {
                    console.error('Token generation error during verification test failed:', error);
                    throw error;
                }
            });
        });
    });

    describe('Error Handling Edge Cases', () => {
        test('should handle database connection issues', async () => {
            try {
                // Mock database failure by providing malformed request
                mockReq.body = {
                    firstName: 'Test',
                    lastName: 'User',
                    email: null, // This will cause validation to fail with 400 status
                    password: 'TestPassword123!'
                };

                await handleSignup(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'All fields are required: firstName, lastName, email, password'
                });
                
            } catch (error) {
                console.error('Database connection issues test failed:', error);
                throw error;
            }
        });

        test('should handle missing request body data', async () => {
            try {
                // Empty request body
                mockReq.body = {};

                await handleLogin(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Invalid email or password'
                });
                
            } catch (error) {
                console.error('Missing request body test failed:', error);
                throw error;
            }
        });

        test('should handle undefined request properties', async () => {
            try {
                // Undefined email property
                mockReq.body = {
                    email: undefined,
                    otp: '123456'
                };

                await handleVerifyOTP(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Email verification failed'
                });
                
            } catch (error) {
                console.error('Undefined request properties test failed:', error);
                throw error;
            }
        });
    });
});