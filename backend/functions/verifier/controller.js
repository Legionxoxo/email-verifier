const winston = require('winston');
const { loggerTypes } = require('../logging/logger');
const { Worker } = require('worker_threads');
const path = require('path');
const promiseAwait = require('../utils/promiseAwait');
const queue = require('../staging/queue');
const stateVariables = require('../../data/stateVariables');
const sqlAsync = require('../../database/sqlAsync');
const antiGreylisting = require('./antiGreylisting');
const promiseAwaitMs = require('../utils/promiseAwaitMs');

/**
 * @typedef {Object} RequestObj
 * @property {string} request_id
 * @property {string[]} emails
 * @property {string} response_url
 */

/**
 * @typedef {Object} VerificationObj
 * @property {string} email
 * @property {"yes" | "no" | "unknown"} reachable
 * @property {{username: string, domain: string, valid: boolean}} syntax
 * @property {{host_exists: boolean, full_inbox: boolean, catch_all: boolean, deliverable: boolean, disabled: boolean}} smtp
 * @property {any} gravatar
 * @property {string} suggestion
 * @property {boolean} disposable
 * @property {boolean} role_account
 * @property {boolean} free
 * @property {boolean} has_mx_records
 * @property {{Host: string, Pref: number}[]} mx
 * @property {boolean} error
 * @property {string} error_msg
 */

// Restart worker time
const restart_after = 10 * 60 * 1000; // 10 mins (not in the middle of a process)

/**
 * This is the controller to the verifier instances.
 * - The controller assigns requests to be processed by verifier instances
 * - The controller pulls requests from the queue when there is an empty slot
 * - The controller also saves its state to the DB
 */
class Controller {
	/** @private @type {string} - controller ID*/
	controllerID;
	/** @private @type {Worker[]} - array of available worker instances */
	workers;
	/** @private @type {number[]} - last ping time from a worker */
	workers_last_ping;
	/** @private @type {(RequestObj | null)[]} - request assignments to workers */
	request_assignments;
	/** @private @type {Map<string, RequestObj & {result: Map<string, VerificationObj>, created_at: number}>} request archive */
	request_archive = new Map();

	/** @private @type {number} - Number of threads to create */
	threads_num = stateVariables.thread_num;
	/** @private @type {number} - ping check frequency*/
	ping_check_freq = stateVariables.ping_freq;
	/** @private @type {string} - verifier instance path */
	verifierInstancePath = `./functions/verifier/verifierInstance.js`;
	/** @private Logger */
	logger = winston.loggers.get(loggerTypes.verifier);

	/**  Map of worker and restart after time @private @type {Map<number, number>} */
	worker_restart_at = new Map();

	/** @private @type {Map<number, boolean>} - tracks if worker is being restarted */
	worker_restarting = new Map();

	/** @private @type {Map<number, boolean>} - tracks if worker is locked for assignment */
	worker_assignment_lock = new Map();

	/**
	 * @param {string} controllerID
	 */
	constructor(controllerID) {
		this.controllerID = controllerID;
		this.workers = [];
		this.workers_last_ping = [];
		this.request_assignments = [];

		this.init();
	}

	/** initialize the workers */
	async init() {
		try {
			// Initialize the table in the database
			await sqlAsync.runAsync(`CREATE TABLE IF NOT EXISTS ${this.controllerID} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
				workerIndex TEXT NOT NULL UNIQUE,
                request TEXT NOT NULL,
				created_at NUMBER NOT NULL
                )`);

			// intialize the archive table in the database if not already exists
			await sqlAsync.runAsync(`CREATE TABLE IF NOT EXISTS ${this.controllerID}Archive (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
				request_id TEXT NOT NULL UNIQUE,
				emails TEXT NOT NULL,
				result TEXT NOT NULL,
				response_url TEXT NOT NULL,
				created_at NUMBER NOT NULL
                )`);

			// create the verifier worker instances
			for (let i = 0; i < this.threads_num; i++) {
				const workerInstance = new Worker(path.join(process.cwd(), this.verifierInstancePath), {
					workerData: { index: i },
				});
				this.workers.push(workerInstance); // Add to the list of workers
				this.workers_last_ping.push(new Date().getTime()); // Add the last time we know the worker exists
				this.request_assignments.push(null); // empty requests assigned

				// function to handle events on the worker -> worker stopping to work + exiting + messages and so on
				this.handleEvents(workerInstance, i);
				this.worker_restart_at.set(i, new Date().getTime() + restart_after); // restart after time given
				this.worker_restarting.set(i, false);
				this.worker_assignment_lock.set(i, false);
			}

			// start the monitoring
			// this.monitor(); // turning off monitor since the restarting is done via event listeners

			// pull sync from the database -> if there are incomplete tasks assign them to the workers
			await this.syncDB();

			// start checking
			this.checkQueue();

			// Purge archive rec
			// this.purgeArchiveRec();
		} catch (error) {
			this.logger.error(`init() error -> ${error?.toString()}`);
		}
	}

