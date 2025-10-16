/**
 * Utility Functions Unit Tests
 * Testing password hashing, JWT operations, and OTP functionality
 */

const { hashPassword, verifyPassword } = require('../functions/utils/password');
const { 
    generateAccessToken, 
    generateRefreshToken, 
    generatePasswordResetToken,
    verifyAccessToken,
    verifyRefreshToken,
    verifyPasswordResetToken
} = require('../functions/utils/jwt');
const { 
    generateOTPCode
} = require('../functions/utils/otp');
const { 
    axiosGet, 
    axiosPost, 
    axiosPut, 
    axiosDelete, 
    sleep 
} = require('../functions/utils/axios');

describe('Utility Functions Unit Tests', () => {
    let testDb;

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
            process.env.DB_PATH = '.sql/utils-test.db';
            
            // Initialize test database
            const { initializeDatabase } = require('../database/connection');
            testDb = initializeDatabase();
            
        } catch (error) {
            console.error('Utils test setup failed:', error);
            throw error;
        }
    });

    afterAll(async () => {
        try {
            if (testDb && testDb.open) {
                testDb.close();
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
            const testDbPath = path.join(__dirname, '..', '.sql', 'utils-test.db');
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
            
        } catch (error) {
            console.error('Utils test cleanup failed:', error);
        }
    });

    describe('Password Utilities', () => {
        const testPassword = 'TestPassword123!';
        let hashedPassword;

        test('should hash password successfully', async () => {
            try {
                hashedPassword = await hashPassword(testPassword);
                
                expect(hashedPassword).toBeDefined();
                expect(typeof hashedPassword).toBe('string');
                expect(hashedPassword.length).toBeGreaterThan(10);
                expect(hashedPassword).not.toBe(testPassword);
                
            } catch (error) {
                console.error('Password hashing test failed:', error);
                throw error;
            }
        });

        test('should verify correct password', async () => {
            try {
                const isValid = await verifyPassword(testPassword, hashedPassword);
                expect(isValid).toBe(true);
                
            } catch (error) {
                console.error('Password verification test failed:', error);
                throw error;
            }
        });

        test('should reject incorrect password', async () => {
            try {
                const isValid = await verifyPassword('WrongPassword123!', hashedPassword);
                expect(isValid).toBe(false);
                
            } catch (error) {
                console.error('Incorrect password test failed:', error);
                throw error;
            }
        });

        test('should handle empty password', async () => {
            try {
                await expect(hashPassword('')).rejects.toThrow();
                
            } catch (error) {
                console.error('Empty password test failed:', error);
                throw error;
            }
        });

        test('should handle null password', async () => {
            try {
                await expect(hashPassword(null)).rejects.toThrow();
                
            } catch (error) {
                console.error('Null password test failed:', error);
                throw error;
            }
        });

        test('should handle undefined password', async () => {
            try {
                await expect(hashPassword(undefined)).rejects.toThrow();
                
            } catch (error) {
                console.error('Undefined password test failed:', error);
                throw error;
            }
        });

        test('should handle very long passwords', async () => {
            try {
                const longPassword = 'a'.repeat(1000) + 'TestPassword123!';
                const hashed = await hashPassword(longPassword);
                
                expect(hashed).toBeDefined();
                expect(typeof hashed).toBe('string');
                
                const isValid = await verifyPassword(longPassword, hashed);
                expect(isValid).toBe(true);
                
            } catch (error) {
                console.error('Long password test failed:', error);
                throw error;
            }
        });
    });

    describe('JWT Utilities', () => {
        let testPayload;
        let testUserId;
        let accessToken;
        let refreshToken;
        let resetToken;
        
        // Helper function to ensure test user exists
        async function ensureTestUser() {
            try {
                const { getDatabase, initializeDatabase } = require('../database/connection');
                const { hashPassword } = require('../functions/utils/password');
                
                const db = getDatabase();
                
                // Check if user already exists
                let user = db.prepare('SELECT id FROM users WHERE email = ?').get('jwt-test@example.com');
                
                if (!user) {
                    // Create test user
                    const hashedPassword = await hashPassword('TestPassword123!');
                    const insertUser = db.prepare(`
                        INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                        VALUES (?, ?, ?, ?, 1)
                    `);
                    
                    const result = insertUser.run('Test', 'User', 'jwt-test@example.com', hashedPassword);
                    testUserId = result.lastInsertRowid;
                } else {
                    testUserId = user.id;
                }
                
                testPayload = { userId: testUserId, email: 'jwt-test@example.com' };
                
            } catch (error) {
                console.error('JWT test user setup failed:', error);
                throw error;
            }
        }

        test('should generate access token successfully', async () => {
            try {
                await ensureTestUser();
                accessToken = generateAccessToken(testPayload);
                
                expect(accessToken).toBeDefined();
                expect(typeof accessToken).toBe('string');
                expect(accessToken.split('.')).toHaveLength(3); // JWT format
                
            } catch (error) {
                console.error('Access token generation test failed:', error);
                throw error;
            }
        });

        test('should generate refresh token successfully', async () => {
            try {
                await ensureTestUser();
                refreshToken = await generateRefreshToken(testPayload);
                
                expect(refreshToken).toBeDefined();
                expect(typeof refreshToken).toBe('string');
                expect(refreshToken.split('.')).toHaveLength(3); // JWT format
                
            } catch (error) {
                console.error('Refresh token generation test failed:', error);
                throw error;
            }
        });

        test('should generate password reset token successfully', async () => {
            try {
                await ensureTestUser();
                resetToken = await generatePasswordResetToken(testPayload);
                
                expect(resetToken).toBeDefined();
                expect(typeof resetToken).toBe('string');
                expect(resetToken.split('.')).toHaveLength(3); // JWT format
                
            } catch (error) {
                console.error('Password reset token generation test failed:', error);
                throw error;
            }
        });

        test('should verify access token successfully', async () => {
            try {
                await ensureTestUser();
                // Generate token if not available
                if (!accessToken) {
                    accessToken = generateAccessToken(testPayload);
                }
                
                const decoded = verifyAccessToken(accessToken);
                
                expect(decoded).toBeDefined();
                expect(decoded.userId).toBe(testPayload.userId);
                expect(decoded.email).toBe(testPayload.email);
                expect(decoded.iat).toBeDefined();
                expect(decoded.exp).toBeDefined();
                
            } catch (error) {
                console.error('Access token verification test failed:', error);
                throw error;
            }
        });

        test('should verify refresh token successfully', async () => {
            try {
                await ensureTestUser();
                // Ensure refresh token is generated first if not available
                if (!refreshToken) {
                    refreshToken = await generateRefreshToken(testPayload);
                }
                
                const decoded = await verifyRefreshToken(refreshToken);
                
                expect(decoded).toBeDefined();
                expect(decoded.userId).toBe(testPayload.userId);
                expect(decoded.email).toBe(testPayload.email);
                
            } catch (error) {
                console.error('Refresh token verification test failed:', error);
                throw error;
            }
        });

        test('should verify password reset token successfully', async () => {
            try {
                await ensureTestUser();
                // Ensure password reset token is generated first if not available
                if (!resetToken) {
                    resetToken = await generatePasswordResetToken(testPayload);
                }
                
                const decoded = await verifyPasswordResetToken(resetToken);
                
                expect(decoded).toBeDefined();
                expect(decoded.userId).toBe(testPayload.userId);
                expect(decoded.email).toBe(testPayload.email);
                
            } catch (error) {
                console.error('Password reset token verification test failed:', error);
                throw error;
            }
        });

        test('should reject invalid access token', () => {
            try {
                expect(() => verifyAccessToken('invalid.token.here')).toThrow();
                
            } catch (error) {
                console.error('Invalid access token test failed:', error);
                throw error;
            }
        });

        test('should reject invalid refresh token', async () => {
            try {
                await expect(verifyRefreshToken('invalid.token.here')).rejects.toThrow();
                
            } catch (error) {
                console.error('Invalid refresh token test failed:', error);
                throw error;
            }
        });

        test('should reject invalid password reset token', async () => {
            try {
                await expect(verifyPasswordResetToken('invalid.token.here')).rejects.toThrow();
                
            } catch (error) {
                console.error('Invalid password reset token test failed:', error);
                throw error;
            }
        });

        test('should handle empty token verification', async () => {
            try {
                expect(() => verifyAccessToken('')).toThrow();
                await expect(verifyRefreshToken('')).rejects.toThrow();
                await expect(verifyPasswordResetToken('')).rejects.toThrow();
                
            } catch (error) {
                console.error('Empty token verification test failed:', error);
                throw error;
            }
        });

        test('should handle null token verification', async () => {
            try {
                expect(() => verifyAccessToken(null)).toThrow();
                await expect(verifyRefreshToken(null)).rejects.toThrow();
                await expect(verifyPasswordResetToken(null)).rejects.toThrow();
                
            } catch (error) {
                console.error('Null token verification test failed:', error);
                throw error;
            }
        });

        test('should handle malformed JWT tokens', async () => {
            try {
                const malformedTokens = [
                    'not.a.jwt',
                    'header.payload', // Missing signature
                    'header.payload.signature.extra', // Too many parts
                    '.payload.signature', // Missing header
                    'header..signature', // Missing payload
                    'header.payload.', // Missing signature
                ];

                for (const malformed of malformedTokens) {
                    expect(() => verifyAccessToken(malformed)).toThrow();
                    await expect(verifyRefreshToken(malformed)).rejects.toThrow();
                    await expect(verifyPasswordResetToken(malformed)).rejects.toThrow();
                }
                
            } catch (error) {
                console.error('Malformed JWT test failed:', error);
                throw error;
            }
        });
    });

    describe('OTP Utilities', () => {
        test('should generate OTP code successfully', () => {
            try {
                const otpCode = generateOTPCode();
                
                expect(otpCode).toBeDefined();
                expect(typeof otpCode).toBe('string');
                expect(otpCode).toMatch(/^\d{6}$/); // 6 digits
                expect(parseInt(otpCode)).toBeGreaterThanOrEqual(100000);
                expect(parseInt(otpCode)).toBeLessThanOrEqual(999999);
                
            } catch (error) {
                console.error('OTP generation test failed:', error);
                throw error;
            }
        });

        test('should generate different OTP codes', () => {
            try {
                const otp1 = generateOTPCode();
                const otp2 = generateOTPCode();
                const otp3 = generateOTPCode();
                
                // While there's a small chance they could be the same, it's highly unlikely
                expect([otp1, otp2, otp3].every(otp => otp.match(/^\d{6}$/))).toBe(true);
                
            } catch (error) {
                console.error('Different OTP codes test failed:', error);
                throw error;
            }
        });

        test('should handle OTP code validation', () => {
            try {
                const otpCode = generateOTPCode();
                
                // Test valid format
                expect(otpCode).toMatch(/^\d{6}$/);
                
                // Test numeric conversion
                const numericOTP = parseInt(otpCode);
                expect(numericOTP).toBeGreaterThanOrEqual(100000);
                expect(numericOTP).toBeLessThanOrEqual(999999);
                
            } catch (error) {
                console.error('OTP validation test failed:', error);
                throw error;
            }
        });
    });

    describe('Axios Utilities', () => {
        // Mock axios for testing
        const axios = require('axios');
        
        beforeEach(() => {
            jest.clearAllMocks();
        });

        describe('Sleep Function', () => {
            test('should sleep for specified duration', async () => {
                try {
                    const startTime = Date.now();
                    await sleep(100);  // 100ms
                    const endTime = Date.now();
                    
                    expect(endTime - startTime).toBeGreaterThanOrEqual(95); // Allow some tolerance
                    expect(endTime - startTime).toBeLessThan(200); // Reasonable upper bound
                    
                } catch (error) {
                    console.error('Sleep duration test failed:', error);
                    throw error;
                }
            });

            test('should handle invalid sleep duration', async () => {
                try {
                    expect(() => sleep(-100)).toThrow('Sleep duration must be a positive number');
                    expect(() => sleep('invalid')).toThrow('Sleep duration must be a positive number');
                    expect(() => sleep(null)).toThrow('Sleep duration must be a positive number');
                    expect(() => sleep(undefined)).toThrow('Sleep duration must be a positive number');
                    
                } catch (error) {
                    console.error('Invalid sleep duration test failed:', error);
                    throw error;
                }
            });

            test('should handle zero sleep duration', async () => {
                try {
                    const startTime = Date.now();
                    await sleep(0);
                    const endTime = Date.now();
                    
                    expect(endTime - startTime).toBeLessThan(50); // Should be nearly instant
                    
                } catch (error) {
                    console.error('Zero sleep duration test failed:', error);
                    throw error;
                }
            });
        });

        describe('HTTP GET Requests', () => {
            test('should handle successful GET request', async () => {
                try {
                    // Mock successful response
                    const mockResponse = {
                        data: { message: 'success' },
                        status: 200,
                        headers: { 'content-type': 'application/json' }
                    };
                    
                    jest.spyOn(axios, 'get').mockResolvedValueOnce(mockResponse);
                    
                    const result = await axiosGet('https://api.example.com/data');
                    
                    expect(result.success).toBe(true);
                    expect(result.data).toEqual({ message: 'success' });
                    expect(result.status).toBe(200);
                    expect(result.headers).toEqual({ 'content-type': 'application/json' });
                    
                } catch (error) {
                    console.error('Successful GET request test failed:', error);
                    throw error;
                }
            });

            test('should handle GET request with server error response', async () => {
                try {
                    const mockError = {
                        response: {
                            status: 500,
                            data: { error: 'Internal Server Error' },
                            headers: { 'content-type': 'application/json' }
                        }
                    };
                    
                    jest.spyOn(axios, 'get').mockRejectedValueOnce(mockError);
                    
                    const result = await axiosGet('https://api.example.com/error');
                    
                    expect(result.success).toBe(false);
                    expect(result.status).toBe(500);
                    expect(result.data).toEqual({ error: 'Internal Server Error' });
                    
                } catch (error) {
                    console.error('GET server error test failed:', error);
                    throw error;
                }
            });

            test('should handle GET request with network error', async () => {
                try {
                    const mockError = {
                        request: {},
                        message: 'Network Error'
                    };
                    
                    jest.spyOn(axios, 'get').mockRejectedValueOnce(mockError);
                    
                    const result = await axiosGet('https://api.example.com/network-error');
                    
                    expect(result.success).toBe(false);
                    expect(result.status).toBe(0);
                    expect(result.error).toBe('No response received from server');
                    expect(result.data).toBe(null);
                    
                } catch (error) {
                    console.error('GET network error test failed:', error);
                    throw error;
                }
            });

            test('should handle GET request with invalid URL', async () => {
                try {
                    const result1 = await axiosGet('');
                    expect(result1.success).toBe(false);
                    expect(result1.error).toBe('URL is required and must be a string');
                    
                    const result2 = await axiosGet(null);
                    expect(result2.success).toBe(false);
                    expect(result2.error).toBe('URL is required and must be a string');
                    
                    const result3 = await axiosGet(123);
                    expect(result3.success).toBe(false);
                    expect(result3.error).toBe('URL is required and must be a string');
                    
                } catch (error) {
                    console.error('Invalid URL GET test failed:', error);
                    throw error;
                }
            });

            test('should handle GET request with custom config', async () => {
                try {
                    const mockResponse = {
                        data: { message: 'success' },
                        status: 200,
                        headers: { 'content-type': 'application/json' }
                    };
                    
                    const customConfig = {
                        timeout: 5000,
                        headers: { 'Authorization': 'Bearer token123' }
                    };
                    
                    const mockGet = jest.spyOn(axios, 'get').mockResolvedValueOnce(mockResponse);
                    
                    const result = await axiosGet('https://api.example.com/data', customConfig);
                    
                    expect(result.success).toBe(true);
                    expect(result.data).toEqual({ message: 'success' });
                    expect(mockGet).toHaveBeenCalledWith('https://api.example.com/data', expect.objectContaining({
                        timeout: 5000,
                        headers: expect.objectContaining({
                            'Authorization': 'Bearer token123'
                        })
                    }));
                    
                } catch (error) {
                    console.error('GET custom config test failed:', error);
                    throw error;
                }
            });
        });

        describe('HTTP POST Requests', () => {
            test('should handle successful POST request', async () => {
                try {
                    const mockResponse = {
                        data: { id: 1, created: true },
                        status: 201,
                        headers: { 'content-type': 'application/json' }
                    };
                    
                    jest.spyOn(axios, 'post').mockResolvedValueOnce(mockResponse);
                    
                    const postData = { name: 'Test User', email: 'test@example.com' };
                    const result = await axiosPost('https://api.example.com/users', postData);
                    
                    expect(result.success).toBe(true);
                    expect(result.data).toEqual({ id: 1, created: true });
                    expect(result.status).toBe(201);
                    
                } catch (error) {
                    console.error('Successful POST request test failed:', error);
                    throw error;
                }
            });

            test('should handle POST request with validation error', async () => {
                try {
                    const mockError = {
                        response: {
                            status: 400,
                            data: { errors: ['Email is required'] },
                            headers: { 'content-type': 'application/json' }
                        }
                    };
                    
                    jest.spyOn(axios, 'post').mockRejectedValueOnce(mockError);
                    
                    const result = await axiosPost('https://api.example.com/users', {});
                    
                    expect(result.success).toBe(false);
                    expect(result.status).toBe(400);
                    expect(result.data).toEqual({ errors: ['Email is required'] });
                    
                } catch (error) {
                    console.error('POST validation error test failed:', error);
                    throw error;
                }
            });

            test('should handle POST request without data parameter', async () => {
                try {
                    const mockResponse = {
                        data: { message: 'success' },
                        status: 200,
                        headers: { 'content-type': 'application/json' }
                    };
                    
                    jest.spyOn(axios, 'post').mockResolvedValueOnce(mockResponse);
                    
                    const result = await axiosPost('https://api.example.com/ping');
                    
                    expect(result.success).toBe(true);
                    expect(axios.post).toHaveBeenCalledWith('https://api.example.com/ping', {}, expect.any(Object));
                    
                } catch (error) {
                    console.error('POST without data test failed:', error);
                    throw error;
                }
            });
        });

        describe('HTTP PUT Requests', () => {
            test('should handle successful PUT request', async () => {
                try {
                    const mockResponse = {
                        data: { id: 1, updated: true },
                        status: 200,
                        headers: { 'content-type': 'application/json' }
                    };
                    
                    jest.spyOn(axios, 'put').mockResolvedValueOnce(mockResponse);
                    
                    const updateData = { name: 'Updated User' };
                    const result = await axiosPut('https://api.example.com/users/1', updateData);
                    
                    expect(result.success).toBe(true);
                    expect(result.data).toEqual({ id: 1, updated: true });
                    expect(result.status).toBe(200);
                    
                } catch (error) {
                    console.error('Successful PUT request test failed:', error);
                    throw error;
                }
            });

            test('should handle PUT request with not found error', async () => {
                try {
                    const mockError = {
                        response: {
                            status: 404,
                            data: { error: 'User not found' },
                            headers: { 'content-type': 'application/json' }
                        }
                    };
                    
                    jest.spyOn(axios, 'put').mockRejectedValueOnce(mockError);
                    
                    const result = await axiosPut('https://api.example.com/users/999', {});
                    
                    expect(result.success).toBe(false);
                    expect(result.status).toBe(404);
                    expect(result.data).toEqual({ error: 'User not found' });
                    
                } catch (error) {
                    console.error('PUT not found error test failed:', error);
                    throw error;
                }
            });
        });

        describe('HTTP DELETE Requests', () => {
            test('should handle successful DELETE request', async () => {
                try {
                    const mockResponse = {
                        data: { deleted: true },
                        status: 200,
                        headers: { 'content-type': 'application/json' }
                    };
                    
                    jest.spyOn(axios, 'delete').mockResolvedValueOnce(mockResponse);
                    
                    const result = await axiosDelete('https://api.example.com/users/1');
                    
                    expect(result.success).toBe(true);
                    expect(result.data).toEqual({ deleted: true });
                    expect(result.status).toBe(200);
                    
                } catch (error) {
                    console.error('Successful DELETE request test failed:', error);
                    throw error;
                }
            });

            test('should handle DELETE request with unauthorized error', async () => {
                try {
                    const mockError = {
                        response: {
                            status: 401,
                            data: { error: 'Unauthorized' },
                            headers: { 'content-type': 'application/json' }
                        }
                    };
                    
                    jest.spyOn(axios, 'delete').mockRejectedValueOnce(mockError);
                    
                    const result = await axiosDelete('https://api.example.com/users/1');
                    
                    expect(result.success).toBe(false);
                    expect(result.status).toBe(401);
                    expect(result.data).toEqual({ error: 'Unauthorized' });
                    
                } catch (error) {
                    console.error('DELETE unauthorized error test failed:', error);
                    throw error;
                }
            });
        });

        describe('Error Handling Edge Cases', () => {
            test('should handle generic errors for all HTTP methods', async () => {
                try {
                    const genericError = new Error('Something went wrong');
                    
                    jest.spyOn(axios, 'get').mockRejectedValueOnce(genericError);
                    jest.spyOn(axios, 'post').mockRejectedValueOnce(genericError);
                    jest.spyOn(axios, 'put').mockRejectedValueOnce(genericError);
                    jest.spyOn(axios, 'delete').mockRejectedValueOnce(genericError);
                    
                    const getResult = await axiosGet('https://api.example.com/test');
                    const postResult = await axiosPost('https://api.example.com/test', {});
                    const putResult = await axiosPut('https://api.example.com/test', {});
                    const deleteResult = await axiosDelete('https://api.example.com/test');
                    
                    expect(getResult.success).toBe(false);
                    expect(getResult.error).toBe('Something went wrong');
                    expect(getResult.status).toBe(0);
                    
                    expect(postResult.success).toBe(false);
                    expect(putResult.success).toBe(false);
                    expect(deleteResult.success).toBe(false);
                    
                } catch (error) {
                    console.error('Generic error handling test failed:', error);
                    throw error;
                }
            });

            test('should handle timeout errors', async () => {
                try {
                    const timeoutError = new Error('timeout of 10000ms exceeded');
                    timeoutError.code = 'ECONNABORTED';
                    
                    jest.spyOn(axios, 'get').mockRejectedValueOnce(timeoutError);
                    
                    const result = await axiosGet('https://api.example.com/slow');
                    
                    expect(result.success).toBe(false);
                    expect(result.error).toBe('timeout of 10000ms exceeded');
                    expect(result.status).toBe(0);
                    
                } catch (error) {
                    console.error('Timeout error test failed:', error);
                    throw error;
                }
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle very large payloads in JWT', () => {
            try {
                const largePayload = {
                    userId: 123,
                    email: 'test@example.com',
                    data: 'x'.repeat(10000) // Large data
                };

                const token = generateAccessToken(largePayload);
                expect(token).toBeDefined();
                expect(typeof token).toBe('string');
                
            } catch (error) {
                console.error('Large JWT payload test failed:', error);
                throw error;
            }
        });

        test('should handle special characters in passwords', async () => {
            try {
                const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?';
                const hashed = await hashPassword(specialPassword);
                
                expect(hashed).toBeDefined();
                
                const isValid = await verifyPassword(specialPassword, hashed);
                expect(isValid).toBe(true);
                
            } catch (error) {
                console.error('Special characters password test failed:', error);
                throw error;
            }
        });

        test('should handle unicode characters in passwords', async () => {
            try {
                const unicodePassword = 'Test密码123!🔒';
                const hashed = await hashPassword(unicodePassword);
                
                expect(hashed).toBeDefined();
                
                const isValid = await verifyPassword(unicodePassword, hashed);
                expect(isValid).toBe(true);
                
            } catch (error) {
                console.error('Unicode password test failed:', error);
                throw error;
            }
        });

        test('should handle concurrent password operations', async () => {
            try {
                const passwords = ['Password1!', 'Password2!', 'Password3!', 'Password4!', 'Password5!'];
                
                const hashPromises = passwords.map(pwd => hashPassword(pwd));
                const hashes = await Promise.all(hashPromises);
                
                expect(hashes).toHaveLength(passwords.length);
                hashes.forEach(hash => {
                    expect(hash).toBeDefined();
                    expect(typeof hash).toBe('string');
                });

                // Verify all passwords
                const verifyPromises = passwords.map((pwd, index) => 
                    verifyPassword(pwd, hashes[index])
                );
                const results = await Promise.all(verifyPromises);
                
                results.forEach(result => {
                    expect(result).toBe(true);
                });
                
            } catch (error) {
                console.error('Concurrent password operations test failed:', error);
                throw error;
            }
        });
    });
});