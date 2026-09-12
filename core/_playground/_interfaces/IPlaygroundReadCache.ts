import type { TPlaygroundCacheKey } from "../_types/TPlaygroundCacheKey";

/**
 * The read cache as a ViewModel sees it: five operations, and no more than the
 * application called.
 *
 * This is the APPLICATION'S port, not the framework's. lanka ships no cache by
 * decision — a host framework has one, and two caches disagree on the first
 * mutation — so an application that wants one in a SPA brings TanStack Query or
 * SWR and writes this interface over it in one file. The ViewModel then knows
 * none of that library's words: no `queryKey`, no `staleTime`, no
 * `getQueryCache`. A test implements the same five operations over a `Map`.
 *
 * What is deliberately absent: mutations. Writes go through the gateway from a
 * ViewModel action; the cache is told afterwards, through `write` or
 * `invalidate`. A cache that ran mutations would be a second place a request is
 * born.
 */
export interface IPlaygroundReadCache {
	/** The resource, from memory while fresh, else from `load` — once, however many ask. */
	read<T>(
		key: TPlaygroundCacheKey,
		load: (signal: AbortSignal) => Promise<T>,
		options?: { staleMs?: number },
	): Promise<T>;
	/** What the server just answered, in the DOMAIN shape; every subscriber hears. */
	write<T>(key: TPlaygroundCacheKey, data: T): void;
	/** Marks the resource stale and, while somebody is listening, reloads it. */
	invalidate(key: TPlaygroundCacheKey): Promise<void>;
	/** Hears every change to the resource. Returns the release. */
	subscribe(key: TPlaygroundCacheKey, onData: (data: unknown) => void): () => void;
	/** Stops a load in flight — the screen went away. */
	cancel(key: TPlaygroundCacheKey): void;
}