	/** monitor health of workers
	 * - each worker thread should ping the parent every 10 seconds
	 * - in lieu of a ping the parent will restart the worker
	 * @private
	 */
	async monitor() {
		let buffer = 2.5; // 2.5 seconds of additional time to account for I/O block delays

		try {
			// get the current time
			const curr_time = new Date().getTime();

			// loop over each of the workers and check if they are active
			for (let i = 0; i < this.workers_last_ping.length; i++) {
				const time = this.workers_last_ping[i];
				if (Math.abs(curr_time - time) < this.ping_check_freq * 1000 * buffer) continue; // evreything is fine and the worker is reporting as usual + buffer

				// The worker is not working as normal and needs to be restarted
				await this.restartWorker(i);
			}
		} catch (error) {
			this.logger.error(`monitor() error -> ${error?.toString()}`);
		} finally {
			// wait for delay
			await promiseAwait(this.ping_check_freq + buffer);

			// run the check again
			this.monitor();
		}
	}

	/**
	 * Check if the queue has entries that can be sent to a worker
	 * @private
	 */
	async checkQueue() {
		let delay = 1; // check again in 1 sec
		try {
			// restart the workers if they are free and it is time to restart
			for (let i = 0; i < this.threads_num; i++) {
				// check if there is any request running or worker is being restarted
				const request = this.request_assignments[i];
				if (request || this.worker_restarting.get(i) || this.worker_assignment_lock.get(i)) continue;

				// restart the worker otherwise
				if ((this.worker_restart_at.get(i) || Infinity) < new Date().getTime()) {
					// Lock the worker to prevent assignments during restart
					this.worker_assignment_lock.set(i, true);
					this.worker_restarting.set(i, true);

					// restart the worker here
					await this.restartWorker(i);

					// set new time to restart the worker
					this.worker_restart_at.set(i, new Date().getTime() + restart_after);
				}
			}

			// check if there are any anti grey list entries -> if yes assign them
			await this.checkAntiGreylist();

			// check if any of the worker is free and has no assignment -> get the number of workers that are free
			let slotsLeft = this.request_assignments.reduce((f, c) => (!c ? f + 1 : f), 0);

			for (let i = 0; i < this.request_assignments.length; i++) {
				if (slotsLeft <= 0) break; // if no slots left, then no more checking

				const request = this.request_assignments[i];

				// Skip if worker has a request, is restarting, or is locked
				if (request || this.worker_restarting.get(i) || this.worker_assignment_lock.get(i)) continue;

				// get a latest request from the queue
				if (queue.isEmpty) break; // <- the queue is empty and we can exit the loop
				const currReq = queue.current;

				// Lock the worker during assignment
				this.worker_assignment_lock.set(i, true);

				// assign the request to the worker
				const success = await this.assign(i, currReq);

				if (success) {
					// move to the next item in the queue
					await queue.done(currReq.request_id);

					// mark the request as verifying in the database
					await this.markAsVerifying(currReq.request_id);

					// reduce the slots left
					slotsLeft--;
				}

				// Unlock the worker after assignment attempt
				this.worker_assignment_lock.set(i, false);
			}
		} catch (error) {
			this.logger.error(`checkQueue() error -> ${error?.toString()}`);
		} finally {
			// wait for delay
			await promiseAwait(delay);

			this.checkQueue(); // check again
		}
	}

