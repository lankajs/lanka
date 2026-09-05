import { lankaHttpInFlight } from "lanka/gateway";
import type { ILankaInstance } from "lanka/bootstrap";

export interface IWaitForLankaIdleOptions {
	/** Whose wire to watch. The active instance by default. */
	lanka?: ILankaInstance;
	/** How long to wait before failing. Defaults to 1000. */
	timeoutMs?: number;
	/**
	 * How many task turns to drain once the wire is clear.
	 *
	 * A request settling is not the end of the work it started: the gateway
	 * resolves, the ViewModel sets state, React re-renders. Two turns cover that
	 * chain; a suite with a longer one raises this rather than sprinkling
	 * `await Promise.resolve()` at call sites.
	 */
	settleTurns?: number;
}

const DEFAULT_TIMEOUT_MS = 1000;
const DEFAULT_SETTLE_TURNS = 2;

/**
 * Waits until nothing is on the wire and the work it started has settled.
 *
 * ## Why this is in the kit
 *
 * Without it every consumer test of a gateway-backed screen ends in
 * `await new Promise((r) => setTimeout(r, 0))`, repeated until it passes. That
 * line is not a wait, it is a guess: it drains ONE turn, so it works until the
 * chain behind the request grows a link, and then it fails in a test nobody
 * touched.
 *
 * ## It REJECTS on its deadline
 *
 * Naming the count still outstanding, because "timed out" with no subject sends
 * the reader to the wrong half of the application. A helper that gave up quietly
 * would let a suite fill with tests that pass without the request finishing —
 * `skills/testing/SKILL.md` §1.
 *
 * ## Real timers
 *
 * It drains real task turns, so under `vi.useFakeTimers()` the test advances the
 * clock itself. The kit's setup file restores real timers before every test, so
 * this is only a question for a test that opts into fake ones.
 */
export const waitForLankaIdle = async (options: IWaitForLankaIdleOptions = {}): Promise<void> => {
	const inFlight = options.lanka?.inFlight ?? lankaHttpInFlight;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const settleTurns = options.settleTurns ?? DEFAULT_SETTLE_TURNS;
	const deadline = Date.now() + timeoutMs;

	// One turn BEFORE looking: an action that has not been awaited yet has not
	// reached the transport, so the counter reads zero and the wire looks clear
	// while the request is one microtask away from starting.
	await nextTurn();

	while (inFlight.getActiveCount() > 0) {
		if (Date.now() > deadline) {
			throw new Error(
				`Waited ${String(timeoutMs)}ms for the wire to clear and ` +
					`${String(inFlight.getActiveCount())} request(s) are still in flight.`,
			);
		}

		await nextTurn();
	}

	for (let turn = 0; turn < settleTurns; turn += 1) await nextTurn();
};

/** One macrotask turn — which drains every microtask queued before it. */
const nextTurn = (): Promise<void> =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, 0);
	});
