const { Router } = require('express');
const winston = require('winston');
const { loggerTypes } = require('../../logging/logger');
const { z } = require('zod');
const queue = require('../../staging/queue');
const errMsg = require('../../../data/errMsg');
const router = Router();

const logger = winston.loggers.get(loggerTypes.server);

// Single email verification
router.post('/single', (req, res) => {});

// Bulk email verification
router.post('/bulk', async (req, res) => {
	let success = false,
		msg = '';
	try {
		// get the data from the request
		const request_id = z.string().min(1).parse(req.body?.request_id),
			emails = z.string().min(1).array().parse(req.body?.emails),
			response_url = z.string().min(1).parse(req.body?.response_url);

		// add to queue
		queue.add({ request_id, emails, response_url });

		// respond
		success = true;
		msg = 'Request added to queue!';
	} catch (error) {
		logger.error(`/verify/bulk error -> ${error?.toString()}`);
		msg = msg || errMsg.default;
	} finally {
		res.json({
			success,
			msg,
		});
	}
});

module.exports = router;
