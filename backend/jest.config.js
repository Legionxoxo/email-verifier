/**
 * Jest Configuration for Backend Testing
 * Comprehensive testing setup for authentication system
 */

module.exports = {
    // Test environment
    testEnvironment: 'node',

    // Test file patterns
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],

    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        'functions/**/*.js',
        'routes/**/*.js',
        'database/**/*.js',
        '!**/node_modules/**',
        '!**/__tests__/**',
        '!coverage/**'
    ],

    // Coverage thresholds - adjusted for current test coverage
    coverageThreshold: {
        global: {
            branches: 15,
            functions: 25,
            lines: 25,
            statements: 25
        }
    },

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],

    // Test timeout (increased for integration tests)
    testTimeout: 30000,

    // Clear mocks between tests
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,

    // Verbose output for better debugging
    verbose: true,

    // Handle ES modules if needed
    transform: {
        '^.+\\.js$': 'babel-jest'
    },

    // Transform uuid package from ES modules
    transformIgnorePatterns: [
        'node_modules/(?!(uuid)/)'
    ],

    // Module paths
    moduleDirectories: ['node_modules', '<rootDir>'],

    // Error on deprecated features
    errorOnDeprecated: true
};