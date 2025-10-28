/**
 * Security middleware for headers and CORS
 * Minimal security configuration for dev environment
 */

const helmet = require('helmet');
const cors = require('cors');

// Import environment variables
const { CORS_ORIGIN } = require('../../data/env');


// Security headers configuration

/**
 * Configure helmet for security headers
 */
const helmetConfig = /** @type {import('express').RequestHandler} */ (
	/** @type {any} */ (helmet)({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				scriptSrc: ["'self'"],
				imgSrc: ["'self'", 'data:', 'https:'],
				connectSrc: ["'self'"],
				fontSrc: ["'self'"],
				objectSrc: ["'none'"],
				mediaSrc: ["'self'"],
				frameSrc: ["'none'"],
			},
		},
		crossOriginEmbedderPolicy: false,
	})
);


// CORS configuration

/**
 * Configure CORS for cross-origin requests
 */
const corsConfig = cors({
	origin: function (origin, callback) {
		// Allow requests with no origin (same-origin, mobile apps, Postman, etc.)
		if (!origin) return callback(null, true);

		// In production, replace with your actual frontend domains
		const allowedOrigins = [
			'http://localhost:3000',
			'http://localhost:5000',
			'http://localhost:5173',
			CORS_ORIGIN,
		].filter(Boolean); // Remove falsy values

		if (allowedOrigins.includes(origin)) {
			callback(null, true);
		} else {
			callback(new Error('Not allowed by CORS'));
		}
	},
	credentials: true,
	optionsSuccessStatus: 200,
	allowedHeaders: ['Content-Type', 'Authorization'],
	exposedHeaders: ['Content-Type'],
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
});


// Export middleware and configurations
module.exports = {
	// Security headers and CORS
	helmetConfig,
	corsConfig,
};
