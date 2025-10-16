/**
 * Axios utility functions with proper error handling
 * Provides safe HTTP request functions that don't crash on non-200 responses
 */

const axios = require('axios');


/**
 * Default axios configuration
 */
const defaultConfig = {
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
};


/**
 * Sleep utility function
 * @param {number} ms - Number of milliseconds to sleep
 * @returns {Promise<void>} Promise that resolves after specified time
 */
function sleep(ms) {
    try {
        if (typeof ms !== 'number' || ms < 0) {
            throw new Error('Sleep duration must be a positive number');
        }
        
        return new Promise(resolve => setTimeout(resolve, ms));
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Sleep function error:', errorMessage);
        throw error;
    } finally {
        console.debug(`Sleep function called with ${ms}ms`);
    }
}


/**
 * Safe HTTP GET request that handles errors gracefully
 * @param {string} url - Request URL
 * @param {Object} [config={}] - Axios configuration options
 * @returns {Promise<Object>} Promise resolving to response data or error information
 */
async function axiosGet(url, config = {}) {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }
        
        const requestConfig = { ...defaultConfig, ...config };
        
        const response = await /** @type {any} */ (axios).get(url, requestConfig);
        
        return {
            success: true,
            data: response.data,
            status: response.status,
            headers: response.headers
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`HTTP GET error for ${url}:`, errorMessage);
        
        // Handle axios errors specifically
        if (error.response) {
            // Server responded with error status
            return {
                success: false,
                error: errorMessage,
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            };
        } else if (error.request) {
            // Request was made but no response received
            return {
                success: false,
                error: 'No response received from server',
                status: 0,
                data: null
            };
        } else {
            // Something else went wrong
            return {
                success: false,
                error: errorMessage,
                status: 0,
                data: null
            };
        }
        
    } finally {
        console.debug(`HTTP GET request completed for ${url}`);
    }
}


/**
 * Safe HTTP POST request that handles errors gracefully
 * @param {string} url - Request URL
 * @param {Object} [data={}] - Request body data
 * @param {Object} [config={}] - Axios configuration options
 * @returns {Promise<Object>} Promise resolving to response data or error information
 */
async function axiosPost(url, data = {}, config = {}) {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }
        
        const requestConfig = { ...defaultConfig, ...config };
        
        const response = await /** @type {any} */ (axios).post(url, data, requestConfig);
        
        return {
            success: true,
            data: response.data,
            status: response.status,
            headers: response.headers
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`HTTP POST error for ${url}:`, errorMessage);
        
        // Handle axios errors specifically
        if (error.response) {
            // Server responded with error status
            return {
                success: false,
                error: errorMessage,
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            };
        } else if (error.request) {
            // Request was made but no response received
            return {
                success: false,
                error: 'No response received from server',
                status: 0,
                data: null
            };
        } else {
            // Something else went wrong
            return {
                success: false,
                error: errorMessage,
                status: 0,
                data: null
            };
        }
        
    } finally {
        console.debug(`HTTP POST request completed for ${url}`);
    }
}


/**
 * Safe HTTP PUT request that handles errors gracefully
 * @param {string} url - Request URL
 * @param {Object} [data={}] - Request body data
 * @param {Object} [config={}] - Axios configuration options
 * @returns {Promise<Object>} Promise resolving to response data or error information
 */
async function axiosPut(url, data = {}, config = {}) {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }
        
        const requestConfig = { ...defaultConfig, ...config };
        
        const response = await /** @type {any} */ (axios).put(url, data, requestConfig);
        
        return {
            success: true,
            data: response.data,
            status: response.status,
            headers: response.headers
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`HTTP PUT error for ${url}:`, errorMessage);
        
        // Handle axios errors specifically
        if (error.response) {
            // Server responded with error status
            return {
                success: false,
                error: errorMessage,
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            };
        } else if (error.request) {
            // Request was made but no response received
            return {
                success: false,
                error: 'No response received from server',
                status: 0,
                data: null
            };
        } else {
            // Something else went wrong
            return {
                success: false,
                error: errorMessage,
                status: 0,
                data: null
            };
        }
        
    } finally {
        console.debug(`HTTP PUT request completed for ${url}`);
    }
}


/**
 * Safe HTTP DELETE request that handles errors gracefully
 * @param {string} url - Request URL
 * @param {Object} [config={}] - Axios configuration options
 * @returns {Promise<Object>} Promise resolving to response data or error information
 */
async function axiosDelete(url, config = {}) {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }
        
        const requestConfig = { ...defaultConfig, ...config };
        
        const response = await /** @type {any} */ (axios).delete(url, requestConfig);
        
        return {
            success: true,
            data: response.data,
            status: response.status,
            headers: response.headers
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`HTTP DELETE error for ${url}:`, errorMessage);
        
        // Handle axios errors specifically  
        if (error.response) {
            // Server responded with error status
            return {
                success: false,
                error: errorMessage,
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            };
        } else if (error.request) {
            // Request was made but no response received
            return {
                success: false,
                error: 'No response received from server',
                status: 0,
                data: null
            };
        } else {
            // Something else went wrong
            return {
                success: false,
                error: errorMessage,
                status: 0,
                data: null
            };
        }
        
    } finally {
        console.debug(`HTTP DELETE request completed for ${url}`);
    }
}


// Export functions
module.exports = {
    axiosGet,
    axiosPost,
    axiosPut,
    axiosDelete,
    sleep
};