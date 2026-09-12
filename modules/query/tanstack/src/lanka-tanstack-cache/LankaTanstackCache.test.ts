import { QueryClient } from "@tanstack/query-core";
import { describe, expect, it, vi } from "vitest";
import { createLankaTanstackCache } from "../_factories/create-lanka-tanstack-cache/createLankaTanstackCache";
import { LankaTanstackCache } from "./LankaTanstackCache";

/**
 * The port's clauses, and the three this library gets wrong when guessed.
 *
 * The shared assertions come from the test kit rather than being written here:
 * every member of `modules/query/` promises the same behaviour, and a copy per
 * package is a copy that stops keeping the promise the day one of them gains an
 * assertion and the others do not.
 *
 * What is written here is what only THIS library can get wrong.
 */

const freshClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("LankaTanstackCache — what this library gets wrong when guessed", () => {
	it("does not deliver a pending state as data", async () => {
		// `event.type === "updated"` alone is true while a query is fetching. A
		// ViewModel filtering only on that renders `undefined` before the answer.
		const cache = createLankaTanstackCache(freshClient());
		const heard: unknown[] = [];
		cache.subscribe(["order", 1], (data) => heard.push(data));

		await cache.read(["order", 1], () => Promise.resolve({ id: 1 }), { staleMs: 60_000 });

		expect(heard).toEqual([{ id: 1 }]);
	});

	it("does not deliver a failure as data", async () => {
		const cache = createLankaTanstackCache(freshClient());
		const heard: unknown[] = [];
		cache.subscribe(["order", 1], (data) => heard.push(data));

		await cache
			.read(["order", 1], () => Promise.reject(new Error("no")))
			.catch(() => undefined);

		expect(heard).toEqual([]);
	});

	it("hears its own key and not its neighbour", async () => {
		// The cache's own `queryHash`, not one computed here: a hash built by this
		// class could agree with itself and disagree with the client, and then a
		// screen hears about somebody else's resource.
		const client = freshClient();
		const cache = createLankaTanstackCache(client);
		const heard: unknown[] = [];
		cache.subscribe(["order", 1], (data) => heard.push(data));

		await cache.read(["order", 2], () => Promise.resolve({ id: 2 }), { staleMs: 60_000 });

		expect(heard).toEqual([]);
	});

	it("refetches an invalidated resource only while somebody is watching", async () => {
		const cache = createLankaTanstackCache(freshClient());
		const load = vi.fn(() => Promise.resolve({ id: 1 }));

		await cache.read(["order", 1], load, { staleMs: 60_000 });
		await cache.invalidate(["order", 1]);
		expect(load).toHaveBeenCalledTimes(1);

		const release = cache.subscribe(["order", 1], () => undefined);
		await cache.read(["order", 1], load, { staleMs: 60_000 });
		await cache.invalidate(["order", 1]);
		release();

		// `refetchType: "all"` for a watched key, `"none"` otherwise. A fixed mode
		// either refetches a screen nobody is looking at or leaves a watched one
		// stale, and both are silent.
		expect(load).toHaveBeenCalledTimes(3);
	});

	it("aborts the signal its loader was given", async () => {
		const cache = createLankaTanstackCache(freshClient());
		let seen: AbortSignal | undefined;

		const reading = cache
			.read(["order", 1], (signal) => {
				seen = signal;
				return new Promise<{ id: number }>(() => undefined);
			})
			.catch(() => undefined);

		cache.cancel(["order", 1]);
		await reading;

		expect(seen?.aborted).toBe(true);
	});

	it("is a singleton the locator will accept", () => {
		// The marker, not a convention: without it the locator's selection is
		// "anything that is a function", and a stray export becomes public.
		expect(createLankaTanstackCache(freshClient())).toBeInstanceOf(LankaTanstackCache);
	});

	it("takes the application's client rather than making one", () => {
		// Two clients in one application disagree on the first mutation, silently.
		// Anything else reading this cache — `useQuery` in a component, devtools —
		// has to be looking at the same instance.
		const client = freshClient();
		const cache = createLankaTanstackCache(client);

		cache.write(["order", 1], { id: 1, from: "the cache" });

		expect(client.getQueryData(["order", 1])).toEqual({ id: 1, from: "the cache" });
	});
});
