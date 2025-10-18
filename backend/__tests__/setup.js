/**
 * Jest Test Setup Configuration
 * Global setup for all test suites
 */

require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.DB_PATH = '.sql/user_auth_test.db';
process.env.BCRYPT_ROUNDS = '4'; // Faster for testing
process.env.OTP_EXPIRY_MINUTES = '5';
process.env.MAX_OTP_ATTEMPTS = '3';
process.env.CORS_ORIGIN = 'http://localhost:3000';


// Mock console methods for cleaner test output
const originalConsole = console;
global.console = {
    ...originalConsole,
    // Keep error and warn for debugging
    error: originalConsole.error,
    warn: originalConsole.warn,
    // Silent info, log, debug during tests
    info: () => {},
    log: () => {},
    debug: () => {}
};


// Global test utilities
global.testUtils = {
    // Test user data
    validUser: {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User'
    },
    
    invalidUser: {
        email: 'invalid-email',
        password: '123',
        name: ''
    },
    
    // Helper to create unique test email
    generateTestEmail: () => `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
    
    // Helper to wait for async operations
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};


// Improved cleanup strategy - only close global instance, let individual tests handle their own cleanup
afterEach(async () => {
    try {
        // Skip cleanup if explicitly disabled (for full integration tests)
        if (global.skipDbCleanup) {
            return;
        }

        // Only close the global database instance without trying to access the file
        if (global.databaseInstance) {
            try {
                // Check if database is still open before attempting to close
                if (global.databaseInstance.open) {
                    global.databaseInstance.close();
                }
                global.databaseInstance = null;
            } catch (error) {
                // Ignore connection close errors - connection might already be closed
                global.databaseInstance = null;
            }
        }
        
        // Let individual test suites handle their own database file cleanup
        // This prevents file locking issues from concurrent database access
        
    } catch (error) {
        // Ignore cleanup errors
    }
});


// Global error handlers for tests
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});


console.log('Jest test setup completed successfully');

// Add a dummy test to prevent Jest from complaining about empty test suites
describe('Test Setup', () => {
    test('should complete setup successfully', () => {
        expect(true).toBe(true);
    });
});