	/**
	 * Check if antiGreylisting has any entry that can be sent to a worker
	 * @private
	 */
	async checkAntiGreylist() {
		try {
			// get the list of entries to test for greyist
			const requests = await antiGreylisting.tryGreylisted();

			const requestLen = requests.length;
			if (requestLen === 0) return;

			this.logger.debug(`Attempting to retry greylisted emails...`);
			let slotsLeft = this.request_assignments.reduce((f, c) => (!c ? f + 1 : f), 0),
				request_index = 0;
			for (let i = 0; i < this.request_assignments.length; i++) {
				if (slotsLeft <= 0) break; // if no slots left, then no more checking

				const request = this.request_assignments[i]; // check if there are running requests
				// Skip if worker has a request, is restarting, or is locked
				if (request || this.worker_restarting.get(i) || this.worker_assignment_lock.get(i)) continue;

				// get a latest request from the greylist
				if (request_index >= requestLen) break; // <- the requests list is empty and we can exit the loop
				const currReq = requests[request_index];

				// Lock the worker during assignment
				this.worker_assignment_lock.set(i, true);

				// assign the request to the worker
				const success = await this.assign(i, currReq);
				this.logger.debug(`Attempt on greylisted emails for ${currReq.request_id}`);

				if (success) {
					// move to the next item in the list
					request_index++;

					// reduce the slots left
					slotsLeft--;
				}

				// Unlock the worker after assignment attempt
				this.worker_assignment_lock.set(i, false);
			}
		} catch (error) {
			this.logger.error(`checkAntiGreylist() error -> ${error?.toString()}`);
		}
	}

	/**
	 * handle events on workers
	 * @private
	 * @param {Worker} worker
	 * @param {number} workerIndex
	 */
	handleEvents(worker, workerIndex) {
		try {
			// Listen for messages from the worker
			worker.on('message', msg => {
				// -> code to handle the messages from the worker <-
				// if a request is complete, update the objects of the class
				const type = msg?.type || '';

				// check if ping
				switch (type) {
					case 'ping': {
						this.ping(workerIndex);
						break;
					}
					case 'complete': {
						// handle the complete and setup for anti greylisting
						this.handlePartialComplete(
							workerIndex,
							msg?.request_id || '',
							msg?.result || new Map(),
							msg?.greylisted_emails || [],
							msg?.blacklisted_emails || [],
							msg?.recheck_required || []
						);
						break;
					}
					default: {
						//
					}
				}
			});

			// Handle any errors that occur in the worker
			worker.on('error', async err => {
				// restart the worker with the same request
				await this.restartWorker(workerIndex);
			});

			// Handle the event when the worker exits
			worker.on('exit', async code => {
				// restart the worker with the same request
				await this.restartWorker(workerIndex);
			});
		} catch (error) {
			this.logger.error(`handleEvents() error -> ${error?.toString()}`);
		}
	}

