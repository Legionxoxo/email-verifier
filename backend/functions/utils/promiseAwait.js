/**
 * Returns a promise after seconds
 * @param {number} seconds
 */
function promiseAwait (seconds) {
    return new Promise(res => {
        setTimeout(() => res(true), seconds * 1000);
    })
}

module.exports = promiseAwait;