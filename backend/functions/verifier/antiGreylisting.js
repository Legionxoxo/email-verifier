const winston = require('winston');
const { loggerTypes } = require('../logging/logger');
const sqlAsync = require('../../database/sqlAsync');
const promiseAwait = require('../utils/promiseAwait');
const startupCoordination = require('../recovery/startupCoordination');

/**
 * Class will handle anti greylisting for provided emails
 * - The class will store the request_id, results and the greylisted emails
 * - The class when prompted will inform the controller if there are any greylisted emails for a request that needs to be sent at the time
 * - The class will store everything in local storage
 */
class AntiGreylisting {
	/** @private @type {string} - table ID */
	table_id;
	/** @private @type {number[]} - greylisting retry intervals in ms */
	greylistingRetryIntervals = [
		1000 * 60, // 1 min
		2 * 1000 * 60, // 2 min
		2 * 1000 * 60, // 2 min
		3 * 1000 * 60, // 3 min
		3 * 1000 * 60, // 3 min
		4 * 1000 * 60, // 4 min
	];

	/** @private @type {Map<string, {request_id: string, emails: string[], response_url: string, retrial_index: number, last_tried_at: number, max_retries_reached: boolean, returned: boolean}>} */
	greylist_lists = new Map();
	/** @private @type {boolean} Marks whether we are ready to use the class */
	ready = false;

	/** @private Logger */
	logger = winston.loggers.get(loggerTypes.antiGreylist);

	/**
	 * @param {string} table_id
	 */
	constructor(table_id) {
		this.table_id = table_id;

		this.init();
	}

	/** initialize the class */
	async init() {
		try {
			// initialize the database table
			await sqlAsync.runAsync(`CREATE TABLE IF NOT EXISTS ${this.table_id} (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				request_id TEXT NOT NULL UNIQUE,
				emails TEXT NOT NULL,
				response_url TEXT NOT NULL,
				retrial_index NUMBER NOT NULL,
				last_tried_at NUMBER NOT NULL,
				max_retries_reached NUMBER NOT NULL,
				returned NUMBER NOT NULL
			)`);

			// WAIT for recovery to complete before syncing
			this.logger.info('Waiting for startup recovery to complete...');
			await startupCoordination.waitForRecovery();
			this.logger.info('Recovery complete - proceeding with antiGreylisting sync');

			// sync the database
			await this.syncDB();

			// purge unnecessary entries
			this.purgeArchive();

			this.ready = true; // mark as we are ready
		} catch (error) {
			this.logger.error(`init() error -> ${error?.toString()}`);
		}
	}

	/** Add to antigreylist
	 * @param {string} request_id
	 * @param {string[]} emails - greylisted emails
	 * @param {string} response_url
	 */
	async add(request_id, emails, response_url) {
		let success = false;

		await this.waitTillReady();
		try {
			// check if the entry already exists
			const current = this.greylist_lists.get(request_id);
			if (current) {
				// update the greylisted emails and increase the retiral index
				const max_retries_reached = current.retrial_index >= this.greylistingRetryIntervals.length - 1,
					new_retrial_index = max_retries_reached ? current.retrial_index : current.retrial_index + 1;

				this.greylist_lists.set(request_id, {
					...current,
					retrial_index: new_retrial_index,
					max_retries_reached,
					returned: false,
				});
				await this.pushDB(request_id, {
					...current,
					retrial_index: new_retrial_index,
					max_retries_reached,
					returned: false,
				});
			} else {
				// add the entry to the queue
				this.greylist_lists.set(request_id, {
					request_id,
					emails,
					response_url,
					retrial_index: 0,
					last_tried_at: new Date().getTime(),
					max_retries_reached: false,
					returned: false,
				});
				await this.pushDB(request_id, {
					request_id,
					emails,
					response_url,
					retrial_index: 0,
					last_tried_at: new Date().getTime(),
					max_retries_reached: false,
					returned: false,
				});
			}

			success = true;
		} catch (error) {
			this.logger.error(`add() error -> ${error?.toString()}`);
		} finally {
			return success;
		}
	}

	/** Check if any greylisted email list needs to be checked
	 * - returns list of all greylisted entries that are to be tried now
	 */
	async tryGreylisted() {
		await this.waitTillReady();

		const lists = Array.from(this.greylist_lists.values());
		const now = new Date().getTime();

		const entries = lists.filter(
			item =>
				item.last_tried_at + this.greylistingRetryIntervals[item.retrial_index] < now && item.returned === false
		);

		// for each entry mark them as returned false
		entries.forEach(entry => {
			const current = this.greylist_lists.get(entry.request_id);
			if (current)
				this.greylist_lists.set(entry.request_id, {
					...current,
					last_tried_at: now,
					returned: true, // ⚠️ This is not updated in he DB since if the code crashes we want the code to try again. Not updating the DB is intentional.
				});
		});

		// return the entries list
		return entries
			.filter(n => !!n)
			.map(entry => ({ request_id: entry.request_id, emails: entry.emails, response_url: entry?.response_url }));
	}

