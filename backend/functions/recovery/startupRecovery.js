const winston = require('winston');
const { loggerTypes } = require('../logging/logger');
const sqlAsync = require('../../database/sqlAsync');
const queue = require('../staging/queue');
const { updateVerificationStatus, updateVerificationResults } = require('../route_fns/verify/verificationDB');

/**
 * @typedef {Object} OrphanRequest
 * @property {string} request_id
 * @property {string} status
 * @property {number} created_at
 * @property {number} total_emails
 * @property {number} completed_emails
 * @property {string} [source] - Source of orphan detection: 'results' or 'archive'
 */

/**
 * @typedef {Object} RecoveryStats
 * @property {number} archivesRestored
 * @property {number} orphansFound
 * @property {number} orphansRequeued
 * @property {number} orphansCompleted
 * @property {number} orphansFailed
 * @property {number} orphansWaitingGreylist
 * @property {number} errorsEncountered
 * @property {string[]} recoveredRequestIds
 */

/**
 * Startup Recovery Module
 * Handles detection and recovery of orphaned requests during system startup
 */
class StartupRecovery {
	constructor() {
		this.logger = winston.loggers.get(loggerTypes.startupRecovery);
		this.controllerID = 'controller0';
	}

	/**
	 * Main recovery entry point
	 * @param {import('../verifier/controller').Controller} controller - Controller instance
	 * @param {import('../verifier/antiGreylisting').AntiGreylisting} antiGreylisting - AntiGreylisting instance
	 * @returns {Promise<RecoveryStats>}
	 */
	async runRecovery(controller, antiGreylisting) {
		/** @type {RecoveryStats} */
		const stats = {
			archivesRestored: controller.request_archive.size,
			orphansFound: 0,
			orphansRequeued: 0,
			orphansCompleted: 0,
			orphansFailed: 0,
			orphansWaitingGreylist: 0,
			errorsEncountered: 0,
			recoveredRequestIds: [],
		};

		try {
			this.logger.info('=== STARTUP RECOVERY INITIATED ===');
			this.logger.info(`Archives in memory: ${stats.archivesRestored}`);

			// Step 1.2: Identify true orphans
			const orphans = await this.identifyOrphans(controller, antiGreylisting);
			stats.orphansFound = orphans.length;

			this.logger.info(`Found ${orphans.length} potential orphan requests`);

			if (orphans.length === 0) {
				this.logger.info('No orphans found - recovery complete');
				return stats;
			}

			// Process each orphan
			for (const orphan of orphans) {
				try {
					const result = await this.recoverOrphan(orphan, controller, antiGreylisting);

					switch (result.action) {
						case 'completed':
							stats.orphansCompleted++;
							break;
						case 'requeued':
							stats.orphansRequeued++;
							break;
						case 'waiting_greylist':
							stats.orphansWaitingGreylist++;
							break;
						case 'failed':
							stats.orphansFailed++;
							break;
					}

					stats.recoveredRequestIds.push(orphan.request_id);

					const sourceInfo = orphan.source === 'archive' ? ' [orphaned archive]' : '';
					this.logger.info(
						`Recovered ${orphan.request_id}: ${result.action} (${result.reason})${sourceInfo}`
					);
				} catch (error) {
					stats.errorsEncountered++;
					this.logger.error(
						`Failed to recover ${orphan.request_id}: ${error?.toString()}`
					);
				}
			}

			this.logger.info('=== STARTUP RECOVERY COMPLETE ===');
			this.logger.info(
				`Summary: ${stats.orphansCompleted} completed, ${stats.orphansRequeued} requeued, ` +
					`${stats.orphansWaitingGreylist} waiting greylist, ${stats.orphansFailed} failed, ` +
					`${stats.errorsEncountered} errors`
			);

			return stats;
		} catch (error) {
			this.logger.error(`runRecovery() error -> ${error?.toString()}`);
			throw error;
		}
	}

