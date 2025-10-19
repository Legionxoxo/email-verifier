/**
 * Startup Coordination Module
 *
 * Provides a promise-based gate to synchronize initialization order during system startup.
 *
 * CRITICAL: Recovery MUST complete BEFORE queue and antiGreylisting sync their data.
 *
 * Timeline without coordination:
 * T1: queue.init() → sync_pull() → loads queue (recovery hasn't run yet)
 * T2: antiGreylisting.init() → syncDB() → loads greylist
 * T3: controller.init() → recovery runs → writes orphans to queue DB
 * Result: Orphans written by recovery never loaded into memory → LOST REQUESTS
 *
 * Timeline with coordination:
 * T1: queue.init() → creates table → WAITS at waitForRecovery()
 * T2: antiGreylisting.init() → creates table → WAITS at waitForRecovery()
 * T3: controller.init() → runs recovery → writes orphans to queue DB
 * T4: controller signals markRecoveryComplete()
 * T5: queue UNBLOCKED → sync_pull() → loads queue DB (includes orphans!)
 * T6: antiGreylisting UNBLOCKED → syncDB() → loads greylist DB
 * Result: All orphans successfully recovered ✓
 */
class StartupCoordination {
	constructor() {
		// Promise acts as a gate - stays pending until recovery completes
		this.recoveryPromise = new Promise(resolve => {
			this.signalRecoveryComplete = resolve;
		});
	}

	/**
	 * Controller calls this after recovery completes
	 * This releases queue and antiGreylisting to continue initialization
	 */
	markRecoveryComplete() {
		this.signalRecoveryComplete();
	}

	/**
	 * Queue and antiGreylisting call this before sync
	 * This blocks until controller signals recovery is complete
	 */
	async waitForRecovery() {
		await this.recoveryPromise;
	}
}

const startupCoordination = new StartupCoordination();

module.exports = startupCoordination;
