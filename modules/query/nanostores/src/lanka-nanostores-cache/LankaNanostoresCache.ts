import { ALankaSingleton } from "lanka/locator";
import type { ILankaReadCache, TLankaCacheKey } from "lanka/cache";

/** A fetcher store, as much of it as this member uses. */
interface INanoFetcherStore<TData> {
	/**
	 * The library's own spelling of the key, and the only one it answers to.
	 *
	 * It joins the parts with NOTHING: `["order", 1]` becomes `"order1"`. Guessing
	 * a separator makes `invalidateKeys` a no-op that reports nothing, and the
	 * next read answers from a cache that was never dropped. Two consequences,
	 * both load-bearing: this class always invalidates by `store.key`, and keys
	 * whose parts run together — `["order", 1]` and `["order1"]` — are ONE
	 * resource to this member.
	 */
	key?: string;
	get: () => { data?: TData; error?: unknown; loading: boolean };
	listen: (listener: () => void) => () => void;
	fetch: () => Promise<{ data: TData } | { error: unknown }>;
}

/** What `nanoquery()` answers, as much of it as this member uses. */
export type TLankaNanostoresClient = readonly [
	createFetcherStore: (keys: unknown, settings?: Record<string, unknown>) => unknown,
	createMutatorStore: unknown,
	controls: {
		invalidateKeys: (keys: string | string[] | ((key: string) => boolean)) => void;
		revalidateKeys: (keys: string | string[] | ((key: string) => boolean)) => void;
		mutateCache: (keys: string | string[] | ((key: string) => boolean), data?: unknown) => void;
	},
];

/**
 * `ILankaReadCache` over `@nanostores/query`.
 *
 * Six of the seven operations. `cancel` is absent, and that is the honest
 * answer: this library declares its fetcher as `(...keyParts) => Promise<T>`, so
 * no `AbortSignal` ever reaches the loader. The port makes `cancel` optional for
 * exactly this case — declaring a no-op would be worse, because a ViewModel
 * would believe the request stopped.
 *
 * ## Three things here are not a translation of the TanStack member
 *
 * The subscription uses `listen` and not `subscribe`; invalidation picks between
 * two named functions rather than a mode flag; and the listeners are this
 * class's own rather than the library's, because a fetcher store exists only
 * once something has been read and a ViewModel subscribes in `onInit`, before
 * its first read.
 */
export class LankaNanostoresCache extends ALankaSingleton implements ILankaReadCache {
	private readonly controls: TLankaNanostoresClient[2];
	private readonly createStore: TLankaNanostoresClient[0];

	/**
	 * One store per key, kept.
	 *
	 * A store per CALL would leak one per read and defeat the deduplication the
	 * cache exists for: two readers of one key would hold two stores, each with
	 * its own request in flight.
	 */
	private readonly stores = new Map<string, INanoFetcherStore<unknown>>();

	/** This class's own listeners — see the note about `onInit` above. */
	private readonly listeners = new Map<string, Set<(data: unknown) => void>>();

	/** The last settled value per key, so `peek` answers before a store exists. */
	private readonly values = new Map<string, unknown>();

	/** How this class detaches from a store — kept, because `clear` must stop hearing. */
	private readonly attached = new Map<string, () => void>();

	/**
	 * @param nanoquery the application's own `nanoquery(...)` result — see the README.
	 */
	public constructor(nanoquery: TLankaNanostoresClient) {
		super();
		this.createStore = nanoquery[0];
		this.controls = nanoquery[2];
	}

	public async read<TData>(
		key: TLankaCacheKey,
		load: (signal?: AbortSignal) => Promise<TData>,
		options?: { staleMs?: number },
	): Promise<TData> {
		const address = this.addressOf(key);
		const store = this.storeFor<TData>(address, key, load, options?.staleMs ?? 0);
		const answer = await store.fetch();

		if ("error" in answer) {
			// Clause 7: this library REMEMBERS a failure — the store keeps the error
			// and its dedupe window answers the next reader with it. A failure is not
			// an answer, so the store is dropped and the next read builds a new one.
			this.drop(address);

			// Clause 6: the loader's failure, exactly as it was thrown. This library
			// answers an outcome rather than rejecting, so the rejection is restored
			// here — a caller branches on `LankaError.kind`, and anything else would
			// hide it.
			throw answer.error;
		}

		this.notify(address, answer.data);
		return answer.data;
	}

	public write<TData>(key: TLankaCacheKey, data: TData): void {
		// Clause 9: before this returns. `mutateCache` writes into the library's own
		// map; the listeners are this class's, so they are called here rather than
		// waited for.
		const address = this.addressOf(key);
		const vendorKey = this.stores.get(address)?.key;
		if (vendorKey) this.controls.mutateCache(vendorKey, data);
		this.notify(address, data);
	}

	public async invalidate(key: TLankaCacheKey): Promise<void> {
		const address = this.addressOf(key);
		const vendorKey = this.stores.get(address)?.key;
		if (!vendorKey) return;

		// Clause 8, stated by two functions rather than by a mode. `revalidateKeys`
		// asks again; `invalidateKeys` only drops the answer. Asking again for a
		// screen nobody is looking at is a request with no reader.
		//
		// Measured, because the difference is smaller than it reads: a store with a
		// listener on it is MOUNTED, and a mounted store fetches again by itself
		// when its value is dropped — so swapping these two calls over breaks no
		// test here. `revalidateKeys` is kept because it says the intention at the
		// call site and does not depend on that mount behaviour staying true.
		if ((this.listeners.get(address)?.size ?? 0) > 0) {
			this.controls.revalidateKeys(vendorKey);
			await this.settled(address);
			return;
		}

		// Unwatched: dropped, not refetched. The STORE is kept — a new one built for
		// the same key would land inside the previous one's dedupe window and answer
		// from it, so the next read would never reach the loader.
		this.controls.invalidateKeys(vendorKey);
		this.values.delete(address);
	}

