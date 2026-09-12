import { ALankaSingleton } from "lanka/locator";
import type { QueryClient } from "@tanstack/query-core";
import type { ILankaReadCache, TLankaCacheKey } from "lanka/cache";

/**
 * The vendor object this member is built on, under the family's name for it.
 *
 * Every member of `modules/query/` names its client the same way, so the two
 * surfaces differ in exactly one word — the vendor's — and `check-family` can
 * say so. It is an alias and not a re-export: an application still imports
 * `QueryClient` from the library it installed, and this package publishes none
 * of TanStack's own types.
 */
export type TLankaTanstackClient = QueryClient;

/**
 * `ILankaReadCache` over a `QueryClient`.
 *
 * The ViewModels above it never learn a word of this library: no `queryKey`, no
 * `staleTime`, no `getQueryCache`. Those live here and nowhere else, which is
 * what lets the same ViewModel run over `createLankaFakeReadCache` in a test and
 * over this in an application.
 *
 * Three of the seven operations carry knowledge that is wrong SILENTLY if
 * guessed, and each is commented where it happens: which event is data, which
 * query an event is about, and whether an invalidation should refetch.
 *
 * Extends `ALankaSingleton` because an application publishes one by name —
 * through `registerInstance`, since the client is a required parameter and the
 * locator constructs a class with none.
 */
export class LankaTanstackCache extends ALankaSingleton implements ILankaReadCache {
	private readonly client: TLankaTanstackClient;

	/** How many subscribers each query hash has, which decides what `invalidate` does. */
	private readonly watchers = new Map<string, number>();

	/**
	 * @param client the application's own, never one made here — see the README.
	 */
	public constructor(client: TLankaTanstackClient) {
		super();
		this.client = client;
	}

	public read<TData>(
		key: TLankaCacheKey,
		load: (signal?: AbortSignal) => Promise<TData>,
		options?: { staleMs?: number },
	): Promise<TData> {
		return this.client.fetchQuery({
			queryKey: [...key],
			queryFn: ({ signal }) => load(signal),
			staleTime: options?.staleMs ?? 0,
			// Clauses 6 and 7: the loader's failure is the caller's to read, and a
			// retry here would answer a different question than the one asked.
			retry: false,
		});
	}

	public write<TData>(key: TLankaCacheKey, data: TData): void {
		// Synchronous, which clause 9 promises: `setQueryData` notifies before it
		// returns.
		this.client.setQueryData([...key], data);
	}

	public async invalidate(key: TLankaCacheKey): Promise<void> {
		// Clause 8, and the line most easily got wrong. `refetchType: "all"`
		// refetches a resource nobody is looking at; `"none"` leaves a watched
		// screen stale. Neither is right on its own, so the answer depends on
		// whether anybody subscribed — which is why this class counts them.
		const watched = (this.watchers.get(this.hashOf(key)) ?? 0) > 0;

		await this.client.invalidateQueries({
			queryKey: [...key],
			exact: true,
			refetchType: watched ? "all" : "none",
		});
	}

	public subscribe(key: TLankaCacheKey, onData: (data: unknown) => void): () => void {
		const hash = this.hashOf(key);
		this.watchers.set(hash, (this.watchers.get(hash) ?? 0) + 1);

		const release = this.client.getQueryCache().subscribe((event) => {
			// Clause 2, in two halves. `type` alone lets a pending state and a
			// failure through as if they were data — a ViewModel would render
			// `undefined` and then an error object. The action's own type is what
			// says an answer arrived.
			if (event.type !== "updated" || event.action.type !== "success") return;

			// Clause 9's other half: the cache's own hash, never one computed here.
			// Two keys that this class considers equal may hash differently in the
			// client, and then a screen hears about somebody else's resource.
			if (event.query.queryHash !== hash) return;

			onData(event.query.state.data);
		});

		// Clause 3: this subscription, and idempotent.
		let released = false;
		return () => {
			if (released) return;
			released = true;
			release();
			this.watchers.set(hash, Math.max(0, (this.watchers.get(hash) ?? 1) - 1));
		};
	}

	public peek<TData>(key: TLankaCacheKey): TData | undefined {
		return this.client.getQueryData<TData>([...key]);
	}

	public clear(): void {
		// Clause 10: `clear()` removes the queries rather than resetting them, so
		// the removal events it emits are not `success` and the filter above drops
		// them. Nobody is told, which is right at the end of a session.
		this.client.clear();
	}

	public cancel(key: TLankaCacheKey): void {
		void this.client.cancelQueries({ queryKey: [...key], exact: true });
	}

	/** The client's own hash for a key, so an event and a subscription agree. */
	private hashOf(key: TLankaCacheKey): string {
		return this.client.getQueryCache().build(this.client, { queryKey: [...key] }).queryHash;
	}
}
