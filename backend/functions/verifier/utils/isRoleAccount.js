const roleAccountsList = require('../../../data/lists/roleAccountsList');

/**
 * This function checks if provided username is a role account
 * @param {string} username
 * @returns {boolean}
 */
function isRoleAccount(username) {
	return roleAccountsList.has(username);
}

module.exports = isRoleAccount;
