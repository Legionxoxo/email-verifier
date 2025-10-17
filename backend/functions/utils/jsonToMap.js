/**
 * This function recursively convertes JSON to nested Map
 * @param {string} jsonStr
 * @returns {any}
 */
function jsonToMap(jsonStr) {
	return new Map(
		JSON.parse(jsonStr, (key, value) => {
			if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
				try {
					return new Map(jsonToMap(value));
				} catch (e) {
					return value;
				}
			}
			return value;
		})
	);
}

module.exports = jsonToMap;
