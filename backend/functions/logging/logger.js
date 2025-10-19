const winston = require('winston');
const stateVariables = require('../../data/stateVariables');
const { combine, timestamp, json, prettyPrint, errors } = winston.format;

/**
 * Available Loggers
 * @enum {string}
 */
const loggerTypes = {
	default: 'default',
	server: 'server',
	queue: 'queue',
	verifier: 'verifier',
	verifier0: 'verifier0',
	verifier1: 'verifier1',
	verifier2: 'verifier2',
	verifier3: 'verifier3',
	smtp: 'smtp',
	smtp0: 'smtp0',
	smtp1: 'smtp1',
	smtp2: 'smtp2',
	smtp3: 'smtp3',
	antiGreylist: 'antiGreylist',
	msLogin: 'msLogin',
	startupRecovery: 'startupRecovery',
};

// The default system logger
winston.loggers.add(loggerTypes.default, {
	level: 'debug',
	format: combine(
		errors({ stack: true }),
		timestamp(),
		json()
		// prettyPrint() // uncomment if you want beautiful logs
	),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: `.logs/all.log`, level: 'error' }),
		new winston.transports.File({ filename: `.logs/${loggerTypes.default}.log`, level: 'debug' }),
	],
	defaultMeta: { service: loggerTypes.default },
});

// The default system logger
winston.loggers.add(loggerTypes.server, {
	level: 'debug',
	format: combine(
		errors({ stack: true }),
		timestamp(),
		json()
		// prettyPrint() // uncomment if you want beautiful logs
	),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: `.logs/all.log`, level: 'error' }),
		new winston.transports.File({ filename: `.logs/${loggerTypes.server}.log`, level: 'debug' }),
	],
	defaultMeta: { service: loggerTypes.server },
});

// queue
winston.loggers.add(loggerTypes.queue, {
	level: 'debug',
	format: combine(
		errors({ stack: true }),
		timestamp(),
		json()
		// prettyPrint() // uncomment if you want beautiful logs
	),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: `.logs/all.log`, level: 'error' }),
		new winston.transports.File({ filename: `.logs/${loggerTypes.queue}.log`, level: 'debug' }),
	],
	defaultMeta: { service: loggerTypes.queue },
});

// The verifier logger
winston.loggers.add(loggerTypes.verifier, {
	level: 'debug',
	format: combine(
		errors({ stack: true }),
		timestamp(),
		json()
		// prettyPrint() // uncomment if you want beautiful logs
	),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: `.logs/all.log`, level: 'error' }),
		new winston.transports.File({ filename: `.logs/${loggerTypes.verifier}.log`, level: 'debug' }),
	],
	defaultMeta: { service: loggerTypes.verifier },
});
const verifierLoggers = [loggerTypes.verifier0, loggerTypes.verifier1, loggerTypes.verifier2, loggerTypes.verifier3];
for (let i = 0; i < verifierLoggers.length; i++) {
	winston.loggers.add(verifierLoggers[i], {
		level: 'debug',
		format: combine(
			errors({ stack: true }),
			timestamp(),
			json()
			// prettyPrint() // uncomment if you want beautiful logs
		),
		transports: [
			new winston.transports.Console(),
			new winston.transports.File({ filename: `.logs/all.log`, level: 'error' }),
			new winston.transports.File({ filename: `.logs/${verifierLoggers[i]}.log`, level: 'debug' }),
		],
		defaultMeta: { service: verifierLoggers[i] },
	});
}

// The SMTP verifier logger
winston.loggers.add(loggerTypes.smtp, {
	level: 'debug',
	format: combine(
		errors({ stack: true }),
		timestamp(),
		json()
		// prettyPrint() // uncomment if you want beautiful logs
	),
	transports: [
		new winston.transports.Console({ level: 'error' }),
		new winston.transports.File({ filename: `.logs/all.log`, level: 'error' }),
		new winston.transports.File({ filename: `.logs/${loggerTypes.smtp}.log`, level: 'debug' }),
		new winston.transports.File({ filename: `.logs/${loggerTypes.smtp}.error.log`, level: 'error' }),
	],
	defaultMeta: { service: loggerTypes.smtp },
});
const smtpLoggers = [loggerTypes.smtp0, loggerTypes.smtp1, loggerTypes.smtp2, loggerTypes.smtp3];
for (let i = 0; i < smtpLoggers.length; i++) {
	winston.loggers.add(smtpLoggers[i], {
		level: 'debug',
		format: combine(
			errors({ stack: true }),
			timestamp(),
			json()
			// prettyPrint() // uncomment if you want beautiful logs
		),
		transports: [
			new winston.transports.Console({ level: 'error' }),
			new winston.transports.File({ filename: `.logs/all.log`, level: 'error' }),
			new winston.transports.File({ filename: `.logs/${smtpLoggers[i]}.log`, level: 'debug' }),
			new winston.transports.File({ filename: `.logs/${smtpLoggers[i]}.error.log`, level: 'error' }),
		],
		defaultMeta: { service: loggerTypes.smtp },
	});
}

// The Anti greylist logger
winston.loggers.add(loggerTypes.antiGreylist, {
	level: 'debug',
	format: combine(
		errors({ stack: true }),
		timestamp(),
		json()
		// prettyPrint() // uncomment if you want beautiful logs
	),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: `.logs/all.log`, level: 'error' }),
		new winston.transports.File({ filename: `.logs/${loggerTypes.antiGreylist}.log`, level: 'debug' }),
	],
	defaultMeta: { service: loggerTypes.antiGreylist },
});

// Microsoft Login Logger
winston.loggers.add(loggerTypes.msLogin, {
	level: 'debug',
	format: combine(
		errors({ stack: true }),
		timestamp(),
		json()
		// prettyPrint() // uncomment if you want beautiful logs
	),
	transports: [
		new winston.transports.Console({ level: 'error' }),
		new winston.transports.File({ filename: `.logs/all.log`, level: 'error' }),
		new winston.transports.File({ filename: `.logs/${loggerTypes.msLogin}.log`, level: 'debug' }),
	],
	defaultMeta: { service: loggerTypes.msLogin },
});

// Startup Recovery Logger
winston.loggers.add(loggerTypes.startupRecovery, {
	level: 'debug',
	format: combine(
		errors({ stack: true }),
		timestamp(),
		json()
		// prettyPrint() // uncomment if you want beautiful logs
	),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: `.logs/all.log`, level: 'error' }),
		new winston.transports.File({ filename: `.logs/${loggerTypes.startupRecovery}.log`, level: 'debug' }),
	],
	defaultMeta: { service: loggerTypes.startupRecovery },
});

module.exports.loggerTypes = loggerTypes;
