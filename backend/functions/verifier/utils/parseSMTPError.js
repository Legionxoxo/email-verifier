const smtpErrors = require('../../../data/errors/smtpErrors');

const blacklist_keywords = [
	'spamhaus',
	'proofpoint',
	'cloudmark',
	'banned',
	'blacklisted',
	'block',
	'block list',
	'poor reputation',
	'junkmail',
	'spam',
	'prohibit',
	'forbid',
	'disallow',
	'score too low',
	'connection rejected',
	'connection refused',
	'dnsbl',
	'dns_rbl',
	'rbl',
	'rtbl',
	'rpbl',
	'snbl',
	'sbrs',
	'senderscore',
	'not allowed',
	'relay access denied', // keep this only if there is a later stage that re attempts -> else remove
];

const invalid_email_keywords = [
	'undeliverable',
	'does not exist',
	"dosn't exist",
	'may not exist',
	'user unknown',
	'user not found',
	'invalid address',
	'invalid-address',
	'recipient invalid',
	'invalid recipient',
	'recipient-invalid',
	'invalid-recipient',
	'recipient rejected',
	'rejected recipient',
	'recipient-rejected',
	'rejected-recipient',
	'address rejected',
	'rejected address',
	'address-rejected',
	'rejected-address',
	'no mailbox',
	'unknown recipient',
	'no such user',
	'address not found',
	'mailbox not found',
	'unknown address',
	'recipient not recognized',
	'unreachable recipient',
	'account does not exist',
	'user unavailable',
	'invalid email address',
	'non-existent user',
	'mailbox unavailable',
	'cannot deliver to',
	'no such recipient',
	'no such address',
	'unrecognized email address',
];

/**
 * @typedef {Object} SMTPErrorAnalysis
 * @property {string} classification - 'permanent'|'temporary'|'unknown'
 * @property {string} errorType - Specific error category
 * @property {boolean} shouldRetry
 * @property {number} confidence - 0-100
 * @property {string} originalMessage
 * @property {string} message
 * @property {string} details
 */

/**
 * Enhanced SMTP error parsing with context awareness
 * @param {string} errString - Raw SMTP response
 * @param {string} currentStage - 'EHLO'|'MAIL_FROM'|'RCPT_TO' (optional)
 * @param {string} emailBeingTested - Current email for context (optional)
 * @returns {SMTPErrorAnalysis|null}
 */
function parseSmtpErrorEnhanced(errString, currentStage = '', emailBeingTested = '') {
	const originalString = errString;
	errString = errString.toLowerCase();

	// Initialize analysis result
	const analysis = {
		classification: 'unknown',
		errorType: 'unknown',
		shouldRetry: false,
		confidence: 0,
		originalMessage: originalString,
		message: '',
		details: errString,
	};

	// Check error string length
	if (errString.length < 3) {
		const basicError = parseBasicError(errString);
		if (basicError) {
			analysis.message = basicError.message;
			analysis.details = basicError.details;
			analysis.confidence = 60;
			analysis.classification = 'unknown';
		}
		return analysis;
	}

	// Get status code
	const status = parseInt(errString.substring(0, 3), 10);
	if (isNaN(status)) {
		const basicError = parseBasicError(errString);
		if (basicError) {
			analysis.message = basicError.message;
			analysis.details = basicError.details;
			analysis.confidence = 50;
		}
		return analysis;
	}

	// Classify by status code range
	if (status >= 500) {
		analysis.classification = 'permanent';
		analysis.shouldRetry = false;
	} else if (status >= 400) {
		analysis.classification = 'temporary';
		analysis.shouldRetry = true;
	} else {
		return null; // Not an error
	}

	// Context-aware parsing based on SMTP stage
	if (currentStage === 'EHLO' || currentStage === 'MAIL_FROM') {
		// Connection/authentication stage errors are typically permanent for this session
		analysis.shouldRetry = false;
		analysis.confidence = 90;
	}

	// Enhanced error classification with confidence scoring
	if (includesAny(errString, ...invalid_email_keywords)) {
		analysis.errorType = 'invalid_recipient';
		analysis.message = smtpErrors.ErrServerUnavailable;
		analysis.classification = 'permanent';
		analysis.shouldRetry = false;
		analysis.confidence = 85;
		return analysis;
	}

	// Status code specific parsing with enhanced logic
	switch (status) {
		case 421:
			analysis.errorType = 'try_again_later';
			analysis.message = smtpErrors.ErrTryAgainLater;
			analysis.classification = 'temporary';
			analysis.shouldRetry = true;
			analysis.confidence = 75;
			break;

		case 450:
			analysis.errorType = 'mailbox_busy';
			analysis.message = smtpErrors.ErrMailboxBusy;
			analysis.classification = 'temporary';
			analysis.shouldRetry = true;
			analysis.confidence = 80;
			break;

		case 451:
			analysis.errorType = 'messaging_limits';
			analysis.message = smtpErrors.ErrExceededMessagingLimits;
			analysis.classification = 'temporary';
			analysis.shouldRetry = true;
			analysis.confidence = 75;
			break;

		case 452:
			if (includesAny(errString, 'full', 'space', 'over quota', 'insufficient')) {
				analysis.errorType = 'full_inbox';
				analysis.message = smtpErrors.ErrFullInbox;
				analysis.classification = 'temporary';
				analysis.shouldRetry = true;
				analysis.confidence = 90;
			} else {
				analysis.errorType = 'too_many_recipients';
				analysis.message = smtpErrors.ErrTooManyRCPT;
				analysis.classification = 'temporary';
				analysis.shouldRetry = true;
				analysis.confidence = 70;
			}
			break;

		case 550:
			if (includesAny(errString, ...blacklist_keywords)) {
				analysis.errorType = 'blacklisted';
				analysis.message = smtpErrors.ErrBlocked;
				analysis.classification = 'permanent';
				analysis.shouldRetry = false;
				analysis.confidence = 95;
			} else {
				analysis.errorType = 'server_unavailable';
				analysis.message = smtpErrors.ErrServerUnavailable;
				analysis.classification = 'permanent';
				analysis.shouldRetry = false;
				analysis.confidence = 80;
			}
			break;

		case 554:
			if (includesAny(errString, ...blacklist_keywords)) {
				analysis.errorType = 'not_allowed';
				analysis.message = smtpErrors.ErrNotAllowed;
				analysis.classification = 'permanent';
				analysis.shouldRetry = false;
				analysis.confidence = 95;
			} else {
				analysis.errorType = 'server_unavailable';
				analysis.message = smtpErrors.ErrServerUnavailable;
				analysis.classification = 'permanent';
				analysis.shouldRetry = false;
				analysis.confidence = 75;
			}
			break;

		default:
			// Fall back to basic error parsing
			const basicError = parseBasicError(errString);
			if (basicError) {
				analysis.message = basicError.message;
				analysis.details = basicError.details;
				analysis.confidence = 60;
			}
			break;
	}

	return analysis;
}

/**
 * Legacy function for backward compatibility
 * @param {string} errString
 */
function parseSMTPError(errString) {
	errString = errString.toLowerCase(); // converting the string to lowercase

	// check the length of the error
	if (errString.length < 3) return parseBasicError(errString);

	// Get the status code for parsing
	const status = parseInt(errString.substring(0, 3), 10); // using base 10

	// -> if there was a problem getting the status code, run a basic parsing
	if (isNaN(status)) return parseBasicError(errString);

	// Error has occurred when status code is > 400
	if (status > 400) {
		if (includesAny(errString, ...invalid_email_keywords)) {
			return newLookupError(smtpErrors.ErrServerUnavailable, errString);
		}

		switch (status) {
			case 421: {
				console.log(`Potentially greylisted with code: 421 and message -> ${errString}`);
				return newLookupError(smtpErrors.ErrTryAgainLater, errString); // can take this as an opportunity to greylist
			}
			case 450: {
				return newLookupError(smtpErrors.ErrMailboxBusy, errString);
			}
			case 451: {
				return newLookupError(smtpErrors.ErrExceededMessagingLimits, errString);
			}
			case 452: {
				if (includesAny(errString, 'full', 'space', 'over quota', 'insufficient')) {
					return newLookupError(smtpErrors.ErrFullInbox, errString);
				}
				return newLookupError(smtpErrors.ErrTooManyRCPT, errString);
			}
			case 503: {
				return newLookupError(smtpErrors.ErrNeedMAILBeforeRCPT, errString);
			}
			case 550: {
				// If The client typically receives a `550 5.1.1` code as a reply to RCPT TO command,
				// In most cases, this is because the recipient address does not exist.
				// Or if you have been blocked by blacklist
				if (includesAny(errString, ...blacklist_keywords)) {
					return newLookupError(smtpErrors.ErrBlocked, errString);
				}
				return newLookupError(smtpErrors.ErrServerUnavailable, errString);
			}
			case 551: {
				return newLookupError(smtpErrors.ErrRCPTHasMoved, errString);
			}
			case 552: {
				return newLookupError(smtpErrors.ErrFullInbox, errString);
			}
			case 553: {
				return newLookupError(smtpErrors.ErrNoRelay, errString);
			}
			case 554: {
				if (includesAny(errString, ...blacklist_keywords)) {
					return newLookupError(smtpErrors.ErrNotAllowed, errString); // potentially blacklisted
				}
				return newLookupError(smtpErrors.ErrServerUnavailable, errString);
			}
			default: {
				return parseBasicError(errString);
			}
		}
	}

	// return null if uncertain
	return null;
}

/**
 * This function parses Basic SMTP errors < 3 length
 * @param {string} errString
 */
function parseBasicError(errString) {
	// return a more understandable error
	if (includesAny(errString, ...blacklist_keywords)) return newLookupError(smtpErrors.ErrBlocked, errString);
	else if (includesAny(errString, 'timeout')) return newLookupError(smtpErrors.ErrTimeout, errString);
	else if (includesAny(errString, 'no such host')) return newLookupError(smtpErrors.ErrNoSuchHost, errString);
	else if (includesAny(errString, 'unavailable')) return newLookupError(smtpErrors.ErrServerUnavailable, errString);
	else return newLookupError(errString, errString);
}

/**
 * This function will check if a given set of strings exist in the first param
 * @param {string} string
 * @param  {...string} substrings
 * @returns {boolean}
 */
function includesAny(string, ...substrings) {
	// convert both to lower case
	string = string.toLowerCase();
	substrings = substrings.map(substring => substring.toLowerCase());

	// check includes now
	return substrings.some(substring => string.includes(substring));
}

/**
 * This function will create a new Lookup Erro obj
 * @param {string} message
 * @param {string} details
 */
function newLookupError(message, details) {
	console.error(`${message} : ${details}`); // log the error
	return {
		message: message,
		details: details,
	};
}

module.exports = { parseSMTPError, parseSmtpErrorEnhanced };
