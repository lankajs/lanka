export interface ILankaBurstCoalescer<TKey> {
	/**
	 * Runs `operation` for `key`, collapsing calls that arrive while one is
	 * already in flight. Every caller receives a promise that settles when the
	 * work COVERING its call finishes.
	 */
	run: (key: TKey, operation: () => Promise<void>) => Promise<void>;
	/** Keys in flight — for tests and diagnostics. */
	pendingKeys: () => TKey[];
}

/**
 * Collapses a burst of identical refreshes into one request plus one trailing
 * request, if events kept arriving while the first was in flight.
 *
 * ## Versus `createLankaLatestGuard`
 *
 * The guard answers "which response may write to state": it stamps a version and
 * a late response learns it lost. That makes a burst CORRECT and does nothing
 * about cost — every event still goes to the network and all responses but one
 * are discarded.
 *
 * One server action can fan out into an event per participant, and a bridge
 * refreshing on each of them turns one user action into one request per
 * participant. Those wasted round trips compete for the wire with the screen's
 * own data.
 *
 * ## Leading + trailing, not plain deduplication
 *
 * Dropping duplicates entirely would be cheaper and WRONG: if every event of the
 * burst arrives while the first request is in flight, state would reflect a read
 * made BEFORE the last change. So a burst produces at most two requests — the
 * one that started it and one after, which is guaranteed to see everything the
 * burst announced.
 *
 * Per key, because refreshes of different entities are different work and must
 * not collapse into each other.
 */
export const createLankaBurstCoalescer = <TKey>(): ILankaBurstCoalescer<TKey> => {
	const inFlight = new Map<TKey, Promise<void>>();
	/** Keys whose in-flight run was asked to repeat when it finishes. */
	const trailing = new Set<TKey>();

	const start = (key: TKey, operation: () => Promise<void>): Promise<void> => {
		const run = (async () => {
			try {
				await operation();
			} catch (error) {
				// A failure clears the requested repeat too. Otherwise the flag would
				// outlive the burst that set it: the code after `throw` never runs, and
				// the NEXT unrelated call for this key would issue an extra request —
				// a refresh nobody asked for, caused by a failure at some earlier time.
				trailing.delete(key);
				throw error;
			} finally {
				// Cleared in `finally`, not only on success: a leftover record would
				// swallow every later refresh for this key, turning one network failure
				// into a permanently stale screen.
				inFlight.delete(key);
			}

			if (trailing.delete(key)) {
				await start(key, operation);
			}
		})();

		inFlight.set(key, run);
		return run;
	};

	return {
		run: (key, operation) => {
			const current = inFlight.get(key);
			if (current) {
				// Asked while the previous one is already on the wire, so the in-flight
				// response may predate their event. Schedule exactly one repeat and
				// hand them the whole chain.
				trailing.add(key);
				return current;
			}
			return start(key, operation);
		},
		pendingKeys: () => [...inFlight.keys()],
	};
};
