import { describe, expect, it } from "vitest";
import type { ILankaReadCache, TLankaCacheKey } from "lanka/cache";

/**
 * What every read cache must DO, asserted once for everyone who implements one.
 *
 * ## Why this is not each package's own test file
 *
 * `ILankaReadCache` is seven signatures, and signatures are not where two honest
 * implementations differ. They differ on whether `subscribe` delivers the
 * current value, on what `invalidate` does when nobody is listening, on whether
 * a failed read is remembered. Every one of those is invisible in a type and
 * fatal in a ViewModel.
 *
 * Written by hand per package, the copies diverge — not the day they are
 * written, but the day one gains an assertion and the others do not. The package
 * that then stops keeping the promise has a green suite, which is a check that
 * never asked the question.
 *
 * So the assertions live here. A member of `modules/query/` calls this, and so
 * does an application that wrote its own adapter over a cache this repository
 * never heard of:
 *
 * ```ts
 * lankaReadCacheConformance({ vendor: "my cache", create: () => createMyCache(client) });
 * ```
 *
 * A failure names the clause, so what comes back is "clause 6 — read rejects
 * with exactly what the loader threw", not "expected true to be false".
 *
 * ## Why the scenes are DATA
 *
 * `LANKA_READ_CACHE_SCENES` is the list, and this function only hands it to
 * `describe`/`it`. That split is what lets the suite's own spec run a scene
 * against a deliberately BROKEN cache and assert that it fails: a suite which
 * only ever passes real implementations proves that it agrees with them, not
 * that it checks them.
 *
 * ## What it does not check
 *
 * Four promises cannot be observed from inside an implementation, and belong to
 * whoever wires it: a subscriber must not write the key it observes; on a server
 * the cache is per REQUEST; one client instance per application; and the cache
 * never fetches by itself — the loader comes from a gateway, through a
 * ViewModel. They are in the port's docblock and in each member's guide.
 */

/** One implementation's entry into the shared assertions. */
export interface ILankaReadCacheConformance {
	/** The implementation's name, as it appears in the test output. */
	vendor: string;
	/** A FRESH cache per scene. A shared one makes each scene depend on its neighbour. */
	create: () => ILankaReadCache;
	/**
	 * How long a scene may wait for this implementation to settle, in ms.
	 *
	 * A `Map` settles in a microtask; a real vendor schedules. Raise it rather
	 * than guess: a suite that sleeps longer than it must is one people stop
	 * running.
	 */
	settleMs?: number;
}

/** One assertion about the port, runnable on its own. */
export interface ILankaReadCacheScene {
	/** The clause of `ILankaReadCache` this holds to account. */
	clause: number;
	/** Which part of the port it is about, for the output. */
	group: string;
	/** Reads as a sentence about the cache. */
	title: string;
	/** Throws when the cache breaks the clause. */
	check: (create: () => ILankaReadCache, settle: () => Promise<void>) => Promise<void>;
}

/** The key every scene uses, unless it is about two keys. */
const KEY: TLankaCacheKey = ["order", 1];
const OTHER: TLankaCacheKey = ["order", 2];

/** A loader that can be settled from the outside, so a scene controls the order. */
const deferred = <TData>() => {
	let settle: (value: TData) => void = () => undefined;
	const promise = new Promise<TData>((resolve) => {
		settle = resolve;
	});

	return { promise, settle };
};

/**
 * A loader that counts its calls.
 *
 * Hand-rolled rather than `vi.fn`, so a scene runs anywhere a promise runs —
 * including inside the suite's own spec, which calls scenes directly.
 */
const counting = <TData>(answer: () => Promise<TData>) => {
	let calls = 0;
	const load = () => {
		calls += 1;
		return answer();
	};

	return {
		load,
		get calls() {
			return calls;
		},
	};
};

const answering =
	<TData>(data: TData) =>
	() =>
		Promise.resolve(data);