	/**
	 * Step 1.2: Identify True Orphans
	 * @param {import('../verifier/antiGreylisting').AntiGreylisting} antiGreylisting - AntiGreylisting instance
	 * @returns {Promise<OrphanRequest[]>}
	 */
	async identifyOrphans(controller, antiGreylisting) {
		try {
			const sevenDaysAgo = new Date().getTime() - 1000 * 60 * 60 * 24 * 7;

			// Check 1: Get all requests in processing or queued state within last 7 days from Results table
			/** @type {any[]} */
			const potentialOrphansFromResults = await sqlAsync.allAsync(
				`SELECT request_id, status, created_at, total_emails, completed_emails
				 FROM ${this.controllerID}Results
				 WHERE status IN ('processing', 'queued')
				 AND verifying = 0
				 AND created_at > ?
				 ORDER BY created_at ASC`,
				[sevenDaysAgo]
			);

		// BUG #8 FIX: Handle expired orphans (>7 days old)
		// CRITICAL: Query for requests older than 7 days and mark as failed
		/** @type {any[]} */
		const expiredOrphans = await sqlAsync.allAsync(
			`SELECT request_id, status, created_at, total_emails, completed_emails
			 FROM ${this.controllerID}Results
			 WHERE status IN ('processing', 'queued')
			 AND verifying = 0
			 AND created_at <= ?
			 ORDER BY created_at ASC`,
			[sevenDaysAgo]
		);

		// Mark all expired orphans as failed and update verification_requests
		if (expiredOrphans.length > 0) {
			this.logger.info(`Found ${expiredOrphans.length} expired orphans (>7 days old)`);
			
			for (const expired of expiredOrphans) {
				const daysSinceCreation = Math.floor((Date.now() - expired.created_at) / (1000 * 60 * 60 * 24));
				
				// Update controller0Results
				await sqlAsync.runAsync(
					`UPDATE ${this.controllerID}Results SET status = 'failed', verifying = 0 WHERE request_id = ?`,
					[expired.request_id]
				);
				
				// Update verification_requests table so users can query via API
				try {
					await updateVerificationStatus(expired.request_id, 'failed');
					this.logger.debug(`Updated verification_requests status to failed for expired ${expired.request_id}`);
				} catch (error) {
					this.logger.error(`Failed to update verification_requests for ${expired.request_id}: ${error?.toString()}`);
				}
				
				this.logger.warn(
					`Marked ${expired.request_id} as FAILED (expired after ${daysSinceCreation} days)`
				);
			}
		}



			this.logger.debug(`Check 1: Found ${potentialOrphansFromResults.length} potential orphans in Results table`);

			// Check 2: Get archives without corresponding Results entries (orphaned archives)
			/** @type {any[]} */
			const orphanedArchives = await sqlAsync.allAsync(
				`SELECT a.request_id, a.created_at
				 FROM ${this.controllerID}Archive a
				 LEFT JOIN ${this.controllerID}Results r ON a.request_id = r.request_id
				 WHERE r.request_id IS NULL
				 AND a.created_at > ?
				 ORDER BY a.created_at ASC`,
				[sevenDaysAgo]
			);

			this.logger.debug(`Check 2: Found ${orphanedArchives.length} orphaned archives without Results entries`);

			// Combine both sources into potential orphans list
			const potentialOrphansMap = new Map();

			// Add from Results table
			for (const orphan of potentialOrphansFromResults) {
				potentialOrphansMap.set(orphan.request_id, {
					request_id: orphan.request_id,
					status: orphan.status,
					created_at: orphan.created_at,
					total_emails: orphan.total_emails || 0,
					completed_emails: orphan.completed_emails || 0,
					source: 'results',
				});
			}

			// Add orphaned archives (mark as 'processing' by default)
			for (const archive of orphanedArchives) {
				if (!potentialOrphansMap.has(archive.request_id)) {
					potentialOrphansMap.set(archive.request_id, {
						request_id: archive.request_id,
						status: 'processing', // Default status for orphaned archives
						created_at: archive.created_at,
						total_emails: 0,
						completed_emails: 0,
						source: 'archive',
					});
				}
			}

			const potentialOrphans = Array.from(potentialOrphansMap.values());
			this.logger.debug(`Total potential orphans: ${potentialOrphans.length}`);

			// Check 3: Apply exclusion filters to find TRUE orphans
			const trueOrphans = [];

			for (const orphan of potentialOrphans) {
				const request_id = orphan.request_id;

				// Check 1: Is it in the queue table? (being processed)
				const inQueue = await this.isInQueue(request_id);
				if (inQueue) {
					this.logger.debug(`${request_id} is in queue - NOT an orphan`);
					continue;
				}

				// Check 2: Is it assigned to a worker? (being processed)
				const hasWorkerAssignment = await this.hasWorkerAssignment(request_id);
				if (hasWorkerAssignment) {
					this.logger.debug(`${request_id} has worker assignment - NOT an orphan`);
					continue;
				}

				// Check 3: Is it in antigreylisting? (SMART CHECK - BUG #7 FIX v2)
				// CRITICAL: If greylisting is ACTIVE (returned=0), ALWAYS exclude
				const greylistEntry = await this.getGreylistFromDB(request_id);
				if (greylistEntry) {
					// PRIORITY 1: Check if greylisting is still active
					if (greylistEntry.returned === 0) {
						// Still actively greylisting → ALWAYS EXCLUDE (regardless of accountedFor)
						this.logger.debug(`${request_id} in antigreylisting (active) - NOT an orphan`);
						continue;
					}

					// PRIORITY 2: Greylisting has returned (returned=1), check if all accounted
					const archive = controller.request_archive.get(request_id);
					const verifiedCount = archive && archive.result ? archive.result.size : 0;
					const greylistedCount = greylistEntry.emails.length;
					const totalEmails = orphan.total_emails || 0;
					const accountedFor = verifiedCount + greylistedCount;

					if (accountedFor >= totalEmails && totalEmails > 0) {
						// Greylisting returned AND all emails accounted → COMPLETE
						this.logger.debug(
							`${request_id} in antigreylisting (returned) BUT all ${totalEmails} emails accounted ` +
								`(${verifiedCount} verified + ${greylistedCount} greylisted) - PROCESS as orphan`
						);
						// Don't continue - let it be processed as completed
					} else {
						// Greylisting returned but not all accounted → re-queue remaining
						this.logger.debug(
							`${request_id} in antigreylisting (returned) with remaining emails - PROCESS as orphan`
						);
						// Don't continue - let it be processed to re-queue
					}
				}

				// If none of the exclusions apply, it's a TRUE ORPHAN
				trueOrphans.push({
					request_id: orphan.request_id,
					status: orphan.status,
					created_at: orphan.created_at,
					total_emails: orphan.total_emails || 0,
					completed_emails: orphan.completed_emails || 0,
				});
			}

			return trueOrphans;
		} catch (error) {
			this.logger.error(`identifyOrphans() error -> ${error?.toString()}`);
			throw error;
		}
	}

