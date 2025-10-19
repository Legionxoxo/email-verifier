const winston = require('winston');

const errMsg = require('../../data/errMsg');
const sqldb = require('../../database/connect_sql');
const sqlAsync = require('../../database/sqlAsync');
const promiseAwait = require('../utils/promiseAwait');
const { loggerTypes } = require('../logging/logger');
const startupCoordination = require('../recovery/startupCoordination');

/**
 * This Queue takes the emails and creates
 * - a queue for all the requests
 * - creates a map of the email with the request ID for exporting
 * - requests are fed from the queue to the paralell processing units
 */
class Queue {
	/** @private @type {string} - queue id */
	queue_id;
	/** @private @type {string[]} - queue */
	queue;
	/** @private @type {Set<string>} - set to check if request id already in queue */
	queue_request_ids;
	/** @private @type {Map<string, string[]>} - request_id email map */
	queue_email_map;
	/** @private @type {Map<string, string>} - request_id response url map */
	queue_response_url_map;
	/** @private @type {boolean} - marks if the queue is synced up and ready for requests */
	ready = false;

	/** Winston Logger */
	logger = winston.loggers.get(loggerTypes.queue);

	/** @param {string} queue_id - Used to identify the DB object, since the data is saved on disk for redundancy */
	constructor(queue_id) {
		this.queue_id = queue_id;
		this.queue = [];
		this.queue_request_ids = new Set();
		this.queue_email_map = new Map();
		this.queue_response_url_map = new Map();
		this.current_request = '';

		this.init(); // start initialization
	}

	/** add requests to queue
	 * @param {RequestObj} request_obj
	 * @returns {Promise<{success: boolean, msg: string}>}
	 */
	async add({ request_id, emails, response_url }) {
		let success = false,
			msg = '';

		await this.waitForReady();
		try {
			// check if the request id already exists in queue
			if (this.queue_request_ids.has(request_id)) {
				msg = `Request ID already exists in queue!`;
				return { success, msg };
			}

			// add the request to the end of queue
			this.queue.push(request_id);
			this.queue_request_ids.add(request_id);
			this.queue_email_map.set(request_id, emails);
			this.queue_response_url_map.set(request_id, response_url);

			// save to the database
			await this.add_to_database({ request_id, emails, response_url });

			// respond positively
			success = true;
			msg = 'Successfully added request to the queue!';
		} catch (error) {
			this.logger.error(`An error has occurred while adding requests to queue. Error -> ${error?.toString()}`);
			msg = msg || errMsg.default;
		} finally {
			return {
				success,
				msg,
			};
		}
	}

	/** mark request as complete and delete from queue
	 * @param {string} request_id
	 */
	async done(request_id) {
		await this.waitForReady();

		try {
			// mark the request as done & remove the request from queue
			this.queue = this.queue.filter(n => n !== request_id); // This will remove the request from the queue and the current will change
			this.queue_request_ids.delete(request_id);
			this.queue_email_map.delete(request_id);
			this.queue_response_url_map.delete(request_id);

			// remove the request from the database
			await this.delete_from_database(request_id);
		} catch (error) {
			console.log(`An error has occurred while marking a request as done! Error -> `, error);
		}
	}

	/** Get the current running request details - The request at index 0
	 * @returns {RequestObj}
	 */
	get current() {
		/** @type {RequestObj} */
		let request = {
			request_id: '',
			emails: [],
			response_url: '',
		};
		try {
			const request_id = this.queue[0] || '';
			if (!request_id) throw new Error(`There is no current request!`);

			const emails = this.queue_email_map.get(request_id);
			const response_url = this.queue_response_url_map.get(request_id);

			if (!emails) throw new Error(`Emails for request ${request_id} not found!`);
			// if (!response_url) throw new Error(`Response URL for request ${request_id} not found!`); // Allowing empty response_url
			if (typeof response_url !== 'string') throw new Error(`Response URL is not a string for ${request_id}`);

			request = {
				request_id,
				emails,
				response_url,
			};
		} catch (error) {
			this.logger.error(`An error has occurred while running current request! Error -> ${error?.toString()}`);
		} finally {
			return request;
		}
	}

	/** Check if there is a current request */
	get isEmpty() {
		return this.queue.length === 0;
	}

	/** Check if there is more request after the current request */
	get hasNext() {
		if (this.queue_request_ids.size >= 2) return true;
		return false;
	}

