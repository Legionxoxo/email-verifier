/**
 * Middleware Functions Unit Tests
 * Testing authentication middleware, security middleware, and validation
 */

const request = require('supertest');
const express = require('express');
const { 
    authenticateToken,
    verifyUserExists,
    requireVerifiedEmail,
    optionalAuth,
    authenticate,
    authenticateVerified
} = require('../functions/middleware/auth');
const { generateAccessToken } = require('../functions/utils/jwt');
const { hashPassword } = require('../functions/utils/password');
const { 
    validateSignup, 
    validateLogin, 
    validateEmail, 
    validateOTP,
    handleValidationErrors,
    sanitizeInput,
    logSecurityEvent
} = require('../functions/middleware/security');

describe('Middleware Functions Unit Tests', () => {
    let app;
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
            process.env.DB_PATH = '.sql/middleware-test.db';
            
            // Initialize test database
            const { initializeDatabase } = require('../database/connection');
            testDb = initializeDatabase();
            
            app = express();
            app.use(express.json());
            app.use(express.urlencoded({ extended: true }));
            
        } catch (error) {
            console.error('Middleware test setup failed:', error);
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
            const testDbPath = path.join(__dirname, '..', '.sql', 'middleware-test.db');
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
            
        } catch (error) {
            console.error('Middleware test cleanup failed:', error);
        }
    });

    describe('Validation Middleware', () => {
        describe('validateSignup', () => {
            beforeAll(() => {
                app.post('/test-signup', 
                    validateSignup, 
                    handleValidationErrors, 
                    (req, res) => res.json({ success: true })
                );
            });

            test('should accept valid signup data', async () => {
                try {
                    const validSignup = {
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john.doe@example.com',
                        password: 'SecurePassword123!'
                    };

                    const response = await request(app)
                        .post('/test-signup')
                        .send(validSignup)
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    
                } catch (error) {
                    console.error('Valid signup test failed:', error);
                    throw error;
                }
            });

            test('should reject signup with invalid email', async () => {
                try {
                    const invalidEmail = {
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'invalid-email',
                        password: 'SecurePassword123!'
                    };

                    const response = await request(app)
                        .post('/test-signup')
                        .send(invalidEmail)
                        .expect(400);

                    expect(response.body).toHaveProperty('success', false);
                    
                } catch (error) {
                    console.error('Invalid email signup test failed:', error);
                    throw error;
                }
            });

            test('should reject signup with weak password', async () => {
                try {
                    const weakPassword = {
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john.doe@example.com',
                        password: '123'
                    };

                    const response = await request(app)
                        .post('/test-signup')
                        .send(weakPassword)
                        .expect(400);

                    expect(response.body).toHaveProperty('success', false);
                    
                } catch (error) {
                    console.error('Weak password signup test failed:', error);
                    throw error;
                }
            });

            test('should reject signup with missing required fields', async () => {
                try {
                    const missingFields = {
                        firstName: 'John'
                        // Missing lastName, email, password
                    };

                    const response = await request(app)
                        .post('/test-signup')
                        .send(missingFields)
                        .expect(400);

                    expect(response.body).toHaveProperty('success', false);
                    
                } catch (error) {
                    console.error('Missing fields signup test failed:', error);
                    throw error;
                }
            });

            test('should reject signup with empty strings', async () => {
                try {
                    const emptyStrings = {
                        firstName: '',
                        lastName: '',
                        email: '',
                        password: ''
                    };

                    const response = await request(app)
                        .post('/test-signup')
                        .send(emptyStrings)
                        .expect(400);

                    expect(response.body).toHaveProperty('success', false);
                    
                } catch (error) {
                    console.error('Empty strings signup test failed:', error);
                    throw error;
                }
            });

            test('should reject signup with names containing special characters', async () => {
                try {
                    const specialChars = {
                        firstName: 'John@123',
                        lastName: 'Doe#456',
                        email: 'john.doe@example.com',
                        password: 'SecurePassword123!'
                    };

                    const response = await request(app)
                        .post('/test-signup')
                        .send(specialChars)
                        .expect(400);

                    expect(response.body).toHaveProperty('success', false);
                    
                } catch (error) {
                    console.error('Special characters name test failed:', error);
                    throw error;
                }
            });
        });

        describe('validateLogin', () => {
            beforeAll(() => {
                app.post('/test-login', 
                    validateLogin, 
                    handleValidationErrors, 
                    (req, res) => res.json({ success: true })
                );
            });

            test('should accept valid login data', async () => {
                try {
                    const validLogin = {
                        email: 'test@example.com',
                        password: 'TestPassword123!'
                    };

                    const response = await request(app)
                        .post('/test-login')
                        .send(validLogin)
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    
                } catch (error) {
                    console.error('Valid login test failed:', error);
                    throw error;
                }
            });

            test('should reject login with invalid email', async () => {
                try {
                    const invalidEmail = {
                        email: 'invalid-email',
                        password: 'TestPassword123!'
                    };

                    const response = await request(app)
                        .post('/test-login')
                        .send(invalidEmail)
                        .expect(400);

                    expect(response.body).toHaveProperty('success', false);
                    
                } catch (error) {
                    console.error('Invalid email login test failed:', error);
                    throw error;
                }
            });

            test('should reject login with missing credentials', async () => {
                try {
                    const missingPassword = {
                        email: 'test@example.com'
                        // Missing password
                    };

                    const response = await request(app)
                        .post('/test-login')
                        .send(missingPassword)
                        .expect(400);

                    expect(response.body).toHaveProperty('success', false);
                    
                } catch (error) {
                    console.error('Missing credentials login test failed:', error);
                    throw error;
                }
            });
        });

        describe('validateEmail', () => {
            beforeAll(() => {
                app.post('/test-email', 
                    validateEmail, 
                    handleValidationErrors, 
                    (req, res) => res.json({ success: true })
                );
            });

            test('should accept valid email', async () => {
                try {
                    const validEmail = {
                        email: 'test@example.com'
                    };

                    const response = await request(app)
                        .post('/test-email')
                        .send(validEmail)
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    
                } catch (error) {
                    console.error('Valid email test failed:', error);
                    throw error;
                }
            });

            test('should reject invalid email formats', async () => {
                try {
                    const invalidEmails = [
                        'invalid-email',
                        '@example.com',
                        'test@',
                        'test..test@example.com',
                        'test@example',
                        ''
                    ];

                    for (const email of invalidEmails) {
                        const response = await request(app)
                            .post('/test-email')
                            .send({ email })
                            .expect(400);

                        expect(response.body).toHaveProperty('success', false);
                    }
                    
                } catch (error) {
                    console.error('Invalid email formats test failed:', error);
                    throw error;
                }
            });
        });

        describe('validateOTP', () => {
            beforeAll(() => {
                app.post('/test-otp', 
                    validateOTP, 
                    handleValidationErrors, 
                    (req, res) => res.json({ success: true })
                );
            });

            test('should accept valid OTP data', async () => {
                try {
                    const validOTP = {
                        email: 'test@example.com',
                        otp: '123456'
                    };

                    const response = await request(app)
                        .post('/test-otp')
                        .send(validOTP)
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    
                } catch (error) {
                    console.error('Valid OTP test failed:', error);
                    throw error;
                }
            });

            test('should reject invalid OTP formats', async () => {
                try {
                    const invalidOTPs = [
                        { email: 'test@example.com', otp: '123' }, // Too short
                        { email: 'test@example.com', otp: '1234567' }, // Too long
                        { email: 'test@example.com', otp: 'abcdef' }, // Non-numeric
                        { email: 'test@example.com', otp: '' }, // Empty
                        { email: 'test@example.com' }, // Missing OTP
                    ];

                    for (const otpData of invalidOTPs) {
                        const response = await request(app)
                            .post('/test-otp')
                            .send(otpData)
                            .expect(400);

                        expect(response.body).toHaveProperty('success', false);
                    }
                    
                } catch (error) {
                    console.error('Invalid OTP formats test failed:', error);
                    throw error;
                }
            });
        });
    });

    describe('Security Middleware', () => {
        describe('sanitizeInput', () => {
            beforeAll(() => {
                app.post('/test-sanitize', 
                    sanitizeInput, 
                    (req, res) => res.json({ 
                        success: true, 
                        body: req.body 
                    })
                );
            });

            test('should sanitize HTML input', async () => {
                try {
                    const htmlInput = {
                        name: '<script>alert("XSS")</script>John',
                        email: 'test@example.com'
                    };

                    const response = await request(app)
                        .post('/test-sanitize')
                        .send(htmlInput)
                        .expect(200);

                    expect(response.body.body.name).not.toContain('<script>');
                    expect(response.body.body.name).toContain('John');
                    
                } catch (error) {
                    console.error('HTML sanitization test failed:', error);
                    throw error;
                }
            });

            test('should handle normal input without changes', async () => {
                try {
                    const normalInput = {
                        name: 'John Doe',
                        email: 'john.doe@example.com'
                    };

                    const response = await request(app)
                        .post('/test-sanitize')
                        .send(normalInput)
                        .expect(200);

                    expect(response.body.body.name).toBe('John Doe');
                    expect(response.body.body.email).toBe('john.doe@example.com');
                    
                } catch (error) {
                    console.error('Normal input sanitization test failed:', error);
                    throw error;
                }
            });
        });

        describe('logSecurityEvent', () => {
            test('should create security event logger middleware', () => {
                try {
                    const middleware = logSecurityEvent('TEST_EVENT');
                    
                    expect(typeof middleware).toBe('function');
                    expect(middleware.length).toBe(3); // req, res, next
                    
                } catch (error) {
                    console.error('Security event logger test failed:', error);
                    throw error;
                }
            });

            test('should log security events and call next', (done) => {
                try {
                    const middleware = logSecurityEvent('TEST_EVENT');
                    
                    const mockReq = { ip: '127.0.0.1', method: 'POST', path: '/test' };
                    const mockRes = {};
                    const mockNext = () => {
                        // If next is called, the middleware worked correctly
                        done();
                    };

                    middleware(mockReq, mockRes, mockNext);
                    
                } catch (error) {
                    console.error('Security event logging test failed:', error);
                    throw error;
                }
            });
        });
    });

    describe('Authentication Middleware', () => {
        let testUser;
        let testUserId;
        let validToken;
        let expiredToken;
        
        beforeAll(async () => {
            try {
                // Ensure we have a valid database connection
                const { getDatabase } = require('../database/connection');
                const db = getDatabase();
                
                // Create test user
                const hashedPassword = await hashPassword('TestPassword123!');
                const insertUser = db.prepare(`
                    INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                    VALUES (?, ?, ?, ?, 1)
                `);
                
                const result = insertUser.run('Test', 'User', 'middleware-test@example.com', hashedPassword);
                testUserId = result.lastInsertRowid;
                testUser = {
                    userId: Number(testUserId),
                    email: 'middleware-test@example.com'
                };
                
                // Generate valid token
                validToken = generateAccessToken(testUser);
                
                // Create expired token mock by creating a token with very short expiry
                const jwt = require('jsonwebtoken');
                const { JWT_SECRET } = require('../data/env');
                expiredToken = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1ms' });
                await new Promise(resolve => setTimeout(resolve, 10)); // Ensure it's expired
                
            } catch (error) {
                console.error('Auth middleware test setup failed:', error);
                throw error;
            }
        });

        describe('authenticateToken', () => {
            beforeAll(() => {
                app.get('/test-auth-token', 
                    authenticateToken, 
                    (req, res) => res.json({ 
                        success: true, 
                        user: req.user 
                    })
                );
            });

            test('should authenticate valid token successfully', async () => {
                try {
                    const response = await request(app)
                        .get('/test-auth-token')
                        .set('Authorization', `Bearer ${validToken}`)
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    expect(response.body.user).toHaveProperty('userId', testUserId);
                    expect(response.body.user).toHaveProperty('email', 'middleware-test@example.com');
                    
                } catch (error) {
                    console.error('Valid token auth test failed:', error);
                    throw error;
                }
            });

            test('should reject request without authorization header', async () => {
                try {
                    const response = await request(app)
                        .get('/test-auth-token')
                        .expect(401);

                    expect(response.body).toHaveProperty('success', false);
                    expect(response.body).toHaveProperty('message', 'Access token is required');
                    
                } catch (error) {
                    console.error('No auth header test failed:', error);
                    throw error;
                }
            });

            test('should reject request with invalid token format', async () => {
                try {
                    const response = await request(app)
                        .get('/test-auth-token')
                        .set('Authorization', 'InvalidFormat')
                        .expect(401);

                    expect(response.body).toHaveProperty('success', false);
                    expect(response.body).toHaveProperty('message', 'Access token is required');
                    
                } catch (error) {
                    console.error('Invalid token format test failed:', error);
                    throw error;
                }
            });

            test('should reject request with invalid token', async () => {
                try {
                    const response = await request(app)
                        .get('/test-auth-token')
                        .set('Authorization', 'Bearer invalid.token.here')
                        .expect(401);

                    expect(response.body).toHaveProperty('success', false);
                    expect(response.body.message).toMatch(/Invalid access token|Token verification failed/);
                    
                } catch (error) {
                    console.error('Invalid token test failed:', error);
                    throw error;
                }
            });

            test('should reject request with malformed Bearer token', async () => {
                try {
                    const response = await request(app)
                        .get('/test-auth-token')
                        .set('Authorization', 'Bearer ')
                        .expect(401);

                    expect(response.body).toHaveProperty('success', false);
                    expect(response.body).toHaveProperty('message', 'Access token is required');
                    
                } catch (error) {
                    console.error('Malformed Bearer token test failed:', error);
                    throw error;
                }
            });

            test('should reject expired token', async () => {
                try {
                    const response = await request(app)
                        .get('/test-auth-token')
                        .set('Authorization', `Bearer ${expiredToken}`)
                        .expect(401);

                    expect(response.body).toHaveProperty('success', false);
                    expect(response.body.message).toMatch(/expired|Token verification failed/);
                    
                } catch (error) {
                    console.error('Expired token test failed:', error);
                    throw error;
                }
            });

            test('should handle empty Bearer token', async () => {
                try {
                    const response = await request(app)
                        .get('/test-auth-token')
                        .set('Authorization', 'Bearer')
                        .expect(401);

                    expect(response.body).toHaveProperty('success', false);
                    expect(response.body).toHaveProperty('message', 'Access token is required');
                    
                } catch (error) {
                    console.error('Empty Bearer token test failed:', error);
                    throw error;
                }
            });
        });

        describe('verifyUserExists', () => {
            beforeAll(() => {
                app.get('/test-verify-user', 
                    authenticateToken,
                    verifyUserExists, 
                    (req, res) => res.json({ 
                        success: true, 
                        user: req.user 
                    })
                );
            });

            test('should verify existing user successfully', async () => {
                try {
                    const response = await request(app)
                        .get('/test-verify-user')
                        .set('Authorization', `Bearer ${validToken}`)
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    expect(response.body.user).toHaveProperty('userId', testUserId);
                    expect(response.body.user).toHaveProperty('firstName', 'Test');
                    expect(response.body.user).toHaveProperty('lastName', 'User');
                    expect(response.body.user).toHaveProperty('isVerified', true);
                    
                } catch (error) {
                    console.error('Verify existing user test failed:', error);
                    throw error;
                }
            });

            test('should handle request without user context', (done) => {
                try {
                    const testApp = express();
                    testApp.use(express.json());
                    testApp.get('/test-no-user-context', 
                        verifyUserExists, 
                        (req, res) => res.json({ success: true })
                    );

                    request(testApp)
                        .get('/test-no-user-context')
                        .expect(401)
                        .end((err, res) => {
                            if (err) return done(err);
                            
                            expect(res.body).toHaveProperty('success', false);
                            expect(res.body).toHaveProperty('message', 'User authentication required');
                            done();
                        });
                        
                } catch (error) {
                    console.error('No user context test failed:', error);
                    throw error;
                }
            });

            test('should set X-Clear-Auth header when user does not exist in database', async () => {
                try {
                    // Create a token for a user that doesn't exist in the database
                    const nonExistentUser = {
                        userId: 99999, // ID that doesn't exist
                        email: 'nonexistent@example.com'
                    };
                    const tokenForNonExistentUser = generateAccessToken(nonExistentUser);

                    const response = await request(app)
                        .get('/test-verify-user')
                        .set('Authorization', `Bearer ${tokenForNonExistentUser}`)
                        .expect(401);

                    expect(response.body).toHaveProperty('success', false);
                    expect(response.body).toHaveProperty('message', 'User not found or inactive');
                    expect(response.headers).toHaveProperty('x-clear-auth', 'true');
                    
                } catch (error) {
                    console.error('X-Clear-Auth header test failed:', error);
                    throw error;
                }
            });
        });

        describe('requireVerifiedEmail', () => {
            let unverifiedUser;
            let unverifiedUserId;
            let unverifiedToken;

            beforeAll(async () => {
                try {
                    // Create unverified user using existing test database
                    const { getDatabase } = require('../database/connection');
                    const db = getDatabase();
                    const hashedPassword = await hashPassword('TestPassword123!');
                    
                    const insertUser = db.prepare(`
                        INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                        VALUES (?, ?, ?, ?, 0)
                    `);
                    
                    const result = insertUser.run('Unverified', 'User', 'unverified-test@example.com', hashedPassword);
                    unverifiedUserId = result.lastInsertRowid;
                    unverifiedUser = {
                        userId: Number(unverifiedUserId),
                        email: 'unverified-test@example.com'
                    };
                    
                    unverifiedToken = generateAccessToken(unverifiedUser);
                    
                } catch (error) {
                    console.error('Unverified user setup failed:', error);
                    throw error;
                }
            });

            beforeAll(() => {
                app.get('/test-require-verified', 
                    authenticateToken,
                    verifyUserExists,
                    requireVerifiedEmail, 
                    (req, res) => res.json({ 
                        success: true, 
                        user: req.user 
                    })
                );
            });

            test('should allow verified users', async () => {
                try {
                    const response = await request(app)
                        .get('/test-require-verified')
                        .set('Authorization', `Bearer ${validToken}`)
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    expect(response.body.user).toHaveProperty('isVerified', true);
                    
                } catch (error) {
                    console.error('Allow verified users test failed:', error);
                    throw error;
                }
            });

            test('should reject unverified users', async () => {
                try {
                    const response = await request(app)
                        .get('/test-require-verified')
                        .set('Authorization', `Bearer ${unverifiedToken}`)
                        .expect(403);

                    expect(response.body).toHaveProperty('success', false);
                    expect(response.body).toHaveProperty('message', 'Email verification required to access this resource');
                    
                } catch (error) {
                    console.error('Reject unverified users test failed:', error);
                    throw error;
                }
            });

            test('should handle request without user context', (done) => {
                try {
                    const testApp = express();
                    testApp.use(express.json());
                    testApp.get('/test-no-user-verified', 
                        requireVerifiedEmail, 
                        (req, res) => res.json({ success: true })
                    );

                    request(testApp)
                        .get('/test-no-user-verified')
                        .expect(401)
                        .end((err, res) => {
                            if (err) return done(err);
                            
                            expect(res.body).toHaveProperty('success', false);
                            expect(res.body).toHaveProperty('message', 'User authentication required');
                            done();
                        });
                        
                } catch (error) {
                    console.error('No user verified test failed:', error);
                    throw error;
                }
            });
        });

        describe('optionalAuth', () => {
            beforeAll(() => {
                app.get('/test-optional-auth', 
                    optionalAuth, 
                    (req, res) => res.json({ 
                        success: true, 
                        user: req.user 
                    })
                );
            });

            test('should set user context with valid token', async () => {
                try {
                    const response = await request(app)
                        .get('/test-optional-auth')
                        .set('Authorization', `Bearer ${validToken}`)
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    expect(response.body.user).toHaveProperty('userId', testUserId);
                    expect(response.body.user).toHaveProperty('email', 'middleware-test@example.com');
                    
                } catch (error) {
                    console.error('Valid token optional auth test failed:', error);
                    throw error;
                }
            });

            test('should continue without auth when no token provided', async () => {
                try {
                    const response = await request(app)
                        .get('/test-optional-auth')
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    expect(response.body.user).toBe(null);
                    
                } catch (error) {
                    console.error('No token optional auth test failed:', error);
                    throw error;
                }
            });

            test('should continue without auth when invalid token provided', async () => {
                try {
                    const response = await request(app)
                        .get('/test-optional-auth')
                        .set('Authorization', 'Bearer invalid.token.here')
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    expect(response.body.user).toBe(null);
                    
                } catch (error) {
                    console.error('Invalid token optional auth test failed:', error);
                    throw error;
                }
            });

            test('should continue without auth when expired token provided', async () => {
                try {
                    const response = await request(app)
                        .get('/test-optional-auth')
                        .set('Authorization', `Bearer ${expiredToken}`)
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    expect(response.body.user).toBe(null);
                    
                } catch (error) {
                    console.error('Expired token optional auth test failed:', error);
                    throw error;
                }
            });
        });

        describe('authenticate (combined)', () => {
            beforeAll(() => {
                app.get('/test-full-auth', 
                    authenticate, 
                    (req, res) => res.json({ 
                        success: true, 
                        user: req.user 
                    })
                );
            });

            test('should authenticate and verify user successfully', async () => {
                try {
                    const response = await request(app)
                        .get('/test-full-auth')
                        .set('Authorization', `Bearer ${validToken}`)
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    expect(response.body.user).toHaveProperty('userId', testUserId);
                    expect(response.body.user).toHaveProperty('firstName', 'Test');
                    expect(response.body.user).toHaveProperty('lastName', 'User');
                    expect(response.body.user).toHaveProperty('isVerified', true);
                    
                } catch (error) {
                    console.error('Full auth success test failed:', error);
                    throw error;
                }
            });

            test('should reject request without token', async () => {
                try {
                    const response = await request(app)
                        .get('/test-full-auth')
                        .expect(401);

                    expect(response.body).toHaveProperty('success', false);
                    
                } catch (error) {
                    console.error('Full auth no token test failed:', error);
                    throw error;
                }
            });

            test('should reject request with invalid token', async () => {
                try {
                    const response = await request(app)
                        .get('/test-full-auth')
                        .set('Authorization', 'Bearer invalid.token.here')
                        .expect(401);

                    expect(response.body).toHaveProperty('success', false);
                    
                } catch (error) {
                    console.error('Full auth invalid token test failed:', error);
                    throw error;
                }
            });
        });

        describe('authenticateVerified (full with email verification)', () => {
            let unverifiedToken2;
            
            beforeAll(async () => {
                try {
                    // Create another unverified user for this test using existing test database
                    const { getDatabase } = require('../database/connection');
                    const db = getDatabase();
                    const hashedPassword = await hashPassword('TestPassword123!');
                    
                    const insertUser = db.prepare(`
                        INSERT INTO users (first_name, last_name, email, password_hash, is_verified)
                        VALUES (?, ?, ?, ?, 0)
                    `);
                    
                    const result = insertUser.run('Unverified2', 'User2', 'unverified2-test@example.com', hashedPassword);
                    const unverifiedUserId2 = result.lastInsertRowid;
                    const unverifiedUser2 = {
                        userId: Number(unverifiedUserId2),
                        email: 'unverified2-test@example.com'
                    };
                    
                    unverifiedToken2 = generateAccessToken(unverifiedUser2);
                    
                } catch (error) {
                    console.error('Second unverified user setup failed:', error);
                    throw error;
                }
            });

            beforeAll(() => {
                app.get('/test-auth-verified', 
                    authenticateVerified, 
                    (req, res) => res.json({ 
                        success: true, 
                        user: req.user 
                    })
                );
            });

            test('should allow verified user access', async () => {
                try {
                    const response = await request(app)
                        .get('/test-auth-verified')
                        .set('Authorization', `Bearer ${validToken}`)
                        .expect(200);

                    expect(response.body).toHaveProperty('success', true);
                    expect(response.body.user).toHaveProperty('isVerified', true);
                    
                } catch (error) {
                    console.error('Verified user access test failed:', error);
                    throw error;
                }
            });

            test('should reject unverified user', async () => {
                try {
                    const response = await request(app)
                        .get('/test-auth-verified')
                        .set('Authorization', `Bearer ${unverifiedToken2}`)
                        .expect(403);

                    expect(response.body).toHaveProperty('success', false);
                    expect(response.body.message).toMatch(/Email verification required/);
                    
                } catch (error) {
                    console.error('Reject unverified user test failed:', error);
                    throw error;
                }
            });

            test('should reject request without token', async () => {
                try {
                    const response = await request(app)
                        .get('/test-auth-verified')
                        .expect(401);

                    expect(response.body).toHaveProperty('success', false);
                    
                } catch (error) {
                    console.error('Auth verified no token test failed:', error);
                    throw error;
                }
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle validation errors properly', async () => {
            try {
                // This will trigger validation errors
                const response = await request(app)
                    .post('/test-signup')
                    .send({})
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('errors');
                expect(Array.isArray(response.body.errors)).toBe(true);
                
            } catch (error) {
                console.error('Validation error handling test failed:', error);
                throw error;
            }
        });

        test('should handle middleware errors gracefully', (done) => {
            try {
                const errorMiddleware = (req, res, next) => {
                    next(new Error('Test middleware error'));
                };

                const testApp = express();
                testApp.use(express.json());
                testApp.get('/test-error', errorMiddleware, (req, res) => {
                    res.json({ success: true });
                });

                // Add error handler
                testApp.use((err, req, res, next) => {
                    res.status(500).json({
                        success: false,
                        message: 'Middleware error handled'
                    });
                });

                request(testApp)
                    .get('/test-error')
                    .expect(500)
                    .end((err, res) => {
                        if (err) return done(err);
                        
                        expect(res.body).toHaveProperty('success', false);
                        expect(res.body).toHaveProperty('message', 'Middleware error handled');
                        done();
                    });
                    
            } catch (error) {
                console.error('Middleware error handling test failed:', error);
                throw error;
            }
        });
    });

    describe('Edge Cases', () => {
        test('should handle very long input strings', async () => {
            try {
                const longString = 'a'.repeat(10000);
                const longInput = {
                    firstName: longString,
                    lastName: 'Doe',
                    email: 'test@example.com',
                    password: 'SecurePassword123!'
                };

                const response = await request(app)
                    .post('/test-signup')
                    .send(longInput)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                
            } catch (error) {
                console.error('Long input strings test failed:', error);
                throw error;
            }
        });

        test('should handle unicode characters in input', async () => {
            try {
                const unicodeInput = {
                    firstName: '测试',
                    lastName: 'ユーザー',
                    email: 'test@example.com',
                    password: 'SecurePassword123!'
                };

                const response = await request(app)
                    .post('/test-signup')
                    .send(unicodeInput)
                    .expect(400); // Should fail due to name validation

                expect(response.body).toHaveProperty('success', false);
                
            } catch (error) {
                console.error('Unicode characters test failed:', error);
                throw error;
            }
        });

        test('should handle null and undefined values', async () => {
            try {
                const nullInput = {
                    firstName: null,
                    lastName: undefined,
                    email: 'test@example.com',
                    password: 'SecurePassword123!'
                };

                const response = await request(app)
                    .post('/test-signup')
                    .send(nullInput)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                
            } catch (error) {
                console.error('Null and undefined values test failed:', error);
                throw error;
            }
        });
    });
});