	/**
	 * Recover a single orphan request
	 * @param {OrphanRequest} orphan
	 * @param {import('../verifier/controller').Controller} controller
	 * @param {import('../verifier/antiGreylisting').AntiGreylisting} antiGreylisting
	 * @returns {Promise<{action: string, reason: string}>}
	 */
	async recoverOrphan(orphan, controller, antiGreylisting) {
		try {
			const request_id = orphan.request_id;

			// Step 1.3: Calculate remaining emails
			const emailAnalysis = await this.calculateRemainingEmails(request_id, controller, antiGreylisting);

			if (!emailAnalysis) {
				// No archive data - mark as failed
				await controller.updateResultsDB(request_id, {
					status: 'failed',
					verifying: false,
				});
				// Sync to verification_requests table so user can see failure
				try {
					await updateVerificationStatus(request_id, 'failed');
					this.logger.debug(`Synced ${request_id} failure to verification_requests table`);
				} catch (error) {
					this.logger.error(`Failed to sync to verification_requests: ${error?.toString()}`);
				}

				this.logger.error(`✗ Failed ${request_id}: status='failed', no archive data found`);
				return { action: 'failed', reason: 'No archive data found' };
			}

			const { allEmails, verifiedEmails, greylistedEmails, remainingEmails } = emailAnalysis;

			this.logger.debug(
				`${request_id}: ${allEmails.length} total, ${verifiedEmails.length} verified, ` +
					`${greylistedEmails.length} greylisted, ${remainingEmails.length} remaining`
			);

			// Step 1.4: Clear stale worker assignments
			await this.clearWorkerAssignments(request_id);

		// Step 1.5: Decision tree for recovery action
		// CRITICAL: Distinguish between truly complete vs waiting for greylisting
		if (remainingEmails.length === 0 && greylistedEmails.length === 0) {
			// Case A: Truly complete - all verified, no greylisting, no remaining
			return await this.completeOrphan(request_id, controller);

		} else if (remainingEmails.length === 0 && greylistedEmails.length > 0) {
			// Case C: All accounted but pending greylisting - let antiGreylisting handle it
			// DO NOT mark as completed, DO NOT delete archive, DO NOT send webhook
			// Archive stays in memory for merge when greylisting completes
			this.logger.info(
				`✓ ${request_id}: ${greylistedEmails.length} emails pending greylist retry, ` +
				`${verifiedEmails.length} verified, archive preserved for merge`
			);
			return {
				action: 'waiting_greylist',
				reason: `${greylistedEmails.length} emails in antiGreylisting queue`
			};

		} else if (remainingEmails.length > 0) {
			// Case B: Has remaining unprocessed emails - re-queue
			return await this.requeueOrphan(request_id, remainingEmails, controller);

		} else {
			// Shouldn't reach here, but handle gracefully
			await controller.updateResultsDB(request_id, {
				status: 'failed',
				verifying: false,
			});
			// Sync to verification_requests table so user can see failure
			try {
				await updateVerificationStatus(request_id, 'failed');
				this.logger.debug(`Synced ${request_id} failure to verification_requests table`);
			} catch (error) {
				this.logger.error(`Failed to sync to verification_requests: ${error?.toString()}`);
			}

			this.logger.error(`✗ Failed ${request_id}: status='failed', unknown state`);
			return { action: 'failed', reason: 'Unknown state' };
		}
		} catch (error) {
			this.logger.error(`recoverOrphan() error -> ${error?.toString()}`);
			throw error;
		}
	}

