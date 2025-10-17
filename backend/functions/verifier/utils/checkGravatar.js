const crypto = require('crypto');
const { axiosGet } = require('../../utils/axios');

const gravatarBaseUrl = 'https://www.gravatar.com/avatar/';
const gravatarDefaultMd5 = 'd5fe5cbcc31cff5f8ac010db72eb000c';

/**
 * This function will return the Gravatar records for the given email.
 * @param {string} email
 */
async function checkGravatar(email) {
	try {
		const emailMd5 = getMD5Hash(email.trim().toLowerCase());
		const gravatarUrl = gravatarBaseUrl + emailMd5 + '?d=404';

		const response = await axiosGet(gravatarUrl, { timeout: 10000 });

		if (response && response.status !== 200) {
			return {
				hasGravatar: false,
				gravatarUrl: '',
			};
		}

		if (response) {
			const bodyMd5 = getMD5Hash(response.data);

			if (bodyMd5 === gravatarDefaultMd5) {
				return {
					hasGravatar: false,
					gravatarUrl: '',
				};
			}
		}

		return {
			hasGravatar: true,
			gravatarUrl: gravatarUrl,
		};
	} catch (error) {
		console.error(`An error has occurred while checking gravatar for email. Error -> `, error);
		return null;
	}
}

/**
 * This function will return the MD5 hash
 * @param {string} str
 */
function getMD5Hash(str) {
	return crypto.createHash('md5').update(str).digest('hex');
}

module.exports = checkGravatar;
