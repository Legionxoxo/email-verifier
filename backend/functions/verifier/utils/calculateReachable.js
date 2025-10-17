/**
 * This function will calculate reachability from the smtp response
 * @param {{ host_exists: boolean, full_inbox: boolean, catch_all: boolean, deliverable: boolean, disabled: boolean }} smtpResponse
 * @returns {"yes" | "no" | "unknown"}
 */
function calculateReachable (smtpResponse) {
    if (smtpResponse.deliverable === true)
        return "yes";
    
    if (smtpResponse.catch_all === true)
        return "unknown";

    return "no";
}

module.exports = calculateReachable;