	/**
	 * check if the request id finished all its greylist attempts
	 * @param {string} request_id
	 */
	async checkGreylist(request_id) {
		await this.waitTillReady();

		const request = this.greylist_lists.get(request_id);

		if (request && !request.max_retries_reached) {
			return true;
		}

		return false;
	}

	/**
	 * Check if request_id exists in greylist
	 * @param {string} request_id
	 */
	async exists(request_id) {
		await this.waitTillReady();

		return !!this.greylist_lists.get(request_id);
	}

	/** Save the data to the database
	 * @param {string} request_id
	 * @param {{request_id: string, emails: string[], response_url: string, retrial_index: number, last_tried_at: number, max_retries_reached: boolean, returned: boolean}} entry
	 */
	async pushDB(request_id, entry) {
		let success = false;
		try {
			const emails = JSON.stringify(entry?.emails),
				response_url = entry?.response_url,
				retrial_index = entry?.retrial_index,
				last_tried_at = entry?.last_tried_at,
				max_retries_reached = entry?.max_retries_reached ? 1 : 0,
				returned = entry?.returned ? 1 : 0;

			await sqlAsync.runAsync(
				`INSERT INTO ${this.table_id}
				(request_id, emails, response_url, retrial_index, last_tried_at, max_retries_reached, returned)
				VALUES (?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT (request_id) DO UPDATE SET
				retrial_index = EXCLUDED.retrial_index,
				max_retries_reached = EXCLUDED.max_retries_reached,
				returned = EXCLUDED.returned`,
				[request_id, emails, response_url, retrial_index, last_tried_at, max_retries_reached, returned]
			);

			success = true;
		} catch (error) {
			this.logger.error(`pushDB() error -> ${error?.toString()}`);
		} finally {
			return success;
		}
	}

	/** Sync from DB */
	async syncDB() {
		try {
			/** @type {any} */
			const greylistedRequests = await sqlAsync.allAsync(`SELECT * FROM ${this.table_id}`);

			for (const request of greylistedRequests) {
				const request_id = request?.request_id || '',
					emails = JSON.parse(request?.emails || '[]'),
					response_url = request?.response_url || '',
					retrial_index = parseInt(request?.retrial_index || '') || 0,
					last_tried_at = parseInt(request?.last_tried_at || '') || 0,
					max_retries_reached = !!parseInt(request?.max_retries_reached || ''),
					returned = !!parseInt(request?.returned || '');

				this.greylist_lists.set(request_id, {
					request_id,
					emails,
					response_url,
					retrial_index,
					last_tried_at,
					max_retries_reached,
					returned,
				});
			}
		} catch (error) {
			this.logger.error(`syncDB() error -> ${error?.toString()}`);
		}
	}

	/**
	 * Purge unnecessary archive entries (recursively)
	 */
	async purgeArchive() {
		try {
			const now = new Date().getTime(),
				deadline = now - 1000 * 60 * 60 * 24; // delete entries from 1 day ago

			await sqlAsync.runAsync(`DELETE FROM ${this.table_id} WHERE last_tried_at < ? OR max_retries_reached = ?`, [
				deadline,
				1,
			]); // remove the ones that have reached the max_retries or are more than 24 hours old
		} catch (error) {
			this.logger.error(`purgeArchive() error -> `, error);
		} finally {
			await promiseAwait(1); // every 1 second
			this.purgeArchive();
		}
	}

	/** clear greylist for the request
	 * @param {string} request_id
	 */
	async clearGreylistForRequest(request_id) {
		try {
			// delete from RAM
			this.greylist_lists.delete(request_id);

			// delete from the database
			await sqlAsync.runAsync(`DELETE FROM ${this.table_id} WHERE request_id = ?`, [request_id]);
		} catch (error) {
			this.logger.error(`clearGreylistForRequest() error -> ${error?.toString()}`);
		}
	}

	/**
	 * Wait till ready
	 */
	async waitTillReady() {
		while (true) {
			if (this.ready) return true;

			await promiseAwait(0.5);
		}
	}
}

const antiGreylisting = new AntiGreylisting('antigreylisting');

module.exports = antiGreylisting;
module.exports.AntiGreylisting = AntiGreylisting;
