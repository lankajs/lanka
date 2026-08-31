import { describe, expect, it, vi } from "vitest";
import { createLankaBurstCoalescer } from "./createLankaBurstCoalescer";

/**
 * The primitive burst handling rests on. Its two halves pull in opposite
 * directions and both matter: collapse enough not to flood the wire, but never
 * so much that the burst's last event goes unread.
 */

function createDeferred() {
	let resolvePromise!: () => void;
	let rejectPromise!: (error: unknown) => void;
	const promise = new Promise<void>((resolve, reject) => {
		resolvePromise = resolve;
		rejectPromise = reject;
	});
	return { promise, resolve: resolvePromise, reject: rejectPromise };
}

describe("createLankaBurstCoalescer", () => {
	it("a single call runs immediately", async () => {
		const coalescer = createLankaBurstCoalescer<number>();
		const operation = vi.fn().mockResolvedValue(undefined);

		await coalescer.run(1, operation);

		expect(operation).toHaveBeenCalledTimes(1);
	});

	it("a burst collapses into the request that started it plus ONE trailing call", async () => {
		const coalescer = createLankaBurstCoalescer<number>();
		const first = createDeferred();
		const operation = vi
			.fn()
			.mockImplementationOnce(() => first.promise)
			.mockResolvedValue(undefined);

		const calls = Array.from({ length: 50 }, () => coalescer.run(1, operation));
		first.resolve();
		await Promise.all(calls);

		// 50 events, 2 requests — not 50, and not 1 (one would miss the tail).
		expect(operation).toHaveBeenCalledTimes(2);
	});

	it("every caller awaits the work that outlives its own call", async () => {
		const coalescer = createLankaBurstCoalescer<number>();
		const first = createDeferred();
		let trailingDone = false;
		const operation = vi
			.fn()
			.mockImplementationOnce(() => first.promise)
			.mockImplementation(async () => {
				trailingDone = true;
			});

		const leading = coalescer.run(1, operation);
		const joined = coalescer.run(1, operation);
		first.resolve();
		await Promise.all([leading, joined]);

		// A joiner must not settle before the trailing read it caused — otherwise the
		// loader awaiting it renders stale data.
		expect(trailingDone).toBe(true);
	});

	it("keys are independent", async () => {
		const coalescer = createLankaBurstCoalescer<number>();
		const operation = vi.fn().mockResolvedValue(undefined);

		await Promise.all([
			coalescer.run(1, operation),
			coalescer.run(2, operation),
			coalescer.run(3, operation),
		]);

		expect(operation).toHaveBeenCalledTimes(3);
	});

	it("after a burst settles, everything starts again", async () => {
		const coalescer = createLankaBurstCoalescer<number>();
		const operation = vi.fn().mockResolvedValue(undefined);

		await coalescer.run(1, operation);
		await coalescer.run(1, operation);

		expect(operation).toHaveBeenCalledTimes(2);
		expect(coalescer.pendingKeys()).toEqual([]);
	});

	it("makes no trailing pass when nobody joined", async () => {
		const coalescer = createLankaBurstCoalescer<number>();
		const operation = vi.fn().mockResolvedValue(undefined);

		await coalescer.run(1, operation);

		expect(operation).toHaveBeenCalledTimes(1);
	});

	it("clears the in-flight record when the operation REJECTED", async () => {
		// The failure that would matter most: a stuck record turns one network
		// failure into a screen that never updates again.
		const coalescer = createLankaBurstCoalescer<number>();
		const failing = vi.fn().mockRejectedValue(new Error("offline"));

		await expect(coalescer.run(1, failing)).rejects.toThrow("offline");
		expect(coalescer.pendingKeys()).toEqual([]);

		const succeeding = vi.fn().mockResolvedValue(undefined);
		await coalescer.run(1, succeeding);

		expect(succeeding).toHaveBeenCalledTimes(1);
	});

	it("a failure leaves no requested replay for the next burst", async () => {
		// Clearing the requested repeat AFTER `await operation()` never runs on a
		// failure: the flag outlives the burst that set it, and the next unrelated
		// call for the same key issues an extra request — a refresh nobody asked
		// for, caused by a failure at some earlier time.
		const coalescer = createLankaBurstCoalescer<number>();
		const first = createDeferred();
		const failing = vi.fn().mockImplementation(() => first.promise);

		const leading = coalescer.run(1, failing);
		const joined = coalescer.run(1, failing);
		first.reject(new Error("offline"));
		await expect(leading).rejects.toThrow("offline");
		await expect(joined).rejects.toThrow("offline");

		const later = vi.fn().mockResolvedValue(undefined);
		await coalescer.run(1, later);

		expect(later).toHaveBeenCalledTimes(1);
	});

	it("one key's failure does not cancel a replay requested on another", async () => {
		// Clearing the flag on failure must be surgical: otherwise fixing the defect
		// above would cost exactly what the trailing pass exists for.
		const coalescer = createLankaBurstCoalescer<number>();
		const failing = createDeferred();
		const healthy = createDeferred();
		const failingOperation = vi.fn().mockImplementation(() => failing.promise);
		const healthyOperation = vi
			.fn()
			.mockImplementationOnce(() => healthy.promise)
			.mockResolvedValue(undefined);

		const failingLeading = coalescer.run(1, failingOperation);
		void coalescer.run(1, failingOperation);
		const healthyLeading = coalescer.run(2, healthyOperation);
		const healthyJoined = coalescer.run(2, healthyOperation);

		failing.reject(new Error("offline"));
		await expect(failingLeading).rejects.toThrow("offline");
		healthy.resolve();
		await Promise.all([healthyLeading, healthyJoined]);

		expect(healthyOperation).toHaveBeenCalledTimes(2);
	});

	it("stress: a continuous event stream does not accumulate unbounded work", async () => {
		const coalescer = createLankaBurstCoalescer<number>();
		let running = 0;
		let peakConcurrent = 0;
		const operation = vi.fn().mockImplementation(async () => {
			running += 1;
			peakConcurrent = Math.max(peakConcurrent, running);
			await Promise.resolve();
			running -= 1;
		});

		for (let round = 0; round < 200; round += 1) {
			void coalescer.run(1, operation);
		}
		for (let tick = 0; tick < 20; tick += 1) await Promise.resolve();

		expect(peakConcurrent).toBe(1);
		expect(operation.mock.calls.length).toBeLessThanOrEqual(2);
		expect(coalescer.pendingKeys()).toEqual([]);
	});
});