	/** add requests to the database
	 * @protected
	 * @param {RequestObj} request_obj
	 */
	async add_to_database({ request_id, emails, response_url }) {
		let success = false;
		try {
			// save request to the database
			await sqlAsync.runAsync(
				`INSERT INTO ${this.queue_id} (request_id, emails, response_url) VALUES (?, ?, ?)`,
				[request_id, emails?.join(';'), response_url]
			);
			success = true;
		} catch (error) {
			this.logger.error(`An error has occurred while adding data to the database. Error -> ${error?.toString()}`);
			success = false;
		} finally {
			return success;
		}
	}

	/** get request from the database
	 * @protected
	 * @param {string} request_id
	 */
	async get_from_database(request_id) {
		/** @type {RequestObj} */
		let request = {
			request_id: '',
			emails: [],
			response_url: '',
		};
		try {
			// get request from the database
			/** @type {any} */
			const dbRes = await sqlAsync.getAsync(`SELECT * FROM ${this.queue_id} WHERE request_id = ?`, [request_id]);
			request = {
				request_id: dbRes?.request_id,
				emails: dbRes?.split(';'),
				response_url: dbRes?.response_url,
			};
		} catch (error) {
			this.logger.error(
				`An error has occurred while getting data from the database. Error -> ${error?.toString()}`
			);
		} finally {
			return request;
		}
	}

	/** delete from database
	 * @protected
	 * @param {string} request_id
	 */
	async delete_from_database(request_id) {
		let success = false;
		try {
			await sqlAsync.runAsync(`DELETE FROM ${this.queue_id} WHERE request_id = ?`, [request_id]);
			success = true;
		} catch (error) {
			this.logger.error(
				`An error has occurred while deleting request ${request_id} from database. Error -> ${error?.toString()}`
			);
			success = false;
		} finally {
			return success;
		}
	}

	/** @private - Initialize the database */
	async init() {
		try {
			// create the table if it doesn't exists
			await sqlAsync.runAsync(`CREATE TABLE IF NOT EXISTS ${this.queue_id} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id TEXT NOT NULL UNIQUE,
                emails TEXT,
                response_url TEXT
                )`);

			// WAIT for recovery to complete before syncing
			this.logger.info('Waiting for startup recovery to complete...');
			await startupCoordination.waitForRecovery();
			this.logger.info('Recovery complete - proceeding with queue sync');

			// Get the queue variables synced up
			await this.sync_pull();

			/** Mark the queue as ready */
			this.ready = true;
		} catch (error) {
			this.logger.error(
				`An error has occurred while initializing the database for the queue. Error -> ${error?.toString()}`
			);
		}
	}

	/** @private - wait for the queue to get ready */
	async waitForReady() {
		while (true) {
			if (this.ready) return this.ready;

			// wait for .5 seconds
			await promiseAwait(0.5);
		}
	}

	/** Get queue statistics - public method for health monitoring
	 * @returns {{queueLength: number, requestIdsCount: number}}
	 */
	getQueueStats() {
		return {
			queueLength: this.queue.length,
			requestIdsCount: this.queue_request_ids.size,
		};
	}

	/** Check if a request ID is in the queue - public method
	 * @param {string} request_id
	 * @returns {boolean}
	 */
	hasRequestId(request_id) {
		return this.queue_request_ids.has(request_id);
	}

	/** @private - This function pulls the data from the database */
	async sync_pull() {
		let success = false;
		try {
			// get all the requests from the database
			/** @type {any} */
			const requests = await sqlAsync.allAsync(`SELECT * FROM ${this.queue_id} ORDER BY id`);

			console.log(
				`SYNC requests -> `,
				requests?.map((/** @type {any} */ req) => ({
					request_id: req?.request_id,
					emailsLen: req?.emails,
				}))
			);

			for (const request of requests) {
				const request_id = request?.request_id || '',
					emails = request?.emails || '',
					response_url = request?.response_url || '';

				if (!request_id || !emails) {
					await sqlAsync.runAsync(`DELETE FROM ${this.queue_id} WHERE id = ?`, [request?.id]);
					continue;
				}

				// add the request to the end of queue
				this.queue.push(request_id);
				this.queue_request_ids.add(request_id);
				this.queue_email_map.set(request_id, emails?.split(';'));
				this.queue_response_url_map.set(request_id, response_url);
			}

			success = true;
		} catch (error) {
			this.logger.error(
				`An error has occurred while sync pulling data from the database. Error -> ${error?.toString()}`
			);
		} finally {
			return success;
		}
	}
}

const queue = new Queue('queue');

module.exports = queue;
