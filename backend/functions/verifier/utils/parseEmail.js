const emailSplit = require("../../utils/emailSplit");
const isValidEmail = require("../../utils/isValidEmail");

/**
 * This function will parse the email provided and break it down into its components
 * @param {string} email
 * @returns {{username: string, domain: string, valid: boolean}}
 */
function parseEmail (email) {
    let returnObj = {
        username: "",
        domain: "",
        valid: false
    }

    // check if the email is a valid email
    returnObj.valid = isValidEmail(email);

    // get the username and the domain part
    const {username, domain} = emailSplit(email);
    returnObj.username = username || "";
    returnObj.domain = domain || "";

    return returnObj;
}

module.exports = parseEmail;