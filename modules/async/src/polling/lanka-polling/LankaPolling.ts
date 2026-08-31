import { ILankaPollingConfig } from "../_interfaces/ILankaPollingConfig";
import { TLankaPollingCallback } from "../_types/TLankaPollingCallback";
import { generateUuid } from "lanka/internal";
import { lankaLogger } from "lanka/logger";

/**
 * Repeating work, held for as long as the screen that wants it.
 *
 * One of these per screen: subscribe returns an id, and the screen clears it on
 * the way out. The interval is not a timer a caller manages — an execution never
 * overlaps its predecessor, which is what a naked `setInterval` cannot promise
 * over an async callback.
 *
 * `createLankaPolling()` builds the same class for a caller who does not want a
 * `new`; the two are one implementation.
 */
export class LankaPolling {
	private subscriptions = new Map<string, ILankaPollingConfig>();
	private timers = new Map<string, ReturnType<typeof setTimeout> | null>();
	private isExecuting = new Map<string, boolean>();

	/**
	 * Subscribe to a polling task.
	 *
	 * @param callback - async function to be executed at intervals
	 * @param intervalMs - delay between executions (ms)
	 * @param initialDelayMs - initial delay before the first execution (ms)
	 * @returns unique subscription id
	 */
	subscribe<T>(
		callback: TLankaPollingCallback<T>,
		intervalMs: number,
		initialDelayMs = 0,
	): string {
		const id = generateUuid();

		this.subscriptions.set(id, {
			id,
			callback,
			intervalMs,
			initialDelayMs,
		});

		this.isExecuting.set(id, false);
		this.beginPollingLoop(id);

		return id;
	}

	/**
	 * Internal loop runner for a given subscription.
	 *
	 * Synchronous on purpose: it only ARMS the first timer and returns. The
	 * awaiting happens inside `executePoll`, which the timer invokes later.
	 * Declaring this `async` would hand every caller a promise that resolves
	 * before a single poll has run — misleading, and it made the call in
	 * `subscribe` a floating promise for no reason.
	 */
	private beginPollingLoop(id: string): void {
		const subscription = this.subscriptions.get(id);
		if (!subscription) return;

		const executePoll = async () => {
			if (this.isExecuting.get(id)) return;

			this.isExecuting.set(id, true);
			try {
				await subscription.callback();
			} catch (error) {
				lankaLogger.printBootstrapLog(`LankaPolling error for subscription ${id}:`, error);
			} finally {
				this.isExecuting.set(id, false);

				if (this.subscriptions.has(id)) {
					// `void`: executePoll owns its try/catch/finally, so the
					// promise can never reject — the marker tells the linter
					// (and the next reader) that dropping it is deliberate.
					const timer = setTimeout(() => void executePoll(), subscription.intervalMs);
					this.timers.set(id, timer);
				}
			}
		};

		const timer = setTimeout(() => void executePoll(), subscription.initialDelayMs);
		this.timers.set(id, timer);
	}

	/**
	 * Stop a subscription by its ID.
	 */
	unsubscribe(id: string): void {
		const timer = this.timers.get(id);
		if (timer != null) {
			clearTimeout(timer);
			this.timers.delete(id);
		}
		this.subscriptions.delete(id);
		this.isExecuting.delete(id);
	}

	/**
	 * Stop all active subscriptions.
	 */
	clearAll(): void {
		this.timers.forEach((timer) => {
			if (timer != null) clearTimeout(timer);
		});
		this.subscriptions.clear();
		this.timers.clear();
		this.isExecuting.clear();
	}
}