	/**
	 * Step 1.3: Calculate remaining emails for an orphan
	 * @param {string} request_id
	 * @param {import('../verifier/controller').Controller} controller
	 * @param {import('../verifier/antiGreylisting').AntiGreylisting} antiGreylisting
	 * @returns {Promise<{allEmails: string[], verifiedEmails: string[], greylistedEmails: string[], remainingEmails: string[]} | null>}
	 */
	async calculateRemainingEmails(request_id, controller, antiGreylisting) {
		try {
			// Get archive data
			const archive = controller.request_archive.get(request_id);

			if (!archive) {
				this.logger.warn(`No archive found for ${request_id}`);
				return null;
			}

			// Safety 3.3: Validate archive data
			if (!this.validateArchiveData(archive)) {
				this.logger.error(`Invalid archive data for ${request_id}`);
				return null;
			}

			const allEmails = Array.isArray(archive.emails) ? archive.emails : [];
			const verifiedEmails = archive.result ? Array.from(archive.result.keys()) : [];

			// Get greylisted emails from antiGreylisting database directly
			let greylistedEmails = [];
			const greylistEntry = await this.getGreylistFromDB(request_id);
			if (greylistEntry) {
				greylistedEmails = greylistEntry.emails || [];
			}

			// Calculate remaining: all - verified - greylisted
			const verifiedSet = new Set(verifiedEmails);
			const greylistedSet = new Set(greylistedEmails);

			const remainingEmails = allEmails.filter(
				email => !verifiedSet.has(email) && !greylistedSet.has(email)
			);

			return {
				allEmails,
				verifiedEmails,
				greylistedEmails,
				remainingEmails,
			};
		} catch (error) {
			this.logger.error(`calculateRemainingEmails() error -> ${error?.toString()}`);
			return null;
		}
	}