	/**
	 * handle request completion
	 * @private
	 * @param {number} workerIndex
	 * @param {string} request_id
	 * @param {Map<string, VerificationObj>} result
	 * @param {string[]} greylisted_emails
	 * @param {string[]} blacklisted_emails
	 * @param {string[]} recheck_required
	 */
	async handlePartialComplete(
		workerIndex,
		request_id,
		result,
		greylisted_emails,
		blacklisted_emails,
		recheck_required
	) {
		this.logger.debug(
			`Received from worker results for request id -> ${request_id} Proceed status: ${
				this.request_assignments[workerIndex]?.request_id === request_id
			}`
		);

		// verify that the request_id matches with the request_id that was provided.
		if (this.request_assignments[workerIndex]?.request_id === request_id) {
			const requestObj = this.request_assignments[workerIndex];

			if (!requestObj) return;

			console.table({
				greylisted_emails_len: greylisted_emails.length,
				blacklisted_emails_len: blacklisted_emails.length,
				recheck_required_len: recheck_required.length,
			});

			// incase greylisted and blacklisted emails are found, forward the request to the cluster
			if (
				(Array.isArray(greylisted_emails) && greylisted_emails.length > 0) ||
				(Array.isArray(blacklisted_emails) && blacklisted_emails.length > 0) ||
				(Array.isArray(recheck_required) && recheck_required.length > 0)
			) {
				if (greylisted_emails.length > 0) {
					this.logger.debug(`Greylisted emails found for request ${request_id}`);
					// mark that the request has greylisted emails
					await this.markGreylisted(request_id);
				}
				if (blacklisted_emails.length > 0) {
					this.logger.debug(`Blacklisted emails found for request ${request_id}`);
					// mark that the request has blacklisted emails
					await this.markBlacklisted(request_id);
				}

				// send the request to the cluster to analyze
				// const status = await minionConnect.forwardRequest(request_id, [
				// 	...greylisted_emails,
				// 	...blacklisted_emails,
				// 	...recheck_required,
				// ]);

				// if (!status) {
				// 	// mark the request as complete for the verifier controller.
				// 	// -> code here <-
				// 	this.logger.debug(`Failed to forward request to cluster for request_id ${request_id}`);
				// } else {
				// 	this.logger.debug(`Request ${request_id} forwareded to the cluster!`);
				// }
			}

			if (
				greylisted_emails.length > 0 &&
				((await antiGreylisting.checkGreylist(request_id)) || !(await antiGreylisting.exists(request_id)))
			) {
				this.logger.debug(`Greylisted emails found for request id -> ${request_id}`);

				// add to anti greylisting
				await Promise.allSettled([
					antiGreylisting.add(request_id, greylisted_emails, requestObj.response_url),
					minionConnect.markGreylisted(request_id),
				]);

				// Add the request to the archive
				if (this.request_archive.get(request_id)) {
					const archObj = this.request_archive.get(request_id),
						resultOld = archObj?.result;

					if (resultOld) {
						this.request_archive.set(request_id, {
							...archObj,
							result: new Map([...result, ...resultOld]),
						});
						await this.pushArchive(request_id, {
							...archObj,
							result: new Map([...result, ...resultOld]),
						});
					}
				} else {
					this.request_archive.set(request_id, {
						...requestObj,
						result: result,
						created_at: new Date().getTime(),
					});
					await this.pushArchive(request_id, {
						...requestObj,
						result: result,
						created_at: new Date().getTime(),
					});
				}
			} else {
				this.logger.debug(`No greylisted emails found for request ${request_id}! Proceeding to inform user.`);
				// clear all greylist saves for the request
				antiGreylisting.clearGreylistForRequest(request_id);

				// check if there are results in the archive
				const requestFromArch = this.request_archive.get(request_id);

				let finalResult = result;
				if (requestFromArch) {
					const archivedResult = requestFromArch.result;
					finalResult = new Map([...result, ...archivedResult]); // archived results will overlap the entries from result
				}

				const existsInDB = await minionConnect.requestInDB(request_id);
				const resultArr = Array.from(finalResult.values()),
					resultLen = resultArr?.length || 0;

				if (existsInDB) {
					this.logger.debug(`Informing for request ${request_id} via database!`);
					const success = await minionConnect.completeRequest(request_id, resultArr);
				} else {
					this.logger.debug(`Informing for request ${request_id} through API!`);
					// send the request to the client - this will happen after greylisting
					const response_url = this.request_assignments[workerIndex]?.response_url;
					if (response_url) {
						for (let i = 0; i < 200; i++) {
							const axiosRes = await axiosPost(
								response_url || `https://${CONTROLLER_DOMAIN}/api/v1/minion/response`,
								{
									api_key: API_KEY,
									minion_id: SERVER_ID,
									emails_verified: 0,
									processed_emails: resultArr || [],
									total_emails: resultLen,
									state: 'complete',
									request_id: request_id || '',
									state_uuid: stateVariables.uuid || '',
								}
							);
							if (axiosRes && axiosRes.status === 200 && axiosRes.data?.success === true) break;
							await promiseAwait(1);
						}
					}
				}
			}

			// }

			// terminate the request
			this.request_assignments[workerIndex] = null;
			// update the database
			this.pushDB(workerIndex, null);
		}
	}