	public subscribe(key: TLankaCacheKey, onData: (data: unknown) => void): () => void {
		// Clause 1: nothing is delivered now. A caller that wants the current value
		// reads `peek`, where it is visibly a read rather than an event.
		const address = this.addressOf(key);
		const set = this.listeners.get(address) ?? new Set();
		set.add(onData);
		this.listeners.set(address, set);
		this.attach(address);

		// Clause 3: this subscription, and idempotent.
		let released = false;
		return () => {
			if (released) return;
			released = true;
			set.delete(onData);
			if (set.size === 0) this.detach(address);
		};
	}

	public peek<TData>(key: TLankaCacheKey): TData | undefined {
		return this.values.get(this.addressOf(key)) as TData | undefined;
	}

	public clear(): void {
		// Clause 10: nobody is told. The store listeners are detached FIRST, because
		// this library's invalidation wakes a watched store and the wake would reach
		// a screen that is being torn down — with data the next user must not see.
		for (const release of this.attached.values()) release();
		this.attached.clear();

		// And dropped rather than revalidated: at the end of a session a refetch is
		// a request carrying a dead one.
		this.controls.invalidateKeys(() => true);
		this.stores.clear();
		this.values.clear();
	}

	/** Forgets one key entirely, so the next read starts over. */
	private drop(address: string): void {
		const vendorKey = this.stores.get(address)?.key;

		this.attached.get(address)?.();
		this.attached.delete(address);
		if (vendorKey) this.controls.invalidateKeys(vendorKey);
		this.stores.delete(address);
		this.values.delete(address);
	}

	/** `["order", 1]` → `order/1`, which is how this library spells a key. */
	private addressOf(key: TLankaCacheKey): string {
		return key.map((part) => String(part)).join("/");
	}

	/** Clause 2: only settled data reaches a listener, and `peek` sees the same. */
	private notify(address: string, data: unknown): void {
		this.values.set(address, data);
		for (const listener of [...(this.listeners.get(address) ?? [])]) listener(data);
	}

	private storeFor<TData>(
		address: string,
		key: TLankaCacheKey,
		load: (signal?: AbortSignal) => Promise<TData>,
		staleMs: number,
	): INanoFetcherStore<TData> {
		const known = this.stores.get(address);
		if (known) return known as INanoFetcherStore<TData>;

		const created = this.createStore(
			// A key part is `string | number | true` in this library; a `false` has
			// to travel as text, which is what the port's narrower key type exists
			// to make survivable.
			key.map((part) => (typeof part === "boolean" ? String(part) : part)),
			// `dedupeTime` is this library's name for "how long an answer stays
			// fresh", which is what `staleMs` asks for. `cacheLifetime` follows it:
			// a value evicted sooner than it goes stale would be refetched while
			// this class still believed it was fresh.
			{ fetcher: () => load(), dedupeTime: staleMs, cacheLifetime: Math.max(staleMs, 1) },
		) as INanoFetcherStore<TData>;

		this.stores.set(address, created);
		this.attach(address);
		return created;
	}

	/**
	 * Starts hearing a store, but ONLY while a consumer is listening.
	 *
	 * A nanostores store with any listener is mounted, and a mounted store is
	 * refetched by `invalidateKeys`. Attaching unconditionally would therefore make
	 * every key permanently watched, and clause 8's "asks nobody when nobody is
	 * looking" would be false for every resource this cache ever read.
	 */
	private attach(address: string): void {
		const store = this.stores.get(address);
		if (!store || this.attached.has(address)) return;
		if ((this.listeners.get(address)?.size ?? 0) === 0) return;

		// Clause 1, from the other side: `listen`, NOT `subscribe`. This library's
		// `subscribe` calls its listener immediately with the current value, and
		// that value would arrive at a ViewModel as an event.
		const release = store.listen(() => {
			const state = store.get();
			// Clause 2: a pending or failed state is not data.
			if (state.loading || state.error !== undefined || state.data === undefined) return;

			// Clause 1: attaching MOUNTS the store, and a mounted store emits what it
			// already holds. That emission is the current value, not a change, so it
			// is dropped — a listener that fired on attach would hand a ViewModel an
			// event it never caused. The same identity check keeps `write` from
			// notifying twice, once through `mutateCache` and once directly.
			if (state.data === this.values.get(address)) return;

			this.notify(address, state.data);
		});

		this.attached.set(address, release);
	}

	/** Stops hearing it, so the library stops treating it as watched. */
	private detach(address: string): void {
		this.attached.get(address)?.();
		this.attached.delete(address);
	}

	/** Waits for a revalidation to stop loading, since `revalidateKeys` answers nothing. */
	private settled(address: string): Promise<void> {
		const store = this.stores.get(address);
		if (!store) return Promise.resolve();

		return new Promise((resolve) => {
			if (!store.get().loading) {
				resolve();
				return;
			}

			const release = store.listen(() => {
				if (store.get().loading) return;
				release();
				resolve();
			});
		});
	}
}
