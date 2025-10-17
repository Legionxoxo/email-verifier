/**
 * This function will take a function return a clone of the function
 * @param {Function} originalFunction - The original function to clone.
 * @returns {Function} - A new function that behaves the same as the original function.
 */
function cloneFunction(originalFunction) {
	return originalFunction.bind({});
}

module.exports = cloneFunction;
