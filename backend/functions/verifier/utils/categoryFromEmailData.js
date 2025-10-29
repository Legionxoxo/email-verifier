/**
 * Determines email verification status and reason from verification object
 * @param {*} emailObj - Email verification object containing SMTP and other checks
 * @returns {{email: string, status: string, reason: string} | undefined}
 */
function categoryFromEmailData(emailObj) {
    let return_obj = {
        email: emailObj?.email || '',
        status: 'unverifiable',
        reason: '',
    };

    // Email must exist to proceed
    if (!return_obj.email) return;

    // Derive a meaningful status and reason for our email
    if (
        emailObj?.reachable === 'yes' &&
        emailObj?.smtp?.host_exists === true &&
        emailObj?.smtp?.full_inbox === false &&
        emailObj?.smtp?.catch_all === false &&
        emailObj?.smtp?.deliverable === true &&
        emailObj?.smtp?.disabled === false &&
        emailObj?.disposable === false
    ) {
        return_obj.status = 'valid';
        return_obj.reason = 'This is a valid email address!';
    } else if (emailObj?.smtp?.host_exists === false) {
        return_obj.status = 'invalid';
        return_obj.reason = "This email doesn't have an associated SMTP server.";
    } else if (emailObj?.smtp?.disabled) {
        return_obj.status = 'unverifiable';
        return_obj.reason = "This email couldn't be verified!";
    } else if (emailObj?.smtp?.full_inbox === true) {
        return_obj.status = 'invalid';
        return_obj.reason = 'This email user has a full inbox.';
    } else if (
        (emailObj?.reachable === 'yes' || emailObj?.reachable === 'unknown') &&
        emailObj?.smtp?.catch_all === true
    ) {
        return_obj.status = 'catch-all';
        return_obj.reason = 'Provided email SMTP has Catch-All enabled.';
    } else if (emailObj?.smtp?.deliverable === false) {
        return_obj.status = 'invalid';
        return_obj.reason = 'Emails cannot be delivered to this email.';
    } else if (emailObj?.disposable === true) {
        return_obj.status = 'invalid';
        return_obj.reason = 'This email is suspected to be a temporary email.';
    } else if (emailObj?.error === true) {
        return_obj.status = 'unverifiable';
        return_obj.reason = "This email couldn't be verified!";
    } else {
        return_obj.status = 'unverifiable';
        return_obj.reason = "This email couldn't be verified!";
    }

    return return_obj;
}

module.exports = categoryFromEmailData;