	/** This function will restart a worker and assign the worker the same task it was running
	 * @private
	 * @param {number} workerIndex
	 */
	async restartWorker(workerIndex) {
		let success = false;
		try {
			this.workers[workerIndex].removeAllListeners(); // remove all listeners

			const worker = this.workers[workerIndex];

			if (!worker) {
				throw new Error(`Worker at index ${workerIndex} not found!`);
			}

			// remove all listeners for worker
			worker.removeAllListeners();
			// terminate the worker
			worker.terminate();

			// start the worker again
			const workerInstance = new Worker(path.join(process.cwd(), this.verifierInstancePath), {
				workerData: { index: workerIndex },
			});
			this.workers[workerIndex] = workerInstance; // Replace in the list of workers
			this.workers_last_ping[workerIndex] = new Date().getTime(); // Replace last time we know the worker exists
			this.logger.info(`Worker at index ${workerIndex} has been restarted!`);

			// function to handle events on the worker -> worker stopping to work + exiting + messages and so on
			this.handleEvents(workerInstance, workerIndex); // add listeners again

			// send the worker its assigned task again
			const request = this.request_assignments[workerIndex];
			if (request) await this.assign(workerIndex, request, true);

			success = true;
		} catch (error) {
			this.logger.error(`restartWorker() error -> ${error?.toString()}`);
		} finally {
			// Clear the restart flags
			this.worker_restarting.set(workerIndex, false);
			this.worker_assignment_lock.set(workerIndex, false);
			return success;
		}
	}

	/** Assign given request to the worker
	 * @private
	 * @param {number} workerIndex
	 * @param {RequestObj} request
	 * @param {boolean} reassign - whether to reassign the worker
	 */
	async assign(workerIndex, request, reassign = false) {
		let success = false;
		try {
			// check if the worker is available to take accept this request
			if (this.request_assignments[workerIndex] && !reassign) return false; // worker is not free

			// assign the request to the worker
			this.workers[workerIndex].postMessage({ ...request, type: 'request' });

			// save assignment to the request_assignment list
			if (!reassign) this.request_assignments[workerIndex] = request;

			// save the assignment to the database
			await this.pushDB(workerIndex, request);

			success = true;
		} catch (error) {
			this.logger.error(`assign() error -> ${error?.toString()}`);
		} finally {
			return success;
		}
	}

	/**
	 * Mark the request as 'verifying' in the database
	 * @private
	 * @param {string} request_id
	 * @param {number} depth
	 * @returns {Promise<boolean>}
	 */
	async markAsVerifying(request_id, depth = 0) {
		let success = false;

		if (depth > 200) {
			this.logger.error(`markAsVerifying() max retries for request -> ${request_id}`);
			return success;
		}
		try {
			const res = await pool.query(
				`UPDATE ${tableNames.minion_assign} SET verifying = $1 WHERE request_id = $2 AND server_id = $3`,
				[true, request_id, SERVER_ID]
			);

			success = true;
		} catch (error) {
			this.logger.error(`markAsVerifying() error -> ${error?.toString()}`);
		} finally {
			depth++;
			if (success) return success;

			await promiseAwaitMs(100);
			return await this.markAsVerifying(request_id, depth);
		}
	}

	/**
	 * Mark the request as 'greylisted' in the database
	 * @private
	 * @param {string} request_id
	 * @param {number} depth
	 * @returns {Promise<boolean>}
	 */
	async markGreylisted(request_id, depth = 0) {
		let success = false;

		if (depth > 200) {
			this.logger.error(`markAsVerifying() max retries for request -> ${request_id}`);
			return success;
		}
		try {
			const now = new Date().toISOString();
			const res = await pool.query(
				`UPDATE ${tableNames.minion_assign} SET greylist_found = $1, greylist_found_at = $2 WHERE request_id = $3 AND server_id = $4`,
				[true, now, request_id, SERVER_ID]
			);

			success = true;
		} catch (error) {
			this.logger.error(`markGreylisted() error -> ${error?.toString()}`);
		} finally {
			depth++;
			if (success) return success;

			await promiseAwaitMs(100);
			return await this.markGreylisted(request_id, depth);
		}
	}

