/**
 * Express.js type extensions
 * Adds custom properties to Express Request interface
 */

declare namespace Express {
    interface Request {
        user?: {
            id: number;
            userId: number;
            email: string;
            firstName?: string;
            lastName?: string;
            isVerified?: boolean;
            createdAt?: string;
        };
    }
}

/**
 * Database result types
 */
interface DatabaseCountResult {
    total: number;
}

interface DatabaseUser {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    password_hash: string;
    is_verified: number;
    created_at: string;
    updated_at: string;
}

interface ScriptCountResult {
    count: number;
}