	/**
	 * Step 1.4: Clear stale worker assignments for a request
	 * @param {string} request_id
	 */
	async clearWorkerAssignments(request_id) {
		try {
			// Get all worker assignments with this request_id
			/** @type {any[]} */
			const assignments = await sqlAsync.allAsync(
				`SELECT id, workerIndex, request FROM ${this.controllerID}`,
				[]
			);

			let clearedCount = 0;

			for (const assignment of assignments) {
				try {
					const requestObj = JSON.parse(assignment.request || '{}');
					if (requestObj.request_id === request_id) {
						await sqlAsync.runAsync(`DELETE FROM ${this.controllerID} WHERE id = ?`, [
							assignment.id,
						]);
						clearedCount++;
					}
				} catch (parseError) {
					// Ignore parse errors, continue with other assignments
				}
			}

			if (clearedCount > 0) {
				this.logger.debug(`Cleared ${clearedCount} stale worker assignments for ${request_id}`);
			}
		} catch (error) {
			this.logger.error(`clearWorkerAssignments() error -> ${error?.toString()}`);
		}
	}

	/**
	 * Step 1.5 Case A: Complete an orphan with all emails verified
	 * @param {string} request_id
	 * @param {import('../verifier/controller').Controller} controller
	 * @returns {Promise<{action: string, reason: string}>}
	 */
	async completeOrphan(request_id, controller) {
		try {
			// SAFETY CHECK: Should never be called with pending greylisting
			const greylistEntry = await this.getGreylistFromDB(request_id);
			if (greylistEntry && greylistEntry.emails.length > 0) {
				this.logger.error(
					`BUG: completeOrphan() called for ${request_id} but has ` +
					`${greylistEntry.emails.length} greylisted emails! Aborting completion.`
				);
				return {
					action: 'waiting_greylist',
					reason: 'Cannot complete with pending greylisting'
				};
			}

			const archive = controller.request_archive.get(request_id);

			if (!archive) {
				return { action: 'failed', reason: 'No archive data for completion' };
			}

			const resultArr = Array.from(archive.result.values());
			const resultLen = resultArr.length;

			// Mark as completed in controller0Results
			await controller.updateResultsDB(request_id, {
				status: 'completed',
				verifying: false,
				results: JSON.stringify(resultArr),
				total_emails: resultLen,
				completed_emails: resultLen,
				completed_at: new Date().getTime(),
			});

			this.logger.debug(`Marked ${request_id} as completed in controller database`);

			// Update verification_requests table
			try {
				const transformedResults = controller.transformResultsForAPI(resultArr);
				await updateVerificationResults(request_id, transformedResults);
				this.logger.debug(`Synced ${request_id} to verification_requests table`);
			} catch (error) {
				this.logger.error(`Failed to sync results to verification_requests: ${error?.toString()}`);
			}

			// Check webhook status and send if needed
			// At this point, greylisting is guaranteed complete (checked at function start)
			let webhookStatus = 'no_url';
			const status = await controller.getRequestStatus(request_id);
			if (status) {
				const webhookSent = status.webhook_sent;
				const webhookAttempts = status.webhook_attempts || 0;

				if (archive.response_url && !webhookSent && webhookAttempts < 5) {
					this.logger.debug(`Sending callback for recovered request ${request_id}`);
					await controller.sendResultsCallback(
						request_id,
						archive.response_url,
						resultArr,
						resultLen
					);
					webhookStatus = 'sent';
				} else if (archive.response_url && webhookSent) {
					webhookStatus = 'already_sent';
				} else if (archive.response_url && webhookAttempts >= 5) {
					webhookStatus = 'failed_max_attempts';
				} else if (!archive.response_url) {
					// No response_url - mark as sent to prevent future attempts
					await controller.updateResultsDB(request_id, {
						webhook_sent: true,
						webhook_attempts: 0,
					});
					webhookStatus = 'no_url';
				}
			}

			// Cleanup archive from memory
			controller.request_archive.delete(request_id);

			this.logger.info(`✓ Completed ${request_id}: status='completed', ${resultLen} emails verified, webhook=${webhookStatus}`);

			return { action: 'completed', reason: `All ${resultLen} emails verified` };
		} catch (error) {
			this.logger.error(`completeOrphan() error -> ${error?.toString()}`);
			throw error;
		}
	}

