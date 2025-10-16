/**
 * Unit Tests for Razorpay Business Logic Functions
 * Tests only our custom business logic, not third-party Razorpay API calls
 * 
 * @fileoverview Tests for proration calculation, refund processing, and signature verification
 */

const crypto = require('crypto');
const {
    calculateProratedAmount,
    processRefundToCredits,
    handleFailedPayments,
    verifySubscriptionPaymentSignature
} = require('../functions/utils/razorpay');


describe('Razorpay Business Logic Tests', () => {
    let mockDb;

    beforeEach(() => {
        // Setup mock database
        mockDb = {
            prepare: jest.fn(),
            transaction: jest.fn()
        };
    });


    describe('calculateProratedAmount', () => {
        test('should calculate proration correctly for upgrade', () => {
            try {
                const result = calculateProratedAmount({
                    currentPlanPrice: 99900, // ₹999
                    newPlanPrice: 199900,    // ₹1999
                    daysRemaining: 15,
                    totalDays: 30
                });
                
                // Expect ₹500 for 15 days out of 30 at ₹1999/month rate
                const expectedAmount = Math.round(((199900 - 99900) / 30) * 15);
                expect(result).toEqual(expect.objectContaining({
                    proratedAmount: expectedAmount,
                    isUpgrade: true,
                    isDowngrade: false,
                    requiresPayment: true
                }));
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should calculate proration correctly for downgrade', () => {
            try {
                const result = calculateProratedAmount({
                    currentPlanPrice: 199900, // ₹1999
                    newPlanPrice: 99900,     // ₹999
                    daysRemaining: 20,
                    totalDays: 30
                });
                
                // Expect credit for downgrade
                const expectedAmount = Math.round(((99900 - 199900) / 30) * 20);
                expect(result).toEqual(expect.objectContaining({
                    proratedAmount: expectedAmount,
                    isUpgrade: false,
                    isDowngrade: true,
                    requiresPayment: false,
                    creditAmount: Math.abs(expectedAmount)
                }));
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should handle zero days remaining', () => {
            try {
                const result = calculateProratedAmount({
                    currentPlanPrice: 99900,
                    newPlanPrice: 199900,
                    daysRemaining: 0,
                    totalDays: 30
                });
                
                expect(result).toEqual(expect.objectContaining({
                    proratedAmount: 0,
                    isUpgrade: true,
                    isDowngrade: false,
                    requiresPayment: false
                }));
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should handle same plan prices', () => {
            try {
                const result = calculateProratedAmount({
                    currentPlanPrice: 99900,
                    newPlanPrice: 99900,
                    daysRemaining: 15,
                    totalDays: 30
                });
                
                expect(result).toEqual(expect.objectContaining({
                    proratedAmount: 0,
                    isUpgrade: false,
                    isDowngrade: false,
                    requiresPayment: false,
                    priceDifference: 0
                }));
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should throw error for non-numeric plan prices', () => {
            try {
                expect(() => calculateProratedAmount({
                    currentPlanPrice: 'invalid',
                    newPlanPrice: 199900,
                    daysRemaining: 15,
                    totalDays: 30
                })).toThrow('Plan prices must be numbers');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should throw error for non-numeric days', () => {
            try {
                expect(() => calculateProratedAmount({
                    currentPlanPrice: 99900,
                    newPlanPrice: 199900,
                    daysRemaining: 'invalid',
                    totalDays: 30
                })).toThrow('Days must be numbers');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should handle flexible days configuration', () => {
            try {
                // Test case where days remaining exceeds standard month (real-world scenario)
                const result = calculateProratedAmount({
                    currentPlanPrice: 99900,
                    newPlanPrice: 199900,
                    daysRemaining: 32, // More than 30 days (billing cycle overlap)
                    totalDays: 30
                });
                
                // Should still calculate correctly
                const expectedAmount = Math.round(((199900 - 99900) / 30) * 32);
                expect(result).toEqual(expect.objectContaining({
                    proratedAmount: expectedAmount,
                    isUpgrade: true,
                    isDowngrade: false,
                    requiresPayment: true
                }));
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });
    });


    describe('processRefundToCredits', () => {
        beforeEach(() => {
            // Reset mock database for each test
            mockDb.prepare.mockClear();
            mockDb.transaction.mockClear();
        });

        test('should process refund to credits successfully', () => {
            try {
                const mockInsert = { 
                    run: jest.fn().mockReturnValue({ lastInsertRowid: 12345 })
                };
                mockDb.prepare.mockReturnValue(mockInsert);
                
                const result = processRefundToCredits({
                    userId: 123,
                    subscriptionId: 456,
                    creditAmount: 50000,
                    reason: 'Subscription downgrade refund'
                }, mockDb);

                expect(mockDb.prepare).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO account_credits')
                );
                expect(mockInsert.run).toHaveBeenCalledWith(
                    123, 456, 50000, 'credit', 'Subscription downgrade refund', expect.any(String)
                );
                expect(result).toEqual({
                    success: true,
                    creditAmount: 50000,
                    transactionId: 12345
                });
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should throw error when userId is missing', () => {
            try {
                expect(() => processRefundToCredits({
                    subscriptionId: 456,
                    creditAmount: 50000,
                    reason: 'Test refund'
                }, mockDb)).toThrow('User ID is required');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should throw error when subscriptionId is missing', () => {
            try {
                expect(() => processRefundToCredits({
                    userId: 123,
                    creditAmount: 50000,
                    reason: 'Test refund'
                }, mockDb)).toThrow('Subscription ID is required');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should throw error when creditAmount is missing', () => {
            try {
                expect(() => processRefundToCredits({
                    userId: 123,
                    subscriptionId: 456,
                    reason: 'Test refund'
                }, mockDb)).toThrow('Credit amount is required');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should throw error when reason is missing', () => {
            try {
                expect(() => processRefundToCredits({
                    userId: 123,
                    subscriptionId: 456,
                    creditAmount: 50000
                }, mockDb)).toThrow('Reason is required');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should throw error when creditAmount is zero or negative', () => {
            try {
                expect(() => processRefundToCredits({
                    userId: 123,
                    subscriptionId: 456,
                    creditAmount: 0,
                    reason: 'Test refund'
                }, mockDb)).toThrow('Credit amount must be positive');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should handle database insertion error', () => {
            try {
                const mockInsert = { 
                    run: jest.fn().mockImplementation(() => {
                        throw new Error('Database insertion failed');
                    })
                };
                mockDb.prepare.mockReturnValue(mockInsert);

                expect(() => processRefundToCredits({
                    userId: 123,
                    subscriptionId: 456,
                    creditAmount: 50000,
                    reason: 'Test refund'
                }, mockDb)).toThrow('Database insertion failed');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });
    });


    describe('handleFailedPayments', () => {
        beforeEach(() => {
            // Reset mock database for each test
            mockDb.prepare.mockClear();
        });

        test('should handle failed payment with retry allowed', () => {
            try {
                const mockGet = { 
                    get: jest.fn().mockReturnValue({ 
                        failed_payment_count: 1, 
                        status: 'active',
                        user_id: 1,
                        total_amount: 999
                    })
                };
                const mockUpdate = { 
                    run: jest.fn().mockReturnValue({ changes: 1 })
                };
                const mockInsert = { 
                    run: jest.fn().mockReturnValue({ lastInsertRowid: 123 })
                };
                
                mockDb.prepare.mockReturnValueOnce(mockGet);
                mockDb.prepare.mockReturnValueOnce(mockUpdate);
                mockDb.prepare.mockReturnValueOnce(mockInsert);

                const result = handleFailedPayments({
                    paymentId: 'pay_123',
                    orderId: 'order_456',
                    subscriptionId: 'sub_789',
                    errorCode: 'CARD_DECLINED',
                    errorDescription: 'Insufficient funds'
                }, mockDb);

                expect(result).toEqual({
                    action: 'retry_allowed',
                    failureCount: 2,
                    maxFailures: 3,
                    retryAfter: expect.any(Date)
                });
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should handle failed payment with max failures reached', () => {
            try {
                const mockGet = { 
                    get: jest.fn().mockReturnValue({ 
                        failed_payment_count: 3, 
                        status: 'active',
                        user_id: 1,
                        total_amount: 999
                    })
                };
                const mockUpdate = { 
                    run: jest.fn().mockReturnValue({ changes: 1 })
                };
                const markCancelled = { 
                    run: jest.fn().mockReturnValue({ changes: 1 })
                };
                const mockInsert = { 
                    run: jest.fn().mockReturnValue({ lastInsertRowid: 123 })
                };
                
                mockDb.prepare.mockReturnValueOnce(mockGet);
                mockDb.prepare.mockReturnValueOnce(mockUpdate);
                mockDb.prepare.mockReturnValueOnce(markCancelled);
                mockDb.prepare.mockReturnValueOnce(mockInsert);

                const result = handleFailedPayments({
                    paymentId: 'pay_123',
                    orderId: 'order_456',
                    subscriptionId: 'sub_789',
                    errorCode: 'CARD_DECLINED',
                    errorDescription: 'Insufficient funds'
                }, mockDb);

                expect(result).toEqual({
                    action: 'subscription_cancelled',
                    failureCount: 4,
                    maxFailures: 3,
                    reason: 'Maximum payment failures reached'
                });
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should throw error when paymentId is missing', () => {
            try {
                expect(() => handleFailedPayments({
                    orderId: 'order_456',
                    subscriptionId: 'sub_789'
                }, mockDb)).toThrow('Payment ID is required');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should throw error when orderId is missing', () => {
            try {
                expect(() => handleFailedPayments({
                    paymentId: 'pay_123',
                    subscriptionId: 'sub_789'
                }, mockDb)).toThrow('Order ID is required');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should throw error when subscriptionId is missing', () => {
            try {
                expect(() => handleFailedPayments({
                    paymentId: 'pay_123',
                    orderId: 'order_456'
                }, mockDb)).toThrow('Subscription ID is required');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should throw error when subscription is not found', () => {
            try {
                const mockGet = { 
                    get: jest.fn().mockReturnValue(null)
                };
                mockDb.prepare.mockReturnValue(mockGet);

                expect(() => handleFailedPayments({
                    paymentId: 'pay_123',
                    orderId: 'order_456',
                    subscriptionId: 'sub_789'
                }, mockDb)).toThrow('Subscription not found');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should handle database update error', () => {
            try {
                const mockGet = { 
                    get: jest.fn().mockReturnValue({ 
                        failed_payment_count: 1, 
                        status: 'active',
                        user_id: 1,
                        total_amount: 999
                    })
                };
                const mockUpdate = { 
                    run: jest.fn().mockImplementation(() => {
                        throw new Error('Database update failed');
                    })
                };
                
                mockDb.prepare.mockReturnValueOnce(mockGet);
                mockDb.prepare.mockReturnValueOnce(mockUpdate);

                expect(() => handleFailedPayments({
                    paymentId: 'pay_123',
                    orderId: 'order_456',
                    subscriptionId: 'sub_789'
                }, mockDb)).toThrow('Database update failed');
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });
    });


    describe('verifySubscriptionPaymentSignature', () => {
        test('should verify valid subscription payment signature', () => {
            try {
                // Create test data
                const testData = {
                    razorpay_payment_id: 'pay_test123',
                    razorpay_subscription_id: 'sub_test456',
                    razorpay_signature: ''
                };

                // Generate valid signature
                const keySecret = 'test_webhook_secret';
                const payload = testData.razorpay_payment_id + '|' + testData.razorpay_subscription_id;
                const expectedSignature = crypto
                    .createHmac('sha256', keySecret)
                    .update(payload)
                    .digest('hex');
                
                testData.razorpay_signature = expectedSignature;

                // Test verification
                const result = verifySubscriptionPaymentSignature({
                    ...testData,
                    webhook_secret: keySecret
                });

                expect(result).toBe(true);
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should reject invalid subscription payment signature', () => {
            try {
                const testData = {
                    razorpay_payment_id: 'pay_test123',
                    razorpay_subscription_id: 'sub_test456',
                    razorpay_signature: 'invalid_signature',
                    webhook_secret: 'test_webhook_secret'
                };

                const result = verifySubscriptionPaymentSignature(testData);
                expect(result).toBe(false);
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should validate required subscription payment data', () => {
            try {
                // Save original env
                const originalEnv = process.env.RAZORPAY_KEY_SECRET;
                
                // Missing payment ID
                expect(() => verifySubscriptionPaymentSignature({
                    razorpay_subscription_id: 'sub_test456',
                    razorpay_signature: 'signature',
                    webhook_secret: 'secret'
                })).toThrow('Payment ID is required');

                // Missing subscription ID
                expect(() => verifySubscriptionPaymentSignature({
                    razorpay_payment_id: 'pay_test123',
                    razorpay_signature: 'signature',
                    webhook_secret: 'secret'
                })).toThrow('Subscription ID is required');

                // Missing signature
                expect(() => verifySubscriptionPaymentSignature({
                    razorpay_payment_id: 'pay_test123',
                    razorpay_subscription_id: 'sub_test456',
                    webhook_secret: 'secret'
                })).toThrow('Signature is required');

                // Missing webhook secret - clear env var temporarily
                delete process.env.RAZORPAY_KEY_SECRET;
                expect(() => verifySubscriptionPaymentSignature({
                    razorpay_payment_id: 'pay_test123',
                    razorpay_subscription_id: 'sub_test456',
                    razorpay_signature: 'signature'
                })).toThrow('Webhook secret is required');
                
                // Restore original env
                if (originalEnv) {
                    process.env.RAZORPAY_KEY_SECRET = originalEnv;
                }
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });
    });


    describe('Error Handling and Edge Cases', () => {
        test('should handle non-Error exceptions gracefully', () => {
            try {
                // Test that functions can handle non-Error exceptions
                expect(() => calculateProratedAmount({
                    currentPlanPrice: null,
                    newPlanPrice: undefined,
                    daysRemaining: 15,
                    totalDays: 30
                })).toThrow();
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should handle null and undefined values', () => {
            try {
                expect(() => processRefundToCredits(null, mockDb)).toThrow();
                expect(() => handleFailedPayments(undefined, mockDb)).toThrow();
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should handle empty objects', () => {
            try {
                expect(() => calculateProratedAmount({})).toThrow();
                expect(() => processRefundToCredits({}, mockDb)).toThrow();
                expect(() => handleFailedPayments({}, mockDb)).toThrow();
                expect(() => verifySubscriptionPaymentSignature({})).toThrow();
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });
    });


    describe('Integration and Performance Tests', () => {
        test('should handle multiple simultaneous operations', () => {
            try {
                // Test that calculation functions are stateless and thread-safe
                const results = [];
                for (let i = 0; i < 10; i++) {
                    results.push(calculateProratedAmount({
                        currentPlanPrice: 99900,
                        newPlanPrice: 199900,
                        daysRemaining: i + 1,
                        totalDays: 30
                    }));
                }
                
                // All results should be different and correct
                for (let i = 0; i < 10; i++) {
                    const expected = Math.round(((199900 - 99900) / 30) * (i + 1));
                    expect(results[i]).toEqual(expect.objectContaining({
                        proratedAmount: expected,
                        isUpgrade: true,
                        isDowngrade: false,
                        requiresPayment: true
                    }));
                }
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should handle large proration calculations', () => {
            try {
                const result = calculateProratedAmount({
                    currentPlanPrice: 99999900, // ₹999,999
                    newPlanPrice: 199999900,    // ₹1,999,999
                    daysRemaining: 365,
                    totalDays: 365
                });
                
                const expectedAmount = Math.round(((199999900 - 99999900) / 365) * 365);
                expect(result).toEqual(expect.objectContaining({
                    proratedAmount: expectedAmount,
                    isUpgrade: true,
                    isDowngrade: false,
                    requiresPayment: true
                }));
                expect(typeof result.proratedAmount).toBe('number');
                expect(result.proratedAmount).toBeGreaterThan(0);
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });

        test('should maintain precision in calculations', () => {
            try {
                const result = calculateProratedAmount({
                    currentPlanPrice: 33333, // Odd number that creates decimal
                    newPlanPrice: 66666,
                    daysRemaining: 7,
                    totalDays: 30
                });
                
                // Should be rounded to integer
                const expectedAmount = Math.round(((66666 - 33333) / 30) * 7);
                expect(result).toEqual(expect.objectContaining({
                    proratedAmount: expectedAmount,
                    isUpgrade: true,
                    isDowngrade: false,
                    requiresPayment: true
                }));
                expect(Number.isInteger(result.proratedAmount)).toBe(true);
            } catch (error) {
                throw error;
            } finally {
                // Cleanup code
            }
        });
    });
});