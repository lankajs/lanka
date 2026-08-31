import { LankaError } from "lanka/errors";

/**
 * How `runExclusive` ended.
 *
 * Three outcomes rather than a boolean: "not run, already in flight" and "run and
 * failed" must be handled in opposite ways — the first is ignored silently, the
 * second is reported — and a boolean cannot tell them apart.
 */
export type TLankaExclusiveOutcome = "executed" | "failed" | "blocked";

/**
 * Optimistic mutations with real request cancellation.
 *
 * Two strategies, separated not by convenience but by what counts as a failure:
 *
 * - `runLatest` — last click wins. A new call with the same key CANCELS and
 *   supersedes the previous one; the cancelled call runs neither success nor
 *   rollback. For rapid repeated presses where the screen must end on the last
 *   state;
 * - `runExclusive` — a hard per-item lock. While a request for a key is in
 *   flight, further calls with that key do nothing. The lock expires on a
 *   deadline — a hung server would otherwise freeze the button forever. Rollback
 *   happens on ANY failure, cancellation and timeout included: there is no
 *   superseding click to justify skipping it.
 *
 * Both pass an `AbortSignal` to the request callback, which hands it to the
 * gateway: `(signal) => gateway.doThing(id, { signal })`.
 *
 * Works without optimism too: pass an empty `applyOptimistic` (`() => null`) and
 * omit rollback and success — the cancellation behaviour remains.
 */
export class LankaOptimisticActions {
	/** `runLatest`: the current abort controller per key, replaced by each new call. */
	private readonly latestControllers = new Map<string, AbortController>();

	/** `runExclusive`: keys whose request is currently in flight. */
	private readonly exclusiveLocked = new Set<string>();

	// ─────────────────────────────────────────────────────────────
	// runLatest
	// ─────────────────────────────────────────────────────────────

	/**
	 * Applies the optimistic change immediately, cancels the previous request for
	 * the same key and sends a new one.
	 *
	 * Success and rollback run only if this call was not superseded. A cancelled
	 * request does NOT roll back.
	 *
	 * @param key             The slot calls supersede each other in
	 * @param applyOptimistic Applies the state and returns a snapshot for rollback
	 * @param request         The request; receives the abort signal for the gateway
	 * @param rollback        Restores the previous state from the snapshot
	 * @param onSuccess       Receives the server response if not superseded
	 */
	public async runLatest<TSnapshot, TResult = void>(
		key: string,
		applyOptimistic: () => TSnapshot,
		request: (signal: AbortSignal) => Promise<TResult>,
		rollback: (snapshot: TSnapshot) => void,
		onSuccess?: (result: TResult) => void,
	): Promise<void> {
		// Cancel the previous request for this key.
		this.latestControllers.get(key)?.abort();

		const controller = new AbortController();
		this.latestControllers.set(key, controller);

		const snapshot = applyOptimistic();

		const isStillLatest = () => this.latestControllers.get(key) === controller;

		try {
			const result = await request(controller.signal);
			if (isStillLatest()) {
				onSuccess?.(result);
			}
		} catch (error) {
			// Cancellation is not an error as far as the screen is concerned.
			if (isAbortError(error)) return;
			if (isStillLatest()) {
				rollback(snapshot);
			}
		} finally {
			if (isStillLatest()) {
				this.latestControllers.delete(key);
			}
		}
	}

	// ─────────────────────────────────────────────────────────────
	// runExclusive
	// ─────────────────────────────────────────────────────────────

	/**
	 * Default lock deadline.
	 *
	 * Bounds how long a hung request may hold an item before it is aborted and
	 * rolled back: without it one missing server response freezes the button until
	 * a reload.
	 */
	public static readonly DEFAULT_EXCLUSIVE_TIMEOUT_MS = 15_000;

	/**
	 * A hard per-item lock.
	 *
	 * If a request for this key is already in flight, returns "blocked" and does
	 * nothing. Otherwise applies the optimistic change, sends the request and calls
	 * `onSuccess`. On ANY failure — cancellation and timeout included — rolls back.
	 *
	 * @param key             The item key to lock
	 * @param applyOptimistic Applies the state and returns a snapshot for rollback
	 * @param request         The request; receives the abort signal for the gateway
	 * @param rollback        Restores the previous state from the snapshot
	 * @param onSuccess       Receives the server response on success
	 * @param timeoutMs       When to abort the request and roll back
	 * @returns               "executed" — done, "failed" — rolled back,
	 *                        "blocked" — a request for this key is already running
	 */
	public async runExclusive<TSnapshot, TResult = void>(
		key: string,
		applyOptimistic: () => TSnapshot,
		request: (signal: AbortSignal) => Promise<TResult>,
		rollback: (snapshot: TSnapshot) => void,
		onSuccess?: (result: TResult) => void,
		timeoutMs: number = LankaOptimisticActions.DEFAULT_EXCLUSIVE_TIMEOUT_MS,
	): Promise<TLankaExclusiveOutcome> {
		if (this.exclusiveLocked.has(key)) {
			return "blocked";
		}

		this.exclusiveLocked.add(key);
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
		const snapshot = applyOptimistic();

		try {
			const result = await request(controller.signal);
			onSuccess?.(result);
			return "executed";
		} catch {
			rollback(snapshot);
			return "failed";
		} finally {
			clearTimeout(timeoutId);
			this.exclusiveLocked.delete(key);
		}
	}

	// ─────────────────────────────────────────────────────────────
	// State probes: for tests and for derived screen state
	// ─────────────────────────────────────────────────────────────

	/** Whether a `runLatest` request for this key is in flight. */
	public isLatestPending(key: string): boolean {
		return this.latestControllers.has(key);
	}

	/** Whether a `runExclusive` lock is currently held for this key. */
	public isExclusiveLocked(key: string): boolean {
		return this.exclusiveLocked.has(key);
	}
}

/**
 * Cancellation is not an error as far as the screen is concerned.
 *
 * Three forms are recognised because three occur: the framework transport
 * classifies cancellation and throws a `LankaError` with `kind: "aborted"`, the
 * browser throws a `DOMException`, and node throws a plain `Error` with the same
 * `name`.
 *
 * A missed cancellation costs more than an extra string comparison: `runLatest`
 * would roll back state that a fresher click superseded, and the user would watch
 * their last choice undo itself.
 */
function isAbortError(error: unknown): boolean {
	if (LankaError.is(error)) return error.kind === "aborted";
	if (error instanceof DOMException) return error.name === "AbortError";
	return error instanceof Error && error.name === "AbortError";
}
