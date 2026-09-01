import { describe, expect, it, vi } from "vitest";
import { LankaIntentPrefetch } from "./LankaIntentPrefetch";
import { defineLankaPrefetchResource } from "../resource/defineLankaPrefetchResource";

/**
 * The intent buffer: it warms what the user is already reaching for.
 *
 * Every assertion here pins a property whose loss is INVISIBLE: the buffer has
 * no interface and no user-visible effect, so broken looks exactly like off.
 */

const thingDetail = defineLankaPrefetchResource({
	id: "gap-detail",
	identify: (params) => params.thingId,
	domain: "gap",
	fetch: (params) => Promise.resolve({ id: Number(params.thingId) }),
});

/** A clock that lets tests move time without faking timers. */
const createClock = () => {
	let now = 0;
	return {
		now: () => now,
		advance: (ms: number) => {
			now += ms;
		},
	};
};

describe("LankaIntentPrefetch — claiming data", () => {
	it("hands warmed data to whoever would otherwise fetch it", async () => {
		const buffer = new LankaIntentPrefetch();

		buffer.lankaPrefetch(thingDetail, { thingId: "7" });
		const claimed = await buffer.claim(thingDetail, { thingId: "7" });

		expect(claimed).toEqual({ id: 7 });
	});

	it("returns `undefined` for what is not warmed, not an empty value", async () => {
		// The distinction carries a decision: `undefined` means "fetch it yourself",
		// `null` means "warmed but stale". Confusing them means either not fetching
		// at all or fetching twice.
		const buffer = new LankaIntentPrefetch();

		expect(buffer.claim(thingDetail, { thingId: "7" })).toBeUndefined();
		await Promise.resolve();
	});

	it("each entry is spent once", async () => {
		const buffer = new LankaIntentPrefetch();
		buffer.lankaPrefetch(thingDetail, { thingId: "7" });

		await buffer.claim(thingDetail, { thingId: "7" });

		expect(buffer.claim(thingDetail, { thingId: "7" })).toBeUndefined();
	});

	it("a claimer arriving mid-flight gets THE SAME promise, not a second request", async () => {
		// On a slow connection that duplicate is the difference between a prefetch
		// that helps and one that gets in the way of navigation.
		const fetch = vi.fn(() => new Promise<{ id: number }>(() => undefined));
		const slow = defineLankaPrefetchResource({ ...thingDetail, fetch });
		const buffer = new LankaIntentPrefetch();

		buffer.lankaPrefetch(slow, { thingId: "7" });
		const claimed = buffer.claim(slow, { thingId: "7" });

		expect(claimed).toBeDefined();
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it("a key containing `undefined` spends no request", async () => {
		// Nobody could claim such an entry: the claimer computes its key from its own
		// params and gets a different string. This is what a trigger passing the
		// wrong parameter shape looks like, and it is otherwise invisible.
		const fetch = vi.fn(() => Promise.resolve({ id: 1 }));
		const buffer = new LankaIntentPrefetch();

		buffer.lankaPrefetch(defineLankaPrefetchResource({ ...thingDetail, fetch }), {});
		await Promise.resolve();

		expect(fetch).not.toHaveBeenCalled();
	});
});

describe("LankaIntentPrefetch — the priority ladder", () => {
	it("yields to another request on the wire", async () => {
		const fetch = vi.fn(() => Promise.resolve({ id: 1 }));
		const buffer = new LankaIntentPrefetch({ activeRequests: () => 1 });

		buffer.lankaPrefetch(defineLankaPrefetchResource({ ...thingDetail, fetch }), {
			thingId: "7",
		});
		await Promise.resolve();

		expect(fetch).not.toHaveBeenCalled();
		expect(buffer.getDiagnostics().yielded).toBe(1);
	});

	it("does NOT count its own requests as foreign", async () => {
		// The counter counts every request, warm-ups included. Without subtracting
		// its own, the buffer would see the wire as busy after its first warm-up
		// and stop itself — permanently.
		let active = 0;
		const fetch = vi.fn(() => {
			active += 1;
			return new Promise<{ id: number }>(() => undefined);
		});
		const buffer = new LankaIntentPrefetch({
			maxConcurrent: 5,
			activeRequests: () => active,
		});
		const resource = defineLankaPrefetchResource({ ...thingDetail, fetch });

		buffer.lankaPrefetch(resource, { thingId: "7" });
		buffer.lankaPrefetch(resource, { thingId: "8" });
		await Promise.resolve();

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(buffer.getDiagnostics().yielded).toBe(0);
	});

	it("a counter skew reads as “nothing foreign”, not as a negative number", async () => {
		// A negative value would silently disable the gate in the other direction.
		const fetch = vi.fn(() => Promise.resolve({ id: 1 }));
		const buffer = new LankaIntentPrefetch({ activeRequests: () => 0 });

		buffer.lankaPrefetch(defineLankaPrefetchResource({ ...thingDetail, fetch }), {
			thingId: "7",
		});
		await Promise.resolve();

		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it("does not exceed the warm-up concurrency limit", async () => {
		const fetch = vi.fn(() => new Promise<{ id: number }>(() => undefined));
		const buffer = new LankaIntentPrefetch({ maxConcurrent: 1 });
		const resource = defineLankaPrefetchResource({ ...thingDetail, fetch });

		buffer.lankaPrefetch(resource, { thingId: "7" });
		buffer.lankaPrefetch(resource, { thingId: "8" });
		await Promise.resolve();

		expect(fetch).toHaveBeenCalledTimes(1);
	});
});

describe("LankaIntentPrefetch — freshness fences", () => {
	it("a live event makes warmed data unusable", async () => {
		const buffer = new LankaIntentPrefetch();
		buffer.lankaPrefetch(thingDetail, { thingId: "7" });
		await Promise.resolve();

		buffer.bumpFence("gap", "event arrived");

		expect(buffer.claim(thingDetail, { thingId: "7" })).toBeUndefined();
		expect(buffer.getDiagnostics().fenced).toBe(1);
	});

	it("an event arriving AFTER a claim yields `null` rather than stale data", async () => {
		// By then the entry is out of the buffer and nothing could drop it. `null`
		// sends the caller to fetch for itself, which now happens after the event.
		let resolveFetch!: (value: { id: number }) => void;
		const resource = defineLankaPrefetchResource({
			...thingDetail,
			fetch: () =>
				new Promise<{ id: number }>((resolve) => {
					resolveFetch = resolve;
				}),
		});
		const buffer = new LankaIntentPrefetch();

		buffer.lankaPrefetch(resource, { thingId: "7" });
		const claimed = buffer.claim(resource, { thingId: "7" });
		buffer.bumpFence("gap", "event while in flight");
		resolveFetch({ id: 7 });

		await expect(claimed).resolves.toBeNull();
	});

	it("another domain's fence touches nothing", async () => {
		const buffer = new LankaIntentPrefetch();
		buffer.lankaPrefetch(thingDetail, { thingId: "7" });
		await Promise.resolve();

		buffer.bumpFence("meeting", "another domain");

		await expect(buffer.claim(thingDetail, { thingId: "7" })).resolves.toEqual({ id: 7 });
	});

	it("the fence is checked BEFORE the TTL", async () => {
		// An entry the world overtook is not "old" but wrong, and no TTL check may
		// hand it out.
		const clock = createClock();
		const buffer = new LankaIntentPrefetch({ clock: clock.now, ttlMs: 1_000 });
		buffer.lankaPrefetch(thingDetail, { thingId: "7" });
		await Promise.resolve();

		buffer.bumpFence("gap", "event");
		clock.advance(10);

		expect(buffer.claim(thingDetail, { thingId: "7" })).toBeUndefined();
		expect(buffer.getDiagnostics().fenced).toBe(1);
		expect(buffer.getDiagnostics().expired).toBe(0);
	});
});

describe("LankaIntentPrefetch — TTL and eviction", () => {
	it("an expired entry is not handed out", async () => {
		const clock = createClock();
		const buffer = new LankaIntentPrefetch({ clock: clock.now, ttlMs: 100 });
		buffer.lankaPrefetch(thingDetail, { thingId: "7" });
		await Promise.resolve();

		clock.advance(101);

		expect(buffer.claim(thingDetail, { thingId: "7" })).toBeUndefined();
		expect(buffer.getDiagnostics().expired).toBe(1);
	});

	it("an entry's age is counted from the RESPONSE, not from sending", async () => {
		// Otherwise a slow request would expire before anyone had a chance to await
		// it — prefetch would not work on a bad connection, which is exactly where
		// it is needed most.
		const clock = createClock();
		let resolveFetch!: (value: { id: number }) => void;
		const resource = defineLankaPrefetchResource({
			...thingDetail,
			fetch: () =>
				new Promise<{ id: number }>((resolve) => {
					resolveFetch = resolve;
				}),
		});
		const buffer = new LankaIntentPrefetch({ clock: clock.now, ttlMs: 100 });

		buffer.lankaPrefetch(resource, { thingId: "7" });
		clock.advance(5_000);
		resolveFetch({ id: 7 });
		await Promise.resolve();

		expect(buffer.claim(resource, { thingId: "7" })).toBeDefined();
	});

	it("evicts the oldest settled entry, not one in flight", async () => {
		// Dropping an in-flight entry leaves the claimer fetching in parallel with a
		// request already sent — the exact duplicate this service exists to avoid.
		const buffer = new LankaIntentPrefetch({ maxBuffered: 1, maxConcurrent: 5 });
		buffer.lankaPrefetch(thingDetail, { thingId: "1" });
		await Promise.resolve();
		await Promise.resolve();

		const hanging = defineLankaPrefetchResource({
			...thingDetail,
			fetch: () => new Promise<{ id: number }>(() => undefined),
		});
		buffer.lankaPrefetch(hanging, { thingId: "2" });

		expect(buffer.getDiagnostics().buffered).toEqual(["gap-detail:2"]);
	});
});

describe("LankaIntentPrefetch — failures and cleanup", () => {
	it("a warm-up failure does not surface as an application error", async () => {
		const buffer = new LankaIntentPrefetch();
		const failing = defineLankaPrefetchResource({
			...thingDetail,
			fetch: () => Promise.reject(new Error("network unavailable")),
		});

		buffer.lankaPrefetch(failing, { thingId: "7" });
		await Promise.resolve();
		await Promise.resolve();

		expect(buffer.getDiagnostics().failed).toBe(1);
		expect(buffer.claim(failing, { thingId: "7" })).toBeUndefined();
	});

	it("resetting a resource drops only its entries", async () => {
		const other = defineLankaPrefetchResource({ ...thingDetail, id: "gap-list" });
		const buffer = new LankaIntentPrefetch({ maxConcurrent: 5 });
		buffer.lankaPrefetch(thingDetail, { thingId: "7" });
		buffer.lankaPrefetch(other, { thingId: "7" });
		await Promise.resolve();

		buffer.invalidate("gap-detail");

		expect(buffer.getDiagnostics().buffered).toEqual(["gap-list:7"]);
	});

	it("clearing drops everything — on a shared device this is somebody else's data", async () => {
		const buffer = new LankaIntentPrefetch();
		buffer.lankaPrefetch(thingDetail, { thingId: "7" });
		await Promise.resolve();

		buffer.clear("end of session");

		expect(buffer.getDiagnostics().buffered).toEqual([]);
		expect(buffer.claim(thingDetail, { thingId: "7" })).toBeUndefined();
	});

	it("the hit rate is counted and reported", async () => {
		// The number that decides whether a trigger earns its place: a low rate
		// means it fires on gestures that are not navigation, and it should be
		// removed rather than tuned.
		const buffer = new LankaIntentPrefetch({ maxConcurrent: 5 });
		buffer.lankaPrefetch(thingDetail, { thingId: "7" });
		buffer.lankaPrefetch(thingDetail, { thingId: "8" });
		await Promise.resolve();
		await buffer.claim(thingDetail, { thingId: "7" });

		expect(buffer.getDiagnostics().hitRate).toBe(0.5);
	});
});