/** Everything the port promises, as a list a runner can walk. */
export const LANKA_READ_CACHE_SCENES: readonly ILankaReadCacheScene[] = [
	{
		clause: 5,
		group: "reading",
		title: "answers from memory while fresh, so one key is one request",
		check: async (create) => {
			const cache = create();
			const loader = counting(answering({ id: 1 }));

			await cache.read(KEY, loader.load, { staleMs: 60_000 });
			await cache.read(KEY, loader.load, { staleMs: 60_000 });

			expect(loader.calls).toBe(1);
		},
	},
	{
		clause: 5,
		group: "reading",
		title: "lets two concurrent readers join one request",
		check: async (create) => {
			const cache = create();
			const gate = deferred<{ id: number }>();
			const loader = counting(() => gate.promise);

			const both = Promise.all([
				cache.read(KEY, loader.load, { staleMs: 60_000 }),
				cache.read(KEY, loader.load, { staleMs: 60_000 }),
			]);
			gate.settle({ id: 1 });

			expect(await both).toEqual([{ id: 1 }, { id: 1 }]);
			expect(loader.calls).toBe(1);
		},
	},
	{
		clause: 5,
		group: "reading",
		title: "treats two keys as two resources",
		check: async (create) => {
			const cache = create();
			const loader = counting(answering({ id: 1 }));

			await cache.read(KEY, loader.load, { staleMs: 60_000 });
			await cache.read(OTHER, loader.load, { staleMs: 60_000 });

			expect(loader.calls).toBe(2);
		},
	},
	{
		clause: 5,
		group: "reading",
		title: "lets TEN concurrent readers join one request",
		check: async (create) => {
			// Two readers can be deduplicated by accident — by a lock that happens to
			// cover the gap. Ten makes the question "is there one entry per key" and
			// not "is there a race".
			const cache = create();
			const gate = deferred<{ id: number }>();
			const loader = counting(() => gate.promise);

			const all = Promise.all(
				Array.from({ length: 10 }, () => cache.read(KEY, loader.load, { staleMs: 60_000 })),
			);
			gate.settle({ id: 1 });

			expect(await all).toHaveLength(10);
			expect(loader.calls).toBe(1);
		},
	},
	{
		clause: 5,
		group: "reading",
		title: "keeps two keys apart while both are in flight",
		check: async (create) => {
			// One entry map with a shared "loading" flag passes every single-key
			// scene and fails this one: the second key would join the first's request
			// and answer with its data.
			const cache = create();
			const first = deferred<{ which: string }>();
			const second = deferred<{ which: string }>();

			const both = Promise.all([
				cache.read(KEY, () => first.promise, { staleMs: 60_000 }),
				cache.read(OTHER, () => second.promise, { staleMs: 60_000 }),
			]);
			second.settle({ which: "second" });
			first.settle({ which: "first" });

			expect(await both).toEqual([{ which: "first" }, { which: "second" }]);
		},
	},
	{
		clause: 7,
		group: "reading",
		title: "does not let one key's failure reach its neighbour",
		check: async (create) => {
			const cache = create();
			const thrown = new Error("only this key");

			await expect(cache.read(KEY, () => Promise.reject(thrown))).rejects.toBe(thrown);
			await expect(
				cache.read(OTHER, answering({ id: 2 }), { staleMs: 60_000 }),
			).resolves.toEqual({ id: 2 });

			expect(cache.peek(KEY)).toBeUndefined();
			expect(cache.peek(OTHER)).toEqual({ id: 2 });
		},
	},
	{
		clause: 6,
		group: "reading",
		title: "rejects with EXACTLY what the loader threw",
		check: async (create) => {
			// A ViewModel branches on `LankaError.kind` to decide whether a failure
			// belongs to a form or to the screen. An implementation that wraps the
			// error turns every failure into the screen's.
			const thrown = new Error("the server said no");

			await expect(create().read(KEY, () => Promise.reject(thrown))).rejects.toBe(thrown);
		},
	},
	{
		clause: 7,
		group: "reading",
		title: "does not remember a failure as data",
		check: async (create) => {
			const cache = create();
			let first = true;
			const load = () => {
				if (first) {
					first = false;
					return Promise.reject(new Error("once"));
				}
				return Promise.resolve({ id: 1 });
			};

			await expect(cache.read(KEY, load, { staleMs: 60_000 })).rejects.toThrow("once");
			await expect(cache.read(KEY, load, { staleMs: 60_000 })).resolves.toEqual({ id: 1 });
			expect(cache.peek(KEY)).toEqual({ id: 1 });
		},
	},
	{
		clause: 12,
		group: "reading",
		title: "never refetches on its own",
		check: async (create, settle) => {
			const cache = create();
			const loader = counting(answering({ id: 1 }));
			const release = cache.subscribe(KEY, () => undefined);

			await cache.read(KEY, loader.load, { staleMs: 60_000 });
			await settle();
			release();

			// A background revalidation would change what a form was opened on,
			// under the hands of whoever is typing into it.
			expect(loader.calls).toBe(1);
		},
	},
	{
		clause: 4,
		group: "looking without asking",
		title: "peeks at what is cached without fetching",
		check: async (create) => {
			const cache = create();
			const loader = counting(answering({ id: 1 }));
			await cache.read(KEY, loader.load, { staleMs: 60_000 });

			expect(cache.peek(KEY)).toEqual({ id: 1 });
			expect(loader.calls).toBe(1);
		},
	},
	{
		clause: 4,
		group: "looking without asking",
		title: "answers undefined for an unknown key rather than throwing",
		check: (create) => {
			expect(create().peek(["never", "asked"])).toBeUndefined();
			return Promise.resolve();
		},
	},
	{
		clause: 4,
		group: "looking without asking",
		title: "peeks at stale data too",
		check: async (create) => {
			const cache = create();
			await cache.read(KEY, answering({ id: 1 }), { staleMs: 0 });

			// Nothing was invalidated, so the value is still there to look at —
			// "is it fresh" is `read`'s question, not `peek`'s.
			expect(cache.peek(KEY)).toEqual({ id: 1 });
		},
	},
	{
		clause: 9,
		group: "being told",
		title: "reaches the key's subscribers before `write` returns",
		check: (create) => {
			const cache = create();
			const heard: unknown[] = [];
			cache.subscribe(KEY, (data) => heard.push(data));

			cache.write(KEY, { id: 1, name: "written" });

			expect(heard).toEqual([{ id: 1, name: "written" }]);
			return Promise.resolve();
		},
	},
	{
		clause: 9,
		group: "being told",
		title: "keeps another key's write to itself",
		check: (create) => {
			const cache = create();
			const heard: unknown[] = [];
			cache.subscribe(KEY, (data) => heard.push(data));

			cache.write(OTHER, { id: 2 });

			expect(heard).toEqual([]);
			return Promise.resolve();
		},
	},
	{
		clause: 1,
		group: "being told",
		title: "does NOT deliver the current value on subscribe",
		check: async (create, settle) => {
			// The divergence this clause exists for: one library's `subscribe` calls
			// the listener immediately and another's does not. A ViewModel receiving
			// the current value as an event takes `undefined` for data the moment it
			// starts listening.
			const cache = create();
			await cache.read(KEY, answering({ id: 1 }), { staleMs: 60_000 });

			const heard: unknown[] = [];
			cache.subscribe(KEY, (data) => heard.push(data));
			await settle();

			expect(heard).toEqual([]);
			expect(cache.peek(KEY)).toEqual({ id: 1 });
		},
	},
	{
		clause: 2,
		group: "being told",
		title: "does not deliver a failed read as data",
		check: async (create, settle) => {
			const cache = create();
			const heard: unknown[] = [];
			cache.subscribe(KEY, (data) => heard.push(data));

			await cache.read(KEY, () => Promise.reject(new Error("no"))).catch(() => undefined);
			await settle();

			expect(heard).toEqual([]);
		},
	},
	{
		clause: 3,
		group: "being told",
		title: "releases its own listener and only its own",
		check: async (create, settle) => {
			const cache = create();
			const first: unknown[] = [];
			const second: unknown[] = [];
			const releaseFirst = cache.subscribe(KEY, (data) => first.push(data));
			cache.subscribe(KEY, (data) => second.push(data));

			releaseFirst();
			cache.write(KEY, { id: 1 });
			await settle();

			expect(first).toEqual([]);
			expect(second).toEqual([{ id: 1 }]);
		},
	},
	{
		clause: 3,
		group: "being told",
		title: "does nothing when a release is called twice",
		check: async (create, settle) => {
			const cache = create();
			const heard: unknown[] = [];
			const release = cache.subscribe(KEY, (data) => heard.push(data));
			const other = cache.subscribe(KEY, () => undefined);

			release();
			release();
			cache.write(KEY, { id: 1 });
			await settle();
			other();

			expect(heard).toEqual([]);
		},
	},
	{
		clause: 8,
		group: "going stale, and going away",
		title: "asks nobody when invalidating what nobody watches",
		check: async (create, settle) => {
			const cache = create();
			const loader = counting(answering({ id: 1 }));
			await cache.read(KEY, loader.load, { staleMs: 60_000 });

			await cache.invalidate(KEY);
			await settle();

			expect(loader.calls).toBe(1);
		},
	},
	{
		clause: 8,
		group: "going stale, and going away",
		title: "asks again at once while somebody is subscribed, and tells them",
		check: async (create, settle) => {
			// The other half of clause 8, and the half an implementation is most
			// likely to skip: a watched resource must come back by itself, or the
			// screen looking at it keeps showing what was just invalidated.
			const cache = create();
			let answer = 1;
			const load = counting(() => Promise.resolve({ id: answer }));
			await cache.read(KEY, load.load, { staleMs: 60_000 });

			const heard: unknown[] = [];
			const release = cache.subscribe(KEY, (data) => heard.push(data));
			answer = 2;
			await cache.invalidate(KEY);
			await settle();
			release();

			expect(load.calls).toBe(2);
			expect(heard).toEqual([{ id: 2 }]);
		},
	},
	{
		clause: 8,
		group: "going stale, and going away",
		title: "asks again on the next read after invalidating",
		check: async (create) => {
			const cache = create();
			const loader = counting(answering({ id: 1 }));
			await cache.read(KEY, loader.load, { staleMs: 60_000 });

			await cache.invalidate(KEY);
			await cache.read(KEY, loader.load, { staleMs: 60_000 });

			expect(loader.calls).toBe(2);
		},
	},
	{
		clause: 8,
		group: "going stale, and going away",
		title: "does not treat invalidating an unread key as an error",
		check: async (create) => {
			await expect(create().invalidate(["never", "asked"])).resolves.toBeUndefined();
		},
	},
	{
		clause: 10,
		group: "going stale, and going away",
		title: "empties everything on clear",
		check: async (create) => {
			const cache = create();
			await cache.read(KEY, answering({ id: 1 }), { staleMs: 60_000 });

			cache.clear();

			expect(cache.peek(KEY)).toBeUndefined();
		},
	},
	{
		clause: 10,
		group: "going stale, and going away",
		title: "tells nobody on clear",
		check: async (create, settle) => {
			// It runs when a session ends. A notification would repaint screens that
			// are being torn down, with data the next user must not see.
			const cache = create();
			await cache.read(KEY, answering({ id: 1 }), { staleMs: 60_000 });
			const heard: unknown[] = [];
			cache.subscribe(KEY, (data) => heard.push(data));

			cache.clear();
			await settle();

			expect(heard).toEqual([]);
		},
	},
	{
		clause: 10,
		group: "going stale, and going away",
		title: "starts over after a clear, rather than answering from what it forgot",
		check: async (create) => {
			// A cache that emptied its VALUES but kept its freshness clock would
			// answer the next read with `undefined` and no request — the screen after
			// a sign-out showing nothing, for ever.
			const cache = create();
			const loader = counting(answering({ id: 1 }));
			await cache.read(KEY, loader.load, { staleMs: 60_000 });

			cache.clear();
			await expect(cache.read(KEY, loader.load, { staleMs: 60_000 })).resolves.toEqual({
				id: 1,
			});

			expect(loader.calls).toBe(2);
		},
	},
	{
		clause: 3,
		group: "being told",
		title: "survives a listener that releases itself while being told",
		check: async (create, settle) => {
			// A screen unsubscribing inside its own handler is ordinary — a modal
			// closing on the change it just heard. An implementation iterating its
			// live listener set skips the next one, silently.
			const cache = create();
			const heard: string[] = [];
			const releaseFirst = cache.subscribe(KEY, () => {
				heard.push("first");
				releaseFirst();
			});
			cache.subscribe(KEY, () => heard.push("second"));

			cache.write(KEY, { id: 1 });
			await settle();

			expect(heard).toEqual(["first", "second"]);
		},
	},
	{
		clause: 11,
		group: "cancellation",
		title: "declares `cancel` only if it really aborts",
		check: async (create) => {
			const cache = create();
			if (!cache.cancel) {
				// Absent is a legal answer, and the honest one for a library whose
				// loader never receives a signal. A caller reads absence as "the
				// request finishes and its answer is discarded".
				expect(cache.cancel).toBeUndefined();
				return;
			}

			const gate = deferred<{ id: number }>();
			let seen: AbortSignal | undefined;
			const reading = cache
				.read(KEY, (signal) => {
					seen = signal;
					return gate.promise;
				})
				.catch(() => undefined);

			cache.cancel(KEY);
			gate.settle({ id: 1 });
			await reading;

			expect(seen, "declares `cancel` and hands its loader no signal").toBeDefined();
			expect(seen?.aborted, "declares `cancel` and does not abort").toBe(true);
		},
	},
];

/**
 * Registers the shared scenes against one implementation.
 *
 * Call it inside the package's own spec, so the output says which implementation
 * failed without every title repeating the name.
 */
export const lankaReadCacheConformance = ({
	vendor,
	create,
	settleMs = 30,
}: ILankaReadCacheConformance): void => {
	const settle = () => new Promise<void>((resolve) => setTimeout(resolve, settleMs));
	const groups = [...new Set(LANKA_READ_CACHE_SCENES.map((scene) => scene.group))];

	for (const group of groups) {
		describe(`${vendor} — ${group}`, () => {
			for (const scene of LANKA_READ_CACHE_SCENES.filter((one) => one.group === group)) {
				it(`clause ${String(scene.clause)}: ${scene.title}`, () =>
					scene.check(create, settle));
			}
		});
	}
};
