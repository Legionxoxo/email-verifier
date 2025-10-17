const { axiosGet } = require("../../utils/axios");
const {z} = require("zod");
const promiseAwait = require("../../utils/promiseAwait");

/**
 * This class will check if a email is disposable or not
 */
class DisposableMails {
    /**
     * This variable stores a set of disposable emails
     * @private @type {Set<string>}
     */
    _disposableEmailDomainsList
    /**
     * This variable marks whether the class has been initialized or not, i.e. has the data been pulled for the first time
     * @private @type {boolean}
     */
    _initialized
    /**
     * This variable marks whether the function is running in Test Mode
     * @private {boolean}
     */
    _testMode
    /** 
     * This variable marks the numer of seconds after which the disposable list is refreshed
     * @private @type {number} */
    _updateTimePeriodSec = 60 * 60; // 1 hour

    /**
     * @param {boolean} testMode
     */
    constructor(testMode = false) {
        this._disposableEmailDomainsList = new Set();
        this._initialized = false;
        this._testMode = testMode;        
    
        this.updateList(); // We will update the list for the first time here
    }

    // validate email if it is disposable or not
    /**
     * This function validates email if it is disposable or not
     * @public
     * @param {string} email
     */
    async isDisposable (email) {
        if(!z.string().min(1).safeParse(email).success) { // if the input anything else other than a non empty string then return true (is disposable)
            return false;
        }
        
        // wait to check if the code is initialized or not
        for (let i = 0; i < 200; i++) {
            if (this._initialized) break;
            await promiseAwait(1);
        }

        // Edge case for when not initialized
        if (!this._initialized) {
            return false;
        }
        
        // get the domain from the email
        const domain = email?.split("@")[1]?.trim() || "";

        if (!domain) return false;

        const result = this._disposableEmailDomainsList.has(domain)
        return result
    }

    /** This code will constantly be updating the list of disposable emails every 1 hour + on first load */
    async updateList () {
        try {
            const apiRes = await axiosGet("https://rawcdn.githack.com/disposable/disposable-email-domains/master/domains.json");

            if (apiRes && apiRes.status ===  200) {
                const list = apiRes?.data;

                if (list && Array.isArray(list)) {
                    // make sure that all the values in the array are strings
                    const stringArr = list.map(n => typeof n === "string" ? n?.trim() : undefined)?.filter(/** @returns {n is string} */ (n) => !!n);

                    this._disposableEmailDomainsList = new Set(stringArr);
                    
                    if (!this._initialized && !this._testMode) {
                        console.log(`Fetched list of disposable email domains. List length -> `, this._disposableEmailDomainsList.size);
                    }
                }
            }
        } catch (error) {
            console.log(`An error has occurred while updating disposable emails list. Error -> `, error);
            console.log(`Retry again in 1 hour...`);
        } finally {
            this._initialized = true;
            if (!this._testMode) {
                await promiseAwait(this._updateTimePeriodSec);
                await this.updateList(); // re run the function again.       
            }
        }
    }
}

const disposableMails = new DisposableMails();

module.exports = disposableMails;
module.exports.DisposableMails = DisposableMails; // This is for testing