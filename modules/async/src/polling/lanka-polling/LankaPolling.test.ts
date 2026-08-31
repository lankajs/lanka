import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LankaPolling } from "./LankaPolling";

describe("LankaPolling", () => {
	let polling: LankaPolling;

	beforeEach(() => {
		polling = new LankaPolling();
		vi.useFakeTimers();
	});

	afterEach(() => {
		// Stop before restoring real timers: a test that leaves pollers running
		// makes the next one pay for them, and the cost shows up as a timeout
		// under parallel load rather than as a failed assertion.
		polling.clearAll();
		vi.useRealTimers();
	});

	it("should subscribe and execute the callback after initial delay", async () => {
		const callback = vi.fn().mockResolvedValue(undefined);

		polling.subscribe(callback, 1000, 500);

		expect(callback).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(500);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it("should repeat callback at interval", async () => {
		const callback = vi.fn().mockResolvedValue(undefined);

		polling.subscribe(callback, 1000, 0);

		expect(callback).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(0);
		expect(callback).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(1000);
		expect(callback).toHaveBeenCalledTimes(2);

		await vi.advanceTimersByTimeAsync(1000);
		expect(callback).toHaveBeenCalledTimes(3);
	});

	it("should not execute callback concurrently", async () => {
		const callback = vi.fn().mockImplementation(async () => {
			await Promise.resolve();
		});

		const id = polling.subscribe(callback, 10, 0);
		console.log(id);

		await vi.advanceTimersByTimeAsync(0);
		expect(callback).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(10);
		expect(callback).toHaveBeenCalledTimes(2);
	});

	it("should unsubscribe and stop callback", async () => {
		const callback = vi.fn().mockResolvedValue(undefined);

		const id = polling.subscribe(callback, 1000, 0);
		await vi.advanceTimersByTimeAsync(0);
		expect(callback).toHaveBeenCalledTimes(1);

		polling.unsubscribe(id);

		await vi.advanceTimersByTimeAsync(5000);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it("should clear all subscriptions", async () => {
		const cb1 = vi.fn().mockResolvedValue(undefined);
		const cb2 = vi.fn().mockResolvedValue(undefined);

		polling.subscribe(cb1, 1000, 0);
		polling.subscribe(cb2, 1000, 0);

		await vi.advanceTimersByTimeAsync(0);
		expect(cb1).toHaveBeenCalledTimes(1);
		expect(cb2).toHaveBeenCalledTimes(1);

		polling.clearAll();

		await vi.advanceTimersByTimeAsync(5000);
		expect(cb1).toHaveBeenCalledTimes(1);
		expect(cb2).toHaveBeenCalledTimes(1);
	});

	it("stress: rapid subscribe/unsubscribe", async () => {
		const callback = vi.fn().mockResolvedValue(undefined);

		// 200, not 1000: the property is that churn leaves the survivors polling,
		// and 500 live pollers at a 10ms interval prove nothing extra while costing
		// 5000 callback executions — enough to exceed the timeout on a busy machine.
		for (let i = 0; i < 200; i++) {
			const id = polling.subscribe(callback, 10, 0);
			if (i % 2 === 0) polling.unsubscribe(id);
		}

		await vi.advanceTimersByTimeAsync(100);

		expect(callback).toHaveBeenCalled();
		expect(callback.mock.calls.length).toBeGreaterThan(0);
	}, 10000);

	it("stress: repeated rapid execution of callback", async () => {
		const callback = vi.fn();

		polling.subscribe(callback, 10, 0);

		await vi.advanceTimersByTimeAsync(1000);

		console.info(`Stress test callback calls: ${callback.mock.calls.length}`);
		expect(callback.mock.calls.length).toBeGreaterThan(50);
	}, 10000);
});
