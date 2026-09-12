import type { TLankaCacheKey } from "../_types/TLankaCacheKey";

/**
 * What a ViewModel calls to avoid asking the server twice.
 *
 * A PORT and nothing else: core declares the shape and ships no cache, because
 * a host framework already carries one and two caches disagree on the first
 * mutation. Where there is no host — a plain Vite SPA — the slot is empty rather
 * than taken, and an application fills it with `@lankajs/tanstack-query`,
 * `@lankajs/nanostores-query`, or an implementation of its own.
 *
 * It sits UNDER the ViewModel: the ViewModel calls it, hands it the loader it
 * got from a gateway, and keeps deciding what a failure means. The screen still
 * reads one hook.
 *
 * ## The clauses an implementation must keep
 *
 * Behaviour, not signatures, is where two honest implementations diverge, so
 * each clause below is a promise and most of them are assertions in
 * `@lankajs/tool-testing`'s `lankaReadCacheConformance`. Run it; do not read a
 * member's source.
 *
 * 1. `subscribe` does NOT deliver the current value. Use `peek` for that.
 * 2. `subscribe` delivers only SETTLED data — never a pending or failed state.
 * 3. The release it answers removes exactly its own listener; a second call
 *    does nothing.
 * 4. `peek` answers what is cached, stale or not. It never fetches and never
 *    throws.
 * 5. `read` answers from memory while fresh; two concurrent reads of one key
 *    call `load` once.
 * 6. `read` rejects with EXACTLY what `load` threw. Wrapping it breaks the
 *    caller: a ViewModel branches on `LankaError.kind`, and a wrapper turns
 *    every failure into the screen's.
 * 7. A failed `read` is not remembered as data; the next one tries again.
 * 8. `invalidate` resolves after the refetch settles when somebody is
 *    subscribed, and marks stale without fetching when nobody is.
 * 9. `write` notifies that key's subscribers before it returns.
 * 10. `clear` empties everything and notifies nobody.
 * 11. `cancel` is declared only if it really aborts.
 * 12. Nothing refetches on its own: only `read` and `invalidate` fetch. A
 *     background revalidation would change what a form was opened on.
 *
 * Four more cannot be checked from inside an implementation, and belong to
 * whoever wires it: a subscriber must not write the key it observes; on a server
 * the cache is per REQUEST, never a module-level singleton; one client instance
 * per application; and the cache never fetches by itself — the loader comes from
 * a gateway, through a ViewModel.
 */
export interface ILankaReadCache {
	/**
	 * The resource: from memory while fresh, otherwise through `load`.
	 *
	 * `load` receives a signal only from an implementation that can cancel —
	 * hence the optional parameter. One that cannot passes nothing, rather than a
	 * signal that can never fire, and `TLankaExecuteOptions.signal` already
	 * accepts `undefined`, so the gateway call is written the same way either way.
	 */
	read<TData>(
		key: TLankaCacheKey,
		load: (signal?: AbortSignal) => Promise<TData>,
		options?: { staleMs?: number },
	): Promise<TData>;

	/** What the server just answered, in the DOMAIN shape. Subscribers hear before this returns. */
	write<TData>(key: TLankaCacheKey, data: TData): void;

	/** Marks the resource stale, and reloads it while somebody is listening. */
	invalidate(key: TLankaCacheKey): Promise<void>;

	/** Hears every later change to the resource — not the current value. Answers the release. */
	subscribe(key: TLankaCacheKey, onData: (data: unknown) => void): () => void;

	/** What is cached right now, stale or not. Never fetches. */
	peek<TData>(key: TLankaCacheKey): TData | undefined;

	/** Empties everything — the end of a session. Notifies nobody. */
	clear(): void;

	/**
	 * Stops a load in flight: the screen went away.
	 *
	 * OPTIONAL, because three of the four libraries measured for this port cannot
	 * do it — `@nanostores/query` structurally, since no signal reaches its
	 * fetcher. Absent means "the request finishes and its answer is discarded",
	 * which is wasteful and never wrong. Declaring it as a no-op is worse than
	 * omitting it: a caller would believe the request stopped.
	 *
	 * It belongs to the cache rather than to the ViewModel because the cache owns
	 * deduplication — a second reader joins the first's request in flight, and a
	 * cancellation by the first would tear it out from under the second.
	 */
	cancel?(key: TLankaCacheKey): void;
}
