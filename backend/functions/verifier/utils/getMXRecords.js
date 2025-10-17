const winston = require('winston');
const { loggerTypes } = require('../../logging/logger');
const dnsPromises = require('dns/promises');
const emailSplit = require('../../utils/emailSplit');

/**
 * This function will get the MX records for a provided email
 * @param {string} email
 */
async function getMXRecords(email) {
	const logger = winston.loggers.get(loggerTypes.verifier);

	/** @type {import("dns").MxRecord[]} */
	let mx_records = [];

	// const get the domain
	const { username, domain } = emailSplit(email);
	try {
		const dns_response = await Promise.race([
			dnsPromises.resolveMx(domain),
			/** @returns {Promise<[]>} */ (async () => {
				return new Promise(res => setTimeout(() => res([]), 10 * 1000));
			})(), // 10 seconds race
		]);

		mx_records = dns_response || [];
	} catch (error) {
		logger.error(`getMXRecords() error -> ${error?.toString()}`);
	} finally {
		return mx_records;
	}
}

module.exports = getMXRecords;
