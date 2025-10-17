/**
 * This Funtion Awaits for the provided period of milli Seconds.
 * @param {number} mSec 
 */
function promiseAwaitMs (mSec) {
    return new Promise(res => {
        setTimeout(() => res(true), mSec);
    })
}

module.exports = promiseAwaitMs;