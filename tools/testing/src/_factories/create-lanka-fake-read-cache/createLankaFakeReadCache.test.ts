import { describe, expect, it } from "vitest";
import { createLankaFakeReadCache } from "./createLankaFakeReadCache";

/**
 * The two things the fake offers BEYOND the port.
 *
 * Every clause of `ILankaReadCache` is asserted by the conformance suite, which
 * runs over this fake as its second implementation — repeating any of it here
 * would be a copy that could quietly stop agreeing. What is left is the pair of
 * members the port does not have: the load counter and the clock. Both exist so
 * a scene can state a fact about staleness without sleeping for it, and a clock
 * nothing ever winds is a clock that could be broken without anybody noticing.
 */

const answering = (value: string) => {
	let calls = 0;
	return {
		calls: () => calls,
		load: () => {
			calls += 1;
			return Promise.resolve(`${value} ${calls}`);
		},
	};
};

describe("createLankaFakeReadCache — beyond the port", () => {
	it("counts the loader's calls per key, not per read", async () => {
		const cache = createLankaFakeReadCache();
		const orders = answering("orders");

		await cache.read(["orders"], orders.load, { staleMs: 1000 });
		await cache.read(["orders"], orders.load, { staleMs: 1000 });
		await cache.read(["order", 1], orders.load, { staleMs: 1000 });

		expect(cache.loads.get(JSON.stringify(["orders"]))).toBe(1);
		expect(cache.loads.get(JSON.stringify(["order", 1]))).toBe(1);
	});

	it("holds an answer fresh until the clock is wound past its window", async () => {
		const cache = createLankaFakeReadCache();
		const orders = answering("orders");

		const first = await cache.read(["orders"], orders.load, { staleMs: 1000 });
		cache.advance(999);
		const within = await cache.read(["orders"], orders.load, { staleMs: 1000 });

		expect(within).toBe(first);
		expect(orders.calls()).toBe(1);
	});

	it("asks again once the window has passed", async () => {
		// The boundary is deliberate: `staleMs` is how long an answer stays usable,
		// so exactly `staleMs` later it still is, and a millisecond after it is not.
		const cache = createLankaFakeReadCache();
		const orders = answering("orders");

		await cache.read(["orders"], orders.load, { staleMs: 1000 });
		cache.advance(1000);
		await cache.read(["orders"], orders.load, { staleMs: 1000 });
		expect(orders.calls()).toBe(1);

		cache.advance(1);
		const after = await cache.read(["orders"], orders.load, { staleMs: 1000 });

		expect(orders.calls()).toBe(2);
		expect(after).toBe("orders 2");
	});

	it("treats an answer with no window as stale the moment it is given", async () => {
		// `staleMs` omitted means zero, which is what makes a read-through cache
		// behave like no cache at all rather than like a permanent one — the safer
		// of the two defaults, and the one a scene relies on when it omits it.
		const cache = createLankaFakeReadCache();
		const orders = answering("orders");

		await cache.read(["orders"], orders.load);
		cache.advance(1);
		await cache.read(["orders"], orders.load);

		expect(orders.calls()).toBe(2);
	});

	it("still answers `peek` with what went stale, because stale is not gone", async () => {
		const cache = createLankaFakeReadCache();
		const orders = answering("orders");

		await cache.read(["orders"], orders.load, { staleMs: 10 });
		cache.advance(1000);

		expect(cache.peek(["orders"])).toBe("orders 1");
	});

	it("does not count a read that was joined to one already in flight", async () => {
		const cache = createLankaFakeReadCache();
		const orders = answering("orders");

		await Promise.all([
			cache.read(["orders"], orders.load, { staleMs: 1000 }),
			cache.read(["orders"], orders.load, { staleMs: 1000 }),
			cache.read(["orders"], orders.load, { staleMs: 1000 }),
		]);

		expect(cache.loads.get(JSON.stringify(["orders"]))).toBe(1);
	});
});
