import { ALankaSingleton } from "../../src/locator/index";
import type { IPlaygroundReadCache } from "../_interfaces/IPlaygroundReadCache";
import type { TPlaygroundCacheKey } from "../_types/TPlaygroundCacheKey";

/** One resource's memory: what was answered, when, how to ask again, and the ask in flight. */
interface IPlaygroundCacheEntry {
	data: unknown;
	answeredAt: number;
	load: ((signal: AbortSignal) => Promise<unknown>) | null;
	inFlight: Promise<unknown> | null;
	controller: AbortController | null;
}

/**
 * The application's read cache, over a `Map`.
 *
 * A stand-in for the QueryClient adapter an application writes over TanStack
 * Query, kept to the same five operations so the ViewModels above it cannot tell
 * the difference — which is the property the port exists for. Registered with
 * the locator as a singleton: one per application, the way a QueryClient is.
 *
 * What it reproduces of the real thing, because the scenes depend on it: a
 * fresh answer is returned without asking; two readers of one key in flight
 * share one request; `invalidate` reloads only while somebody is listening; and
 * `write` tells every listener, which is how a ViewModel hears a change another
 * screen made.
 */
export class PlaygroundReadCache extends ALankaSingleton implements IPlaygroundReadCache {
	private readonly entries = new Map<string, IPlaygroundCacheEntry>();
	private readonly listeners = new Map<string, Set<(data: unknown) => void>>();
	private readonly now: () => number;

	public constructor(now: () => number = Date.now) {
		super();
		this.now = now;
	}

	public async read<T>(
		key: TPlaygroundCacheKey,
		load: (signal: AbortSignal) => Promise<T>,
		options?: { staleMs?: number },
	): Promise<T> {
		const entry = this.entry(key);
		entry.load = load;

		const isFresh = this.now() - entry.answeredAt <= (options?.staleMs ?? 0);
		if (isFresh) return entry.data as T;

		return (await this.reload(key, entry)) as T;
	}

	public write<T>(key: TPlaygroundCacheKey, data: T): void {
		const entry = this.entry(key);
		entry.data = data;
		entry.answeredAt = this.now();
		this.notify(key, data);
	}

	public async invalidate(key: TPlaygroundCacheKey): Promise<void> {
		const entry = this.entries.get(PlaygroundReadCache.address(key));
		if (!entry) return;

		entry.answeredAt = Number.NEGATIVE_INFINITY;
		const isWatched = (this.listeners.get(PlaygroundReadCache.address(key))?.size ?? 0) > 0;
		if (entry.load && isWatched) await this.reload(key, entry);
	}

	public subscribe(key: TPlaygroundCacheKey, onData: (data: unknown) => void): () => void {
		const address = PlaygroundReadCache.address(key);
		const set = this.listeners.get(address) ?? new Set();
		set.add(onData);
		this.listeners.set(address, set);

		return () => {
			set.delete(onData);
		};
	}

	public cancel(key: TPlaygroundCacheKey): void {
		this.entries.get(PlaygroundReadCache.address(key))?.controller?.abort();
	}

	private static address(key: TPlaygroundCacheKey): string {
		return JSON.stringify(key);
	}

	private entry(key: TPlaygroundCacheKey): IPlaygroundCacheEntry {
		const address = PlaygroundReadCache.address(key);
		const known = this.entries.get(address);
		if (known) return known;

		const created: IPlaygroundCacheEntry = {
			data: undefined,
			answeredAt: Number.NEGATIVE_INFINITY,
			load: null,
			inFlight: null,
			controller: null,
		};
		this.entries.set(address, created);
		return created;
	}

	/** One request per key at a time: a second reader joins the one in flight. */
	private reload(key: TPlaygroundCacheKey, entry: IPlaygroundCacheEntry): Promise<unknown> {
		if (entry.inFlight) return entry.inFlight;
		if (!entry.load) return Promise.resolve(entry.data);

		const controller = new AbortController();
		entry.controller = controller;
		entry.inFlight = entry.load(controller.signal).then(
			(data) => {
				entry.data = data;
				entry.answeredAt = this.now();
				entry.inFlight = null;
				entry.controller = null;
				this.notify(key, data);
				return data;
			},
			(error: unknown) => {
				entry.inFlight = null;
				entry.controller = null;
				throw error;
			},
		);

		return entry.inFlight;
	}

	private notify(key: TPlaygroundCacheKey, data: unknown): void {
		this.listeners.get(PlaygroundReadCache.address(key))?.forEach((listener) => listener(data));
	}
}
