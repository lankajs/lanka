import type { ILankaReadCache, TLankaCacheKey } from "lanka/cache";

/** One resource's memory: the answer, when it arrived, how to ask again, and the ask in flight. */
interface ILankaFakeEntry {
	data: unknown;
	answeredAt: number;
	/**
	 * The last loader, kept so a WATCHED key can be refetched on `invalidate`.
	 *
	 * Both real members do this — one through `refetchType`, the other through
	 * `revalidateKeys` — so a fake that only marked stale would be an easier
	 * subject than the thing it stands in for, and the suite would pass over it
	 * while failing over them.
	 */
	load: ((signal?: AbortSignal) => Promise<unknown>) | null;
	inFlight: Promise<unknown> | null;
	controller: AbortController | null;
}

/** A fake with the two things a test wants to see beyond the port. */
export interface ILankaFakeReadCache extends ILankaReadCache {
	/** How many times each key's loader was actually called. */
	readonly loads: ReadonlyMap<string, number>;
	/** The clock the cache reads, so a scene can make an answer stale without waiting. */
	advance(ms: number): void;
}

/**
 * A read cache in a `Map`, keeping every clause of `ILankaReadCache`.
 *
 * Two jobs, and they are the same job. A test of a ViewModel that reads through
 * the port needs a cache without a vendor in it; and the port needs a SECOND
 * implementation, because an abstraction typed by its single implementation is
 * not one. Both members of `modules/query/` are checked against the same
 * assertions this passes.
 *
 * It is a double, not a third vendor: no eviction, no persistence, no window
 * focus. If it ever grows a behaviour neither member can match, the port has
 * stopped describing the thing it was drawn from.
 *
 * Its clock is a counter rather than `Date.now`, so a scene makes an answer
 * stale with `advance(...)` instead of sleeping.
 */
export const createLankaFakeReadCache = (): ILankaFakeReadCache => {
	const entries = new Map<string, ILankaFakeEntry>();
	const listeners = new Map<string, Set<(data: unknown) => void>>();
	const loads = new Map<string, number>();
	let now = 0;

	const address = (key: TLankaCacheKey): string => JSON.stringify(key);

	const entryAt = (at: string): ILankaFakeEntry => {
		const known = entries.get(at);
		if (known) return known;

		const created: ILankaFakeEntry = {
			data: undefined,
			answeredAt: Number.NEGATIVE_INFINITY,
			load: null,
			inFlight: null,
			controller: null,
		};
		entries.set(at, created);
		return created;
	};

	// Clause 9: before `write` returns. A listener added during delivery is not
	// called for the event being delivered, which is why the set is copied.
	const notify = (at: string, data: unknown): void => {
		for (const listener of [...(listeners.get(at) ?? [])]) listener(data);
	};

	const load = async <TData>(
		at: string,
		entry: ILankaFakeEntry,
		loader: (signal?: AbortSignal) => Promise<TData>,
	): Promise<TData> => {
		// Clause 5: a second reader joins the request in flight rather than
		// starting a second one.
		if (entry.inFlight) return entry.inFlight as Promise<TData>;

		const controller = new AbortController();
		entry.controller = controller;
		loads.set(at, (loads.get(at) ?? 0) + 1);

		entry.inFlight = loader(controller.signal).then(
			(data) => {
				entry.data = data;
				entry.answeredAt = now;
				entry.inFlight = null;
				entry.controller = null;
				notify(at, data);
				return data;
			},
			(error: unknown) => {
				// Clause 7: a failure is not an answer. Nothing is stored, so the next
				// read asks again — and clause 6: it is rethrown as it came.
				entry.inFlight = null;
				entry.controller = null;
				throw error;
			},
		);

		return entry.inFlight as Promise<TData>;
	};

	return {
		loads,

		advance: (ms) => {
			now += ms;
		},

		read: (key, loader, options) => {
			const at = address(key);
			const entry = entryAt(at);
			entry.load = loader;
			const isFresh = now - entry.answeredAt <= (options?.staleMs ?? 0);

			return isFresh ? Promise.resolve(entry.data as never) : load(at, entry, loader);
		},

		write: (key, data) => {
			const at = address(key);
			const entry = entryAt(at);
			entry.data = data;
			entry.answeredAt = now;
			notify(at, data);
		},

		invalidate: async (key) => {
			const at = address(key);
			const entry = entries.get(at);
			if (!entry) return;

			entry.answeredAt = Number.NEGATIVE_INFINITY;

			// Clause 8: a watched resource comes back by itself, or the screen
			// looking at it keeps showing what was just invalidated. An unwatched one
			// is only marked — reloading it is work with no reader.
			const watched = (listeners.get(at)?.size ?? 0) > 0;
			if (watched && entry.load) await load(at, entry, entry.load);
		},

		subscribe: (key, onData) => {
			// Clause 1: no immediate call. A caller that wants the current value
			// reads `peek`, where it is visibly a read rather than an event.
			const at = address(key);
			const set = listeners.get(at) ?? new Set();
			set.add(onData);
			listeners.set(at, set);

			// Clause 3: this release, not the first listener carrying this function.
			let released = false;
			return () => {
				if (released) return;
				released = true;
				set.delete(onData);
			};
		},

		peek: (key) => entries.get(address(key))?.data as never,

		clear: () => {
			// Clause 10: nobody is told. It runs when a session ends and the screens
			// are going away; a notification would repaint what is being torn down.
			entries.clear();
			loads.clear();
		},

		cancel: (key) => {
			entries.get(address(key))?.controller?.abort();
		},
	};
};
