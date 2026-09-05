import { describe, expect, it, vi } from "vitest";
import { LankaDataWarmup } from "./LankaDataWarmup";

/**
 * The warm-up has no interface and no user-visible effect, so broken looks
 * exactly like off. Every gate here has a fixture that would run without it.
 */
const task = (key: string, order: number, run = () => Promise.resolve()) => ({
	key,
	order,
	run,
	keptFreshBy: "the refresh scenario",
});

const immediate = { whenIdle: (run: () => void) => run() };

/** Flushes the 50 ms polls and the timers a run awaits, under fake timers. */
const settle = async (ms = 1_000): Promise<void> => {
	await vi.advanceTimersByTimeAsync(ms);
};

describe("LankaDataWarmup — a run", () => {
	it("runs tasks in order", async () => {
		const seen: string[] = [];
		const warmup = new LankaDataWarmup({ maxConcurrent: 1, scheduler: immediate });

		await warmup.run([
			task("second", 2, () => {
				seen.push("second");
				return Promise.resolve();
			}),
			task("first", 1, () => {
				seen.push("first");
				return Promise.resolve();
			}),
		]);

		expect(seen).toEqual(["first", "second"]);
	});

	it("does not exceed the configured concurrency", async () => {
		let running = 0;
		let peak = 0;
		const busy = () => {
			running += 1;
			peak = Math.max(peak, running);
			return Promise.resolve().then(() => {
				running -= 1;
			});
		};
		const warmup = new LankaDataWarmup({ maxConcurrent: 2, scheduler: immediate });

		await warmup.run([task("a", 1, busy), task("b", 2, busy), task("c", 3, busy)]);

		expect(peak).toBe(2);
	});

	it("zero concurrency is clamped up instead of disabling warming", async () => {
		// Otherwise the setting would be accepted and silently disable everything:
		// "no effect" is the worst way to learn a value was wrong.
		const run = vi.fn(() => Promise.resolve());
		const warmup = new LankaDataWarmup({ maxConcurrent: 0, scheduler: immediate });

		await warmup.run([task("a", 1, run)]);

		expect(run).toHaveBeenCalledTimes(1);
	});

	it("reads an adaptive concurrency before every batch, and clamps it too", async () => {
		// A link that degrades mid-run narrows the next batch; a callback that
		// returns 0, a fraction or NaN must still advance the cursor — a batch of
		// zero is a microtask spin no timer can end.
		const answers = [2, 0, Number.NaN, 0.4];
		let running = 0;
		const peaks: number[] = [];
		const busy = () => {
			running += 1;
			peaks.push(running);
			return Promise.resolve().then(() => {
				running -= 1;
			});
		};
		const warmup = new LankaDataWarmup({
			concurrency: () => answers.shift() ?? 1,
			scheduler: immediate,
		});

		await warmup.run([
			task("a", 1, busy),
			task("b", 2, busy),
			task("c", 3, busy),
			task("d", 4, busy),
			task("e", 5, busy),
		]);

		expect(warmup.getDiagnostics().completed).toHaveLength(5);
		expect(Math.max(...peaks)).toBe(2);
	});

	it("one task's failure does not cancel the rest", async () => {
		// A batch is not a transaction: half a warm-up beats none.
		const second = vi.fn(() => Promise.resolve());
		const warmup = new LankaDataWarmup({
			maxConcurrent: 1,
			scheduler: immediate,
			retry: { delayMs: 0, passes: 0 },
		});

		await warmup.run([
			task("fails", 1, () => Promise.reject(new Error("network"))),
			task("works", 2, second),
		]);

		expect(second).toHaveBeenCalledTimes(1);
		expect(warmup.getDiagnostics().failed).toEqual(["fails"]);
	});

	it("what is already warmed does not run again", async () => {
		const run = vi.fn(() => Promise.resolve());
		const warmup = new LankaDataWarmup({ scheduler: immediate });

		await warmup.run([task("a", 1, run)]);
		await warmup.run([task("a", 1, run)]);

		expect(run).toHaveBeenCalledTimes(1);
	});

	it("waits for an idle frame before every batch, not before every task", async () => {
		const whenIdle = vi.fn((run: () => void) => run());
		const warmup = new LankaDataWarmup({ maxConcurrent: 2, scheduler: { whenIdle } });

		await warmup.run([task("a", 1), task("b", 2), task("c", 3)]);

		expect(whenIdle).toHaveBeenCalledTimes(2);
	});

	it("waiting for silence has a CEILING", async () => {
		// A gate without a ceiling is a way to never start: the wire can be busy for
		// a long time, and a warm-up waiting for perfect silence quietly never runs.
		const run = vi.fn(() => Promise.resolve());
		const warmup = new LankaDataWarmup({
			activeRequests: () => 5,
			quietWireTimeoutMs: 20,
			scheduler: immediate,
		});

		await warmup.run([task("a", 1, run)]);

		expect(run).toHaveBeenCalledTimes(1);
	});
});

