/**
 * This function recursively converts nest Map to JSON
 * @param {Map<string, any>} map
 * @returns {string}
 */
function mapToJSON(map) {
	return JSON.stringify(
		Array.from(map.entries(), ([key, value]) => [key, value instanceof Map ? mapToJSON(value) : value])
	);
}

module.exports = mapToJSON;
