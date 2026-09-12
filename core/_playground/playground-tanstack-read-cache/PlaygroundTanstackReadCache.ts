import { hashKey, QueryClient } from "@tanstack/query-core";
import { ALankaSingleton } from "../../src/locator/index";
import type { IPlaygroundReadCache } from "../_interfaces/IPlaygroundReadCache";
import type { TPlaygroundCacheKey } from "../_types/TPlaygroundCacheKey";

/**
 * The read-cache port over TanStack Query — the file an application writes.
 *
 * Five operations, each one call into `QueryClient`, and this is the ONLY file
 * in the application that knows the words `queryKey`, `staleTime` or
 * `getQueryCache`. The ViewModels above it are the same ViewModels that run over
 * the `Map` implementation, which is what the port is for: the scenes run both
 * and assert the same things.
 *
 * `client` is public on purpose. A screen that reads the resource directly with
 * `useQuery` — the configuration for an application already built on TanStack
 * Query — must be handed THIS client through `QueryClientProvider`. One
 * instance, registered with the locator and provided to React, or the two halves
 * hold two caches and disagree on the first mutation.
 */
export class PlaygroundTanstackReadCache extends ALankaSingleton implements IPlaygroundReadCache {
	public readonly client: QueryClient;
	/** How many ViewModels listen to each key: `invalidate` reloads only a watched resource. */
	private readonly watchers = new Map<string, number>();

	public constructor(
		client: QueryClient = new QueryClient({
			// Retry is the request policy's job (`@lankajs/plugin-http`, where it
			// travels with idempotency); a second retry here would multiply it.
			defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
		}),
	) {
		super();
		this.client = client;
	}

	public read<T>(
		key: TPlaygroundCacheKey,
		load: (signal: AbortSignal) => Promise<T>,
		options?: { staleMs?: number },
	): Promise<T> {
		return this.client.fetchQuery({
			queryKey: key,
			queryFn: ({ signal }) => load(signal),
			staleTime: options?.staleMs ?? 0,
		});
	}

	public write<T>(key: TPlaygroundCacheKey, data: T): void {
		this.client.setQueryData(key, data);
	}

	public async invalidate(key: TPlaygroundCacheKey): Promise<void> {
		const isWatched = (this.watchers.get(hashKey(key)) ?? 0) > 0;
		await this.client.invalidateQueries({
			queryKey: key,
			exact: true,
			refetchType: isWatched ? "all" : "none",
		});
	}

	public subscribe(key: TPlaygroundCacheKey, onData: (data: unknown) => void): () => void {
		const address = hashKey(key);
		this.watchers.set(address, (this.watchers.get(address) ?? 0) + 1);

		const release = this.client.getQueryCache().subscribe((event) => {
			if (event.type !== "updated" || event.action.type !== "success") return;
			if (event.query.queryHash !== address) return;
			onData(event.query.state.data);
		});

		return () => {
			release();
			this.watchers.set(address, Math.max(0, (this.watchers.get(address) ?? 1) - 1));
		};
	}

	public cancel(key: TPlaygroundCacheKey): void {
		void this.client.cancelQueries({ queryKey: key, exact: true });
	}
}