describe("LankaDataWarmup — retry", () => {
	it("retries a failed task after the delay, and a later success clears the failure", async () => {
		vi.useFakeTimers();
		try {
			let calls = 0;
			const flaky = () => {
				calls += 1;
				return calls === 1 ? Promise.reject(new Error("network")) : Promise.resolve();
			};
			const warmup = new LankaDataWarmup({
				scheduler: immediate,
				retry: { delayMs: 1_000, passes: 1 },
			});

			const done = warmup.run([task("a", 1, flaky)]);
			await settle(900);
			expect(calls).toBe(1);
			await settle(200);
			await done;

			expect(calls).toBe(2);
			expect(warmup.getDiagnostics().completed).toEqual(["a"]);
			expect(warmup.getDiagnostics().failed).toEqual([]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("gives up after the configured passes", async () => {
		vi.useFakeTimers();
		try {
			const run = vi.fn(() => Promise.reject(new Error("network")));
			const warmup = new LankaDataWarmup({
				scheduler: immediate,
				retry: { delayMs: 10, passes: 2 },
			});

			const done = warmup.run([task("a", 1, run)]);
			await settle(100);
			await done;

			// The first pass plus two retries.
			expect(run).toHaveBeenCalledTimes(3);
			expect(warmup.getDiagnostics().failed).toEqual(["a"]);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("LankaDataWarmup — start(), its gates and the re-arm", () => {
	it("starts once however many times it is called, after the start delay", async () => {
		vi.useFakeTimers();
		try {
			const run = vi.fn(() => Promise.resolve());
			const warmup = new LankaDataWarmup({ scheduler: immediate, startDelayMs: 800 });
			warmup.setSource(() => [task("a", 1, run)]);

			warmup.start();
			warmup.start();
			await settle(700);
			expect(run).not.toHaveBeenCalled();
			await settle(200);

			expect(run).toHaveBeenCalledTimes(1);
			expect(warmup.getDiagnostics().hasStarted).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it("does not start before the app says it is ready, and re-arms until it is", async () => {
		// An unauthenticated warm-up collects 401s. The refusal is not a latch: the
		// session confirms a beat after the first screen, and on a launch that lands
		// on its final route there is no second navigation to retry on.
		vi.useFakeTimers();
		try {
			let ready = false;
			const run = vi.fn(() => Promise.resolve());
			const report = vi.fn();
			const warmup = new LankaDataWarmup({
				scheduler: immediate,
				isReady: () => ready,
				rearm: { delayMs: 1_000, maxAttempts: 3 },
				report,
			});
			warmup.setSource(() => [task("a", 1, run)]);

			warmup.start();
			await settle(1_500);
			expect(run).not.toHaveBeenCalled();
			expect(report).toHaveBeenCalledWith(expect.stringContaining("not ready"));

			ready = true;
			await settle(1_000);

			expect(run).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("does not start on a data-saving connection, and re-arms", async () => {
		vi.useFakeTimers();
		try {
			let saving = true;
			const run = vi.fn(() => Promise.resolve());
			const warmup = new LankaDataWarmup({
				scheduler: immediate,
				network: { saveData: () => saving },
				rearm: { delayMs: 500, maxAttempts: 3 },
			});
			warmup.setSource(() => [task("a", 1, run)]);

			warmup.start();
			await settle(600);
			expect(run).not.toHaveBeenCalled();

			saving = false;
			await settle(600);

			expect(run).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("stops re-arming after the configured attempts", async () => {
		// Unbounded would loop a timer all session on a device whose data saver is
		// simply always on.
		vi.useFakeTimers();
		try {
			const report = vi.fn();
			const warmup = new LankaDataWarmup({
				scheduler: immediate,
				isReady: () => false,
				rearm: { delayMs: 100, maxAttempts: 2 },
				report,
			});
			warmup.setSource(() => [task("a", 1)]);

			warmup.start();
			await settle(1_000);

			const refusals = report.mock.calls.filter(([m]) => String(m).includes("not ready"));
			// The first call and two re-arms, then abandoned.
			expect(refusals).toHaveLength(3);
			expect(report).toHaveBeenCalledWith(expect.stringContaining("abandoned"));
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("LankaDataWarmup — pause", () => {
	it("holds the next batch while paused and continues on resume", async () => {
		vi.useFakeTimers();
		try {
			const run = vi.fn(() => Promise.resolve());
			const warmup = new LankaDataWarmup({ scheduler: immediate, maxConcurrent: 1 });
			warmup.pause();

			const done = warmup.run([task("a", 1, run)]);
			await settle(500);
			expect(run).not.toHaveBeenCalled();

			warmup.resume();
			await settle(100);
			await done;

			expect(run).toHaveBeenCalledTimes(1);
			expect(warmup.getDiagnostics().isPaused).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("a pause nobody releases EXPIRES", async () => {
		// One `onBeforeLoad` without its `onResolved` — every redirecting deep-link
		// launch produces one — used to park the warm-up for the session.
		vi.useFakeTimers();
		try {
			const run = vi.fn(() => Promise.resolve());
			const warmup = new LankaDataWarmup({ scheduler: immediate, pauseExpiryMs: 1_000 });
			warmup.pause();

			const done = warmup.run([task("a", 1, run)]);
			await settle(900);
			expect(run).not.toHaveBeenCalled();
			await settle(200);
			await done;

			expect(run).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