	/**
	 * Mark the request as 'blacklisted' in the database
	 * @private
	 * @param {string} request_id
	 * @param {number} depth
	 * @returns {Promise<boolean>}
	 */
	async markBlacklisted(request_id, depth = 0) {
		let success = false;

		if (depth > 200) {
			this.logger.error(`markAsVerifying() max retries for request -> ${request_id}`);
			return success;
		}
		try {
			const now = new Date().toISOString();
			const res = await pool.query(
				`UPDATE ${tableNames.minion_assign} SET blacklist_found = $1, blacklist_found_at = $2 WHERE request_id = $3 AND server_id = $4`,
				[true, now, request_id, SERVER_ID]
			);

			success = true;
		} catch (error) {
			this.logger.error(`markBlacklisted() error -> ${error?.toString()}`);
		} finally {
			depth++;
			if (success) return success;

			await promiseAwaitMs(100);
			return await this.markBlacklisted(request_id, depth);
		}
	}

	/**
	 * Push to the database
	 * @protected
	 * @param {number} workerIndex
	 * @param {RequestObj | null} request
	 */
	async pushDB(workerIndex, request) {
		let success = false;
		try {
			const requestStr = request ? JSON.stringify(request) : '';

			await sqlAsync.runAsync(
				`INSERT INTO ${this.controllerID} (workerIndex, request, created_at) VALUES (?, ?, ?)
				ON CONFLICT (workerIndex) DO UPDATE SET request = EXCLUDED.request, created_at = EXCLUDED.created_at`,
				[workerIndex, requestStr, new Date().getTime()]
			);

			success = true;
		} catch (error) {
			this.logger.error(`pushDB() error -> ${error?.toString()}`);
		} finally {
			return success;
		}
	}

	/** Get from database
	 * @protected
	 * @param {number} workerIndex
	 */
	async pullDB(workerIndex) {
		/** @type {RequestObj | null} */
		let request = null;
		try {
			// get the request from the databases
			/** @type {any} */
			const dbRes = await sqlAsync.getAsync(`SELECT * FROM ${this.controllerID} WHERE workerIndex = ?`, [
				workerIndex,
			]);
			if (dbRes?.request) {
				const requestObj = JSON.parse(dbRes?.request);
				request = {
					request_id: requestObj?.request_id,
					emails: requestObj?.emails,
					response_url: requestObj?.response_url,
				};
			}
		} catch (error) {
			this.logger.error(`pullDB() error -> ${error?.toString()}`);
		} finally {
			return request;
		}
	}

	/** Delete from the database
	 * @protected
	 * @param {number} workerIndex
	 */
	async deleteFromDB(workerIndex) {
		let success = false;
		try {
			await sqlAsync.runAsync(`DELETE FROM ${this.controllerID} WHERE workerIndex = ?`, [workerIndex]);
			success = true;
		} catch (error) {
			this.logger.error(`deleteFromDB() error -> ${error?.toString()}`);
			success = false;
		} finally {
			return success;
		}
	}

	/**
	 * Sync from the database
	 * @private
	 */
	async syncDB() {
		try {
			// get all the requests from the database
			/** @type {any} */
			const workerRequests = await sqlAsync.allAsync(`SELECT * FROM ${this.controllerID} ORDER BY workerIndex`);

			console.log(
				`SYNC worker requests -> `,
				workerRequests?.map((/** @type {any} */ req) => ({
					workerIndex: parseInt(req?.workerIndex || ''),
					requestExists: !!req?.request,
				}))
			);

			for (const workerRequest of workerRequests) {
				const workerIndex = parseInt(workerRequest?.workerIndex || ''),
					request = workerRequest?.request || null,
					created_at = parseInt(workerRequest?.created_at || null);

				// check if the request data can be parsed
				let canParse = false,
					/** @type {RequestObj | null} */
					parsedRequest = null;
				try {
					parsedRequest = JSON.parse(request);
					canParse = true;
				} catch (error) {}

				// delete faulty entries
				if (
					!workerRequest?.workerIndex ||
					!request ||
					!created_at ||
					workerIndex >= this.threads_num ||
					!canParse
				) {
					await sqlAsync.runAsync(`DELETE FROM ${this.controllerID} WHERE id = ?`, [workerRequest?.id]);
					continue;
				}

				// update the assignment and assign the worker
				if (parsedRequest) this.assign(workerIndex, parsedRequest);
			}
		} catch (error) {
			this.logger.error(`syncDB() error -> ${error?.toString()}`);
		}
	}

