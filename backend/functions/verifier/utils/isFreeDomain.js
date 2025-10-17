const freeDomainsList = require('../../../data/lists/freeDomainsList');

/**
 * This function checks if provided domain is a free domain or not
 * @param {string} domain
 * @returns {boolean}
 */
function isFreeDomain(domain) {
	return freeDomainsList.has(domain);
}

module.exports = isFreeDomain;
