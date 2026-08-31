import { requireActiveRuntime } from "../../_internal/active-runtime/activeRuntime";

/**
 * Counts the gateway requests currently on the wire.
 *
 * Exists for ONE consumer: intent prefetch, which must never compete with a
 * request the app is actually waiting for. The priority ladder is
 *
 *   SSE  >  ordinary request  >  route chunk  >  prefetch
 *
 * and prefetch is the only participant that can be dropped for free — the screen
 * that needs the data fetches it itself. Without a probe the rule could only be
 * documented, not enforced.
 *
 * Deliberately a plain counter, not a queue or a scheduler: it answers "is
 * anything else in flight right now". It cannot tell a prefetch from an ordinary
 * read — every request goes through the same `ALankaRequest.execute` — so the
 * prefetcher subtracts its OWN in-flight count from this total. Accounting lives
 * at the single choke point, in a `finally`: a rejected request that never
 * decremented would disable prefetching for the rest of the session.
 */
export interface ILankaInFlightCounter {
	/** Called by `ALankaRequest.execute` before sending. */
	begin(): void;
	/** Called by `ALankaRequest.execute` in `finally`, on success and on failure. */
	end(): void;
	getActiveCount(): number;
	/**
	 * Notifies of a change in the count. Returns an unsubscribe function.
	 *
	 * What the counter exists for: `@lankajs/plugin-prefetch` stands down while
	 * another request is on the wire, and polling the counter in a loop would be a
	 * poor substitute for a notification.
	 */
	subscribe(listener: (activeCount: number) => void): () => void;
}

/**
 * The counter belongs to a framework instance.
 *
 * A module-level counter needs a `resetForTests()`, which is the sign that state
 * lives in the wrong place: a test cannot get a clean counter, only ask a shared
 * one to forget.
 */
export function createInFlightCounter(): ILankaInFlightCounter {
	let activeCount = 0;
	const listeners = new Set<(activeCount: number) => void>();

	const notify = (): void => {
		// A copy, not the set itself: a subscriber may unsubscribe inside its own
		// handler, and iterating the original would skip a neighbour.
		for (const listener of [...listeners]) listener(activeCount);
	};

	return {
		begin: (): void => {
			activeCount += 1;
			notify();
		},
		end: (): void => {
			activeCount = Math.max(0, activeCount - 1);
			notify();
		},
		getActiveCount: (): number => activeCount,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

/**
 * Ambient counter: the active instance's, reachable without holding it.
 *
 * Used by `ALankaRequest`, which every gateway request passes through and which
 * has no instance reference. Instance holders read `lanka.inFlight`.
 */
export const lankaHttpInFlight: ILankaInFlightCounter = {
	begin: (): void => requireActiveRuntime().inFlight.begin(),
	end: (): void => requireActiveRuntime().inFlight.end(),
	getActiveCount: (): number => requireActiveRuntime().inFlight.getActiveCount(),
	subscribe: (listener) => requireActiveRuntime().inFlight.subscribe(listener),
};