	/**
	 * Push to the request archive database
	 * @param {string} request_id
	 * @param {RequestObj & {result: Map<string, VerificationObj>, created_at: number}} value
	 */
	async pushArchive(request_id, value) {
		try {
			// Get the constituents of the value
			const result = value?.result || new Map(),
				emails = value?.emails || [],
				response_url = value?.response_url || '',
				created_at = value?.created_at || 0;

			// save the details to the databaes + check for already existing entries
			await sqlAsync.runAsync(
				`INSERT INTO ${this.controllerID}Archive
				(request_id, emails, result, response_url, created_at)
				VALUES (?, ?, ?, ?, ?)
				ON CONFLICT (request_id) DO UPDATE SET result = EXCLUDED.result`,
				[
					request_id,
					JSON.stringify(emails),
					JSON.stringify(Array.from(result.entries())),
					response_url,
					created_at,
				]
			);
		} catch (error) {
			this.logger.error(`pushArchive() error -> ${error?.toString()}`);
		}
	}

	/**
	 * Sync to the request archive database
	 * @param {string} request_id
	 */
	// async syncArchive(request_id) {
	// 	try {
	// 		// purge old entries
	// 		this.purgeArchive();

	// 		/** @type {any} */
	// 		const archiveRes = await sqlAsync.allAsync(`SELECT * FROM ${this.controllerID}Archive`);

	// 		for (const arch of archiveRes) {
	// 			const request_id = arch?.request_id || '',
	// 				emails = JSON.parse(arch?.emails || '[]'),
	// 				response_url = arch?.response_url || '',
	// 				result = new Map(JSON.parse(arch?.result || '[]')),
	// 				created_at = parseInt(arch?.created_at || '');

	// 			this.request_archive.set(request_id, {
	// 				request_id,
	// 				emails,
	// 				response_url,
	// 				result,
	// 				created_at,
	// 			});
	// 		}
	// 	} catch (error) {
	// 		this.logger.error(`syncArchive() error -> `, error);
	// 	}
	// }

	/**
	 * Purge unnecessary archive entries
	 */
	// async purgeArchive() {
	// 	try {
	// 		const now = new Date().getTime(),
	// 			deadline = now - 1000 * 60 * 60 * 24; // delete entries from 1 day ago

	// 		await sqlAsync.runAsync(`DELETE FROM ${this.controllerID}Archive WHERE created_at < ?`, [deadline]);
	// 	} catch (error) {
	// 		this.logger.error(`purgeArchive() error -> `, error);
	// 	}
	// }

	/**
	 * Continuous purging trigger
	 */
	// async purgeArchiveRec() {
	// 	try {
	// 		await this.purgeArchive();
	// 	} catch (error) {
	// 		this.logger.error(`purgeArchiveRec() error -> `, error);
	// 	} finally {
	// 		await promiseAwait(10); // run every 10 seconds

	// 		this.purgeArchiveRec();
	// 	}
	// }

	/**
	 * This process will handle ping from the worker & will update the workers_last_ping time
	 * @param {number} workerIndex
	 */
	ping(workerIndex) {
		this.workers_last_ping[workerIndex] = new Date().getTime();
		// console.log(`Ping from worker ${workerIndex}`);
	}
}

const controller = new Controller(`controller0`);

module.exports = controller;
module.exports.Controller = Controller;
