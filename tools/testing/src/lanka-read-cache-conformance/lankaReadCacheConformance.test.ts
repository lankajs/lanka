import { describe, expect, it } from "vitest";
import { createLankaFakeReadCache } from "../_factories/create-lanka-fake-read-cache/createLankaFakeReadCache";
import { LANKA_READ_CACHE_SCENES, lankaReadCacheConformance } from "./lankaReadCacheConformance";
import type { ILankaReadCache } from "lanka/cache";

/**
 * The suite, checked against caches that are WRONG on purpose.
 *
 * A suite that passes every real implementation proves only that it agrees with
 * them. What has to be proved is the other direction: that each clause REJECTS
 * the shape it was written against. Below, one broken cache per clause, each
 * breaking exactly one promise and keeping the rest — and the assertion is that
 * the scenes for THAT clause fail and no others do.
 *
 * This is why the scenes are data. A suite that existed only as `describe`/`it`
 * could not be pointed at a broken subject without nesting a runner inside a
 * runner.
 */

/** A cache that keeps every clause, wrapped so one promise can be broken. */
const broken = (patch: (cache: ILankaReadCache) => Partial<ILankaReadCache>) => () => {
	const cache = createLankaFakeReadCache();
	return { ...cache, ...patch(cache) } as ILankaReadCache;
};

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Which clauses failed when the suite was pointed at this cache. */
const clausesRefused = async (create: () => ILankaReadCache): Promise<number[]> => {
	const refused = new Set<number>();

	for (const scene of LANKA_READ_CACHE_SCENES) {
		try {
			await scene.check(create, settle);
		} catch {
			refused.add(scene.clause);
		}
	}

	return [...refused].sort((a, b) => a - b);
};

describe("lankaReadCacheConformance — what it refuses", () => {
	it("clause 1: a cache that delivers the current value on subscribe", async () => {
		const refused = await clausesRefused(
			broken((cache) => ({
				subscribe: (key, onData) => {
					// nanostores' own `.subscribe()` behaves exactly like this, which is
					// why the member has to use `.listen()` instead.
					onData(cache.peek(key));
					return cache.subscribe(key, onData);
				},
			})),
		);

		expect(refused).toContain(1);
	});

	it("clause 3: a cache whose release drops every listener", async () => {
		const refused = await clausesRefused(
			broken((cache) => {
				// Releasing by anything other than the subscription itself: the shape a
				// `Set` keyed on the callback falls into, where two listeners sharing a
				// closure cancel each other.
				const releases: (() => void)[] = [];

				return {
					subscribe: (key, onData) => {
						releases.push(cache.subscribe(key, onData));
						return () => {
							for (const release of releases) release();
						};
					},
				};
			}),
		);

		expect(refused).toContain(3);
	});

	it("clause 4: a cache whose `peek` answers only fresh data", async () => {
		const refused = await clausesRefused(
			broken(() => ({
				peek: () => undefined,
			})),
		);

		expect(refused).toContain(4);
	});

	it("clause 5: a cache that loads once per reader instead of once per key", async () => {
		const refused = await clausesRefused(
			broken(() => ({
				read: (_key, load) => load(),
			})),
		);

		expect(refused).toContain(5);
	});

	it("clause 6: a cache that wraps the loader's error", async () => {
		// The one that would break every ViewModel in an application at once: the
		// sorting of a failure reads `LankaError.kind`, and a wrapper hides it.
		const refused = await clausesRefused(
			broken((cache) => ({
				read: (key, load, options) =>
					cache.read(key, load, options).catch((error: unknown) => {
						throw new Error(`cache failed: ${String(error)}`);
					}),
			})),
		);

		expect(refused).toContain(6);
	});

	it("clause 7: a cache that remembers a failure as data", async () => {
		const refused = await clausesRefused(
			broken((cache) => ({
				read: (key, load, options) =>
					cache.read(key, load, options).catch((error: unknown) => {
						cache.write(key, undefined);
						throw error;
					}),
			})),
		);

		expect(refused).toContain(7);
	});

	it("clause 8: a cache whose `invalidate` forgets to mark anything stale", async () => {
		const refused = await clausesRefused(
			broken(() => ({
				invalidate: () => Promise.resolve(),
			})),
		);

		expect(refused).toContain(8);
	});

	it("clause 9: a cache that notifies a write asynchronously", async () => {
		const refused = await clausesRefused(
			broken((cache) => ({
				write: (key, data) => {
					setTimeout(() => cache.write(key, data), 0);
				},
			})),
		);

		expect(refused).toContain(9);
	});

	it("clause 10: a cache that notifies on clear", async () => {
		const refused = await clausesRefused(
			broken((cache) => ({
				clear: () => {
					cache.write(["order", 1], undefined);
					cache.clear();
				},
			})),
		);

		expect(refused).toContain(10);
	});

	it("clause 11: a cache that declares `cancel` and does not abort", async () => {
		const refused = await clausesRefused(
			broken(() => ({
				cancel: () => undefined,
			})),
		);

		expect(refused).toContain(11);
	});

	it("clause 11: a cache that omits `cancel` altogether is accepted", async () => {
		// Absent is legal. If this ever failed, no library whose loader never gets a
		// signal could implement the port at all.
		const refused = await clausesRefused(() => {
			const cache = createLankaFakeReadCache();
			const { cancel: _dropped, ...withoutCancel } = cache;
			return withoutCancel;
		});

		expect(refused).not.toContain(11);
	});

	it("clause 12: a cache that refetches behind the caller's back", async () => {
		const refused = await clausesRefused(
			broken((cache) => ({
				read: (key, load, options) => {
					// Swallowed on purpose: some scenes hand this a loader that rejects,
					// and a stray refetch's rejection would surface as an unhandled one
					// belonging to no test. What is being modelled is the refetch, not
					// its outcome.
					setTimeout(() => void load().catch(() => undefined), 0);
					return cache.read(key, load, options);
				},
			})),
		);

		expect(refused).toContain(12);
	});

	it("the fake itself refuses nothing", async () => {
		expect(await clausesRefused(createLankaFakeReadCache)).toEqual([]);
	});
});

/**
 * And the positive direction, run the way a consumer runs it.
 *
 * `createLankaFakeReadCache` is the port's second implementation as well as its
 * test double: an abstraction typed by its single implementation is not one.
 */
lankaReadCacheConformance({ vendor: "the fake", create: createLankaFakeReadCache, settleMs: 5 });
