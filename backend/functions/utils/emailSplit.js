/**
 * This function will split the email into username and domain halves
 * @param {string} email
 * @returns {{username: string, domain: string}}
 */
function emailSplit(email) {
	// split the email based on the last '@'
	const emailArr = email?.split('@'),
		emailArrLen = emailArr?.length || 0;

	if (!emailArrLen)
		return {
			username: '',
			domain: '',
		};

	const domain = emailArr[emailArrLen - 1] || ''; // the last entry
	emailArr.pop(); // delete the last element of array

	const username = emailArr.join('@'); // just in case there is more than one "@"

	return {
		username,
		domain,
	};
}

module.exports = emailSplit;
