/**
 * @typedef VerificationObj
 * @property {string} email
 * @property {"yes" | "no" | "unknown"} reachable
 * @property {{username: string, domain: string, valid: boolean}} syntax
 * @property {{host_exists: boolean, full_inbox: boolean, catch_all: boolean, deliverable: boolean, disabled: boolean}} smtp
 * @property {any} gravatar
 * @property {string} suggestion
 * @property {boolean} disposable
 * @property {boolean} role_account
 * @property {boolean} free
 * @property {boolean} has_mx_records
 * @property {{Host: string, Pref: number}[]} mx,
 * @property {boolean} error
 * @property {string} error_msg
 */

/**
 * @typedef QuickVerificationResult
 * @property {string} email
 * @property {{username: string, domain: string, valid: boolean}} syntax
 * @property {boolean} role_account
 * @property {boolean} free
 * @property {boolean} disposable
 * @property {{Host: string, Pref: number}[]} mx
 * @property {boolean} has_mx_records
 */
