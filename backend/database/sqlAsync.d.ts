/**
 * Type declarations for sqlAsync module
 */

import { Database } from 'sqlite3';

/**
 * SQLAsync class that provides async versions of SQLite operations
 */
declare class SQLAsync {
    /**
     * Execute a SQL query (INSERT, UPDATE, DELETE, etc.)
     * @param query - SQL query string
     * @param params - Optional query parameters
     * @returns Promise that resolves when query completes
     */
    runAsync(query: string, params?: any[]): Promise<Database>;

    /**
     * Retrieve all rows matching the query
     * @param query - SQL query string
     * @param params - Optional query parameters
     * @returns Promise that resolves to array of rows
     */
    allAsync(query: string, params?: any[]): Promise<any[]>;

    /**
     * Retrieve a single row matching the query
     * @param query - SQL query string
     * @param params - Optional query parameters
     * @returns Promise that resolves to a single row or undefined
     */
    getAsync(query: string, params?: any[]): Promise<any>;
}

declare const sqlAsync: SQLAsync;

export = sqlAsync;
