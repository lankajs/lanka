import { nanoquery } from "@nanostores/query";
import { describe, expect, it, vi } from "vitest";
import { createLankaNanostoresCache } from "../_factories/create-lanka-nanostores-cache/createLankaNanostoresCache";
import { LankaNanostoresCache } from "./LankaNanostoresCache";
import type { ILankaReadCache } from "lanka/cache";
import type { TLankaNanostoresClient } from "./LankaNanostoresCache";

/**
 * What only THIS library can get wrong.
 *
 * The shared clauses are the family's and run from the playground, where a
 * reader looks for how the package is used. Here is the knowledge that would
 * have to be rediscovered by anyone writing this adapter a second time.
 */

const freshCache = () =>
	createLankaNanostoresCache(nanoquery() as unknown as TLankaNanostoresClient);

describe("LankaNanostoresCache — what this library gets wrong when guessed", () => {
	it("does not declare `cancel`, because no signal reaches its fetcher", () => {
		// The honest absence the port's optional member exists for. A no-op here
		// would be worse than nothing: a ViewModel would believe the request
		// stopped, and the screen would wait for an answer already discarded.
		//
		// Read through the PORT, which is where the absence is visible: the class
		// itself simply has no such member, and a caller holding one writes
		// `cancel?.(…)`.
		const throughThePort: ILankaReadCache = freshCache();

		expect(throughThePort.cancel).toBeUndefined();
	});

	it("holds ONE store per key, so two readers are one request", async () => {
		const cache = freshCache();
		const load = vi.fn(() => Promise.resolve({ id: 1 }));

		await Promise.all([
			cache.read(["order", 1], load, { staleMs: 60_000 }),
			cache.read(["order", 1], load, { staleMs: 60_000 }),
		]);

		// A store per CALL would leak one per read and give each its own request in
		// flight — deduplication is the reason the cache is under the ViewModel.
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("does not deliver the current value when a listener attaches", async () => {
		// `.subscribe()` in this library calls its listener immediately; `.listen()`
		// does not. And attaching MOUNTS the store, which makes it emit what it
		// already holds — so that emission is dropped by identity as well.
		const cache = freshCache();
		await cache.read(["order", 1], () => Promise.resolve({ id: 1 }), { staleMs: 60_000 });

		const heard: unknown[] = [];
		cache.subscribe(["order", 1], (data) => heard.push(data));
		await new Promise((resolve) => setTimeout(resolve, 40));

		expect(heard).toEqual([]);
		expect(cache.peek(["order", 1])).toEqual({ id: 1 });
	});

	it("invalidates by the library's OWN key, which joins the parts with nothing", async () => {
		// `["order", 1]` is `"order1"` here, not `"order/1"`. Guessing a separator
		// makes `invalidateKeys` a no-op that reports nothing, and the next read
		// answers from a cache that was never dropped.
		const cache = freshCache();
		const load = vi.fn(() => Promise.resolve({ id: 1 }));
		await cache.read(["order", 1], load, { staleMs: 60_000 });

		await cache.invalidate(["order", 1]);
		await cache.read(["order", 1], load, { staleMs: 60_000 });

		expect(load).toHaveBeenCalledTimes(2);
	});

	it("only listens while a consumer does, or every key would look watched", async () => {
		// A nanostores store with any listener is mounted, and a mounted store is
		// refetched by `invalidateKeys`. Attaching unconditionally would make
		// "asks nobody when nobody is looking" false for every resource.
		const cache = freshCache();
		const load = vi.fn(() => Promise.resolve({ id: 1 }));
		await cache.read(["order", 1], load, { staleMs: 60_000 });

		await cache.invalidate(["order", 1]);

		expect(load).toHaveBeenCalledTimes(1);
	});

	it("is a singleton the locator will accept", () => {
		expect(freshCache()).toBeInstanceOf(LankaNanostoresCache);
	});

	it("takes the application's own `nanoquery()` rather than making one", () => {
		// The same reason the TanStack member takes a client: anything else in the
		// application reading this cache must be looking at the same instance.
		const own = nanoquery() as unknown as TLankaNanostoresClient;
		const cache = createLankaNanostoresCache(own);

		cache.write(["order", 1], { id: 1, from: "the cache" });

		expect(cache.peek(["order", 1])).toEqual({ id: 1, from: "the cache" });
	});
});