	/**
	 * Step 1.5 Case B: Re-queue an orphan with remaining emails
	 * @param {string} request_id
	 * @param {string[]} remainingEmails
	 * @param {import('../verifier/controller').Controller} controller
	 * @returns {Promise<{action: string, reason: string}>}
	 */
	async requeueOrphan(request_id, remainingEmails, controller) {
		try {
			const archive = controller.request_archive.get(request_id);

			if (!archive) {
				return { action: 'failed', reason: 'No archive data for requeue' };
			}

			// Double-check current status (safety check BUG #12)
			const currentStatus = await controller.getRequestStatus(request_id);
			if (currentStatus && currentStatus.status === 'completed') {
				this.logger.warn(`${request_id} already completed - skipping requeue`);
				return { action: 'completed', reason: 'Already completed' };
			}

			// Use INSERT OR IGNORE for queue table (BUG #7 idempotency)
			const response_url = archive.response_url || '';

			// CRITICAL FIX (BUG #4): Use direct database insertion to avoid deadlock
			// Cannot call queue.add() during recovery because it waits for queue.ready === true
			// But queue.ready won't be true until after recovery completes (circular dependency)
			const result = await this.addToQueueDB(request_id, remainingEmails, response_url);

			if (result.success) {
				// Update status to queued (marking as queued so we know recovery re-queued it)
				await controller.updateResultsDB(request_id, {
					status: 'queued',
					verifying: false,
				});

				this.logger.info(`✓ Re-queued ${request_id}: status set to 'queued', ${remainingEmails.length} emails remaining`);

				return { action: 'requeued', reason: `${remainingEmails.length} emails remaining` };
			} else {
				// Failed to add to queue - this shouldn't happen with INSERT OR IGNORE
				this.logger.error(`✗ Failed to re-queue ${request_id}: ${result.msg}`);
				return { action: 'failed', reason: result.msg };
			}
		} catch (error) {
			this.logger.error(`requeueOrphan() error -> ${error?.toString()}`);
			throw error;
		}
	}

	/**
	 * Helper: Check if request is in queue (queries database directly to avoid false negatives)
	 * @param {string} request_id
	 * @returns {Promise<boolean>}
	 */
	async isInQueue(request_id) {
		try {
			// CRITICAL: Query database directly since queue hasn't synced in-memory Set yet
			// queue.hasRequestId() would return false during recovery even if request IS in queue
			/** @type {any} */
			const result = await sqlAsync.getAsync(
				`SELECT request_id FROM queue WHERE request_id = ?`,
				[request_id]
			);
			return !!result;
		} catch (error) {
			this.logger.error(`isInQueue() error -> ${error?.toString()}`);
			return false;
		}
	}

	/**
	 * Helper: Check if request has worker assignment
	 * @param {string} request_id
	 * @returns {Promise<boolean>}
	 */
	async hasWorkerAssignment(request_id) {
		try {
			/** @type {any[]} */
			const assignments = await sqlAsync.allAsync(
				`SELECT request FROM ${this.controllerID}`,
				[]
			);

			for (const assignment of assignments) {
				try {
					const requestObj = JSON.parse(assignment.request || '{}');
					if (requestObj.request_id === request_id) {
						return true;
					}
				} catch (parseError) {
					// Ignore parse errors
				}
			}

			return false;
		} catch (error) {
			this.logger.error(`hasWorkerAssignment() error -> ${error?.toString()}`);
			return false;
		}
	}

