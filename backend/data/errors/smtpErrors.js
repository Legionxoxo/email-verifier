/**
 * This contains all the SMTP errors
 * @readonly @enum {string}
 */
const smtpErrors = {
    // Standard Errors
	ErrTimeout: "The connection to the mail server has timed out",
	ErrNoSuchHost: "Mail server does not exist",
	ErrServerUnavailable: "Mail server is unavailable",
	ErrBlocked: "Blocked by mail server",

	// RCPT Errors
	ErrTryAgainLater: "Try again later",
	ErrFullInbox: "Recipient out of disk space",
	ErrTooManyRCPT: "Too many recipients",
	ErrNoRelay: "Not an open relay",
	ErrMailboxBusy: "Mailbox busy",
	ErrExceededMessagingLimits: "Messaging limits have been exceeded",
	ErrNotAllowed: "Not Allowed",
	ErrNeedMAILBeforeRCPT: "Need MAIL before RCPT",
	ErrRCPTHasMoved: "Recipient has moved",
}

module.exports = smtpErrors;