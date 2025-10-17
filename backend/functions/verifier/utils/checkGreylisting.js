/**
 * @typedef {Object} GreylistingAnalysis
 * @property {boolean} isGreylisted
 * @property {string} reason
 * @property {number} confidence - 0-100 confidence score
 * @property {boolean} shouldRetry
 */

// High confidence greylisting indicators
const highConfidenceKeywords = [
	'greylist',
	'graylist', 
	'silverlisting'
];

// Medium confidence greylisting indicators
const mediumConfidenceKeywords = [
	'temporarily',
	'temporary',
	'deferred',
	'try again',
	'retry later'
];

// Low confidence greylisting indicators
const lowConfidenceKeywords = [
	'delay',
	'retry',
	'service refuse',
	'relay access denied'
];

// Anti-patterns (NOT greylisting)
const antiPatterns = [
	'storage',
	'full',
	'quota',
	'space',
	'disk',
	'mailbox full',
	'over quota',
	'insufficient storage'
];

// Server-specific patterns for enhanced detection
const serverPatterns = {
	'gmail': /temporarily_rejected|rate.?limit|receiving mail at a rate|rate.*prevent/i,
	'google': /temporarily_rejected|rate.?limit|receiving mail at a rate|rate.*prevent/i,
	'outlook': /server.?busy|throttl/i,
	'yahoo': /rate.?limit|defer/i,
	'microsoft': /throttl|busy/i
};

/**
 * Enhanced greylisting detection with confidence scoring
 * @param {string} dataStr - SMTP response
 * @param {string} smtpHost - Server hostname for pattern analysis (optional)
 * @returns {GreylistingAnalysis}
 */
function analyzeGreylisting(dataStr, smtpHost = '') {
	const lowerStr = dataStr.toLowerCase();
	const status = parseInt(dataStr.substring(0, 3), 10);
	
	// Initialize analysis result
	const analysis = {
		isGreylisted: false,
		reason: '',
		confidence: 0,
		shouldRetry: false
	};
	
	// Must be in 4xx range for greylisting
	if (status <= 400 || status >= 500) {
		return analysis;
	}
	
	// Check for anti-patterns first (NOT greylisting)
	for (const antiPattern of antiPatterns) {
		if (lowerStr.includes(antiPattern)) {
			return analysis; // Definitely not greylisting
		}
	}
	
	// Check server-specific patterns
	if (smtpHost) {
		const hostLower = smtpHost.toLowerCase();
		for (const [server, pattern] of Object.entries(serverPatterns)) {
			if (hostLower.includes(server) && pattern.test(dataStr)) {
				analysis.isGreylisted = true;
				analysis.confidence = 85;
				analysis.reason = `Server-specific pattern for ${server}`;
				analysis.shouldRetry = true;
				return analysis;
			}
		}
	}
	
	// Check high confidence keywords
	for (const keyword of highConfidenceKeywords) {
		if (lowerStr.includes(keyword)) {
			analysis.isGreylisted = true;
			analysis.confidence = 95;
			analysis.reason = `High confidence keyword: ${keyword}`;
			analysis.shouldRetry = true;
			return analysis;
		}
	}
	
	// Check medium confidence keywords with status code validation
	for (const keyword of mediumConfidenceKeywords) {
		if (lowerStr.includes(keyword)) {
			if (status === 421 || status === 450 || status === 451) {
				analysis.isGreylisted = true;
				analysis.confidence = 75;
				analysis.reason = `Medium confidence keyword with appropriate status: ${keyword}`;
				analysis.shouldRetry = true;
			} else {
				analysis.confidence = 40;
				analysis.reason = `Medium confidence keyword but uncertain status: ${keyword}`;
			}
			return analysis;
		}
	}
	
	// Check low confidence keywords with strict status code validation
	for (const keyword of lowConfidenceKeywords) {
		if (lowerStr.includes(keyword)) {
			if (status === 421 || status === 450 || status === 451) {
				analysis.isGreylisted = true;
				analysis.confidence = 50;
				analysis.reason = `Low confidence keyword with appropriate status: ${keyword}`;
				analysis.shouldRetry = true;
			} else {
				analysis.confidence = 20;
				analysis.reason = `Low confidence keyword, uncertain: ${keyword}`;
			}
			return analysis;
		}
	}
	
	return analysis;
}

/** 
 * Legacy function for backward compatibility
 * @param {string} dataStr
 * @returns {boolean}
 */
function checkGreylisting(dataStr) {
	const analysis = analyzeGreylisting(dataStr);
	return analysis.isGreylisted && analysis.confidence >= 50;
}

module.exports = { checkGreylisting, analyzeGreylisting };