	/**
	 * Helper: Get greylist entry from database directly
	 * @param {string} request_id
	 * @returns {Promise<{emails: string[], returned: number} | null>}
	 */
	async getGreylistFromDB(request_id) {
		try {
			/** @type {any} */
			const result = await sqlAsync.getAsync(
				`SELECT emails, returned FROM antigreylisting WHERE request_id = ?`,
				[request_id]
			);

			if (result && result.emails) {
				// CRITICAL: emails are stored as semicolon-separated strings, not JSON
				const emailsArray = result.emails.split(';').filter(e => e.trim());
				return {
					emails: emailsArray,
					returned: result.returned || 0,
				};
			}

			return null;
		} catch (error) {
			this.logger.error(`getGreylistFromDB() error -> ${error?.toString()}`);
			return null;
		}
	}

	/**
	 * Helper: Check if request exists in antigreylisting database (direct query to avoid deadlock)
	 * @param {string} request_id
	 * @returns {Promise<boolean>}
	 */
	async existsInAntiGreylistDB(request_id) {
		try {
			/** @type {any} */
			const result = await sqlAsync.getAsync(
				`SELECT COUNT(*) as count FROM antigreylisting WHERE request_id = ?`,
				[request_id]
			);

			return result && result.count > 0;
		} catch (error) {
			this.logger.error(`existsInAntiGreylistDB() error -> ${error?.toString()}`);
			return false;
		}
	}

	/**
	 * Helper: Add request directly to queue database (bypasses queue.add() to avoid deadlock during recovery)
	 * @param {string} request_id
	 * @param {string[]} emails
	 * @param {string} response_url
	 * @returns {Promise<{success: boolean, msg: string}>}
	 */
	async addToQueueDB(request_id, emails, response_url) {
		try {
			// CRITICAL: Use INSERT OR IGNORE to handle idempotency
			// During recovery, we insert directly into DB without waiting for queue.ready
			// The in-memory structures will be populated during queue.sync_pull() after recovery completes
			await sqlAsync.runAsync(
				`INSERT OR IGNORE INTO queue (request_id, emails, response_url) VALUES (?, ?, ?)`,
				[request_id, emails.join(';'), response_url]
			);

			this.logger.info(`✓ Inserted ${request_id} directly into queue database (${emails.length} emails)`);

			return {
				success: true,
				msg: 'Successfully added to queue database during recovery',
			};
		} catch (error) {
			this.logger.error(`addToQueueDB() error -> ${error?.toString()}`);
			return {
				success: false,
				msg: error?.toString() || 'Failed to add to queue database',
			};
		}
	}

	/**
	 * Safety 3.3: Validate archive data structure
	 * @param {any} archive
	 * @returns {boolean}
	 */
	validateArchiveData(archive) {
		try {
			// Check required fields exist
			if (!archive.request_id || !archive.emails || !archive.result) {
				this.logger.warn('Archive missing required fields');
				return false;
			}

			// Check data types
			if (!Array.isArray(archive.emails)) {
				this.logger.warn('Archive emails is not an array');
				return false;
			}

			if (!(archive.result instanceof Map)) {
				this.logger.warn('Archive result is not a Map');
				return false;
			}

			// Check response_url is string (can be empty)
			if (typeof archive.response_url !== 'string') {
				this.logger.warn('Archive response_url is not a string');
				return false;
			}

			// Validate emails array is not empty
			if (archive.emails.length === 0) {
				this.logger.warn('Archive emails array is empty');
				return false;
			}

			return true;
		} catch (error) {
			this.logger.error(`validateArchiveData() error -> ${error?.toString()}`);
			return false;
		}
	}
}

module.exports = StartupRecovery;
