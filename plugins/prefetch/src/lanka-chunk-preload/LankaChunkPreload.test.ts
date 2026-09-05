import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka, type ILankaInstance } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { LankaChunkPreload } from "./LankaChunkPreload";
import { LankaDataWarmup } from "../warmup/LankaDataWarmup";
import { lankaPrefetch } from "../index";

/**
 * The middle and bottom rungs of the ladder.
 *
 * What is pinned is not "does a chunk download" — that is the bundler's job —
 * but that every gate is ESCAPABLE: a service that switches off forever on one
 * unlucky moment stops working invisibly, exactly where it is needed.
 */

const entry = (path: string, priority = 0, preload = () => Promise.resolve()) => ({
	path,
	priority,
	preload,
});

/** A scheduler that runs the task immediately: idle time arrives at once in a test. */
const immediateScheduler = { whenIdle: (task: () => void) => task() };

describe("LankaChunkPreload — its own counter", () => {
	it("counts downloading chunks", async () => {
		let release!: () => void;
		const chunk = new LankaChunkPreload();
		const pending = chunk.warm(
			entry(
				"/a",
				0,
				() =>
					new Promise<void>((resolve) => {
						release = resolve;
					}),
			),
		);

		expect(chunk.getActiveCount()).toBe(1);
		release();
		await pending;
		expect(chunk.getActiveCount()).toBe(0);
	});

	it("a failed chunk leaves no permanent increment", async () => {
		// A leaked increment would convince data warm-up forever that the wire is
		// busy, and it would silently never run for the whole session.
		const chunk = new LankaChunkPreload();

		await chunk.warm(entry("/a", 0, () => Promise.reject(new Error("no chunk"))));

		expect(chunk.getActiveCount()).toBe(0);
	});

	it("a failed chunk does not surface as an application error", async () => {
		const chunk = new LankaChunkPreload();

		await expect(
			chunk.warm(entry("/a", 0, () => Promise.reject(new Error("no chunk")))),
		).resolves.toBeUndefined();
	});

	it("a failed chunk can be warmed again", async () => {
		// Otherwise one network failure would make the screen pay for its chunk on
		// every open for the rest of the session.
		const preload = vi
			.fn()
			.mockRejectedValueOnce(new Error("no chunk"))
			.mockResolvedValue(undefined);
		const chunk = new LankaChunkPreload();

		await chunk.warm(entry("/a", 0, preload));
		await chunk.warm(entry("/a", 0, preload));

		expect(preload).toHaveBeenCalledTimes(2);
	});

	it("a successfully warmed chunk is not downloaded twice", async () => {
		const preload = vi.fn(() => Promise.resolve());
		const chunk = new LankaChunkPreload();

		await chunk.warm(entry("/a", 0, preload));
		await chunk.warm(entry("/a", 0, preload));

		expect(preload).toHaveBeenCalledTimes(1);
	});
});

describe("LankaChunkPreload — gates", () => {
	it("sweeping goes in descending priority", async () => {
		const order: string[] = [];
		const chunk = new LankaChunkPreload({ scheduler: immediateScheduler, betweenChunksMs: 0 });
		chunk.setSource(() => [
			entry("/low", 1, () => {
				order.push("/low");
				return Promise.resolve();
			}),
			entry("/high", 9, () => {
				order.push("/high");
				return Promise.resolve();
			}),
		]);

		chunk.start();
		await vi.waitFor(() => expect(order).toHaveLength(2));

		expect(order).toEqual(["/high", "/low"]);
	});

	it("data saving cancels the sweep entirely", async () => {
		const preload = vi.fn(() => Promise.resolve());
		const chunk = new LankaChunkPreload({
			scheduler: immediateScheduler,
			network: { saveData: () => true },
		});
		chunk.setSource(() => [entry("/a", 0, preload)]);

		chunk.start();
		await Promise.resolve();

		expect(preload).not.toHaveBeenCalled();
	});

	it("sweeping starts once however many times it is called", async () => {
		const preload = vi.fn(() => Promise.resolve());
		const chunk = new LankaChunkPreload({ scheduler: immediateScheduler, betweenChunksMs: 0 });
		chunk.setSource(() => [entry("/a", 0, preload)]);

		chunk.start();
		chunk.start();
		await vi.waitFor(() => expect(preload).toHaveBeenCalled());

		expect(preload).toHaveBeenCalledTimes(1);
	});

	it("a pause EXPIRES on its own", async () => {
		// A release that never arrives would otherwise disable warming for the rest
		// of the session — the most common way to lose it silently.
		vi.useFakeTimers();
		try {
			const chunk = new LankaChunkPreload({ pauseExpiryMs: 1_000 });
			chunk.pause();

			expect(chunk.getDiagnostics().isPaused).toBe(true);
			await vi.advanceTimersByTimeAsync(1_100);
			expect(chunk.getDiagnostics().isPaused).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("explicitly releasing a pause cancels its expiry", async () => {
		vi.useFakeTimers();
		try {
			const chunk = new LankaChunkPreload({ pauseExpiryMs: 1_000 });
			chunk.pause();
			chunk.resume();

			expect(chunk.getDiagnostics().isPaused).toBe(false);
			await vi.advanceTimersByTimeAsync(2_000);
			expect(chunk.getDiagnostics().isPaused).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("a hidden tab is waited for past the wire ceiling, once the platform has been visible", async () => {
		// The ceiling exists for the WIRE: a mobile client's wire can stay busy for a
		// long time, and a sweep waiting for perfect silence never starts. It was
		// applied to the visibility gate too, so a backgrounded WebView pulled the
		// next chunk after `quietWireTimeoutMs` — the user's data plan spent on a
		// screen nobody was looking at.
		vi.useFakeTimers();
		try {
			let state: "visible" | "hidden" = "visible";
			const preload = vi.fn(() => Promise.resolve());
			const chunk = new LankaChunkPreload({
				scheduler: immediateScheduler,
				betweenChunksMs: 0,
				quietWireTimeoutMs: 1_000,
				visibility: {
					isVisible: () => state === "visible",
					onChange: () => () => undefined,
				},
			});
			chunk.setSource(() => [
				entry("/first", 9, () => {
					state = "hidden";
					return preload();
				}),
				entry("/second", 1, preload),
			]);

			chunk.start();
			await vi.advanceTimersByTimeAsync(10_000);

			expect(preload).toHaveBeenCalledTimes(1);
			state = "visible";
			await vi.advanceTimersByTimeAsync(100);
			expect(preload).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it("a pause is not cut short by the wire ceiling", async () => {
		// `pauseExpiryMs` is the pause's own ceiling. Folding the pause into the
		// wire wait made the shorter of the two win, silently.
		vi.useFakeTimers();
		try {
			const preload = vi.fn(() => Promise.resolve());
			const chunk = new LankaChunkPreload({
				scheduler: immediateScheduler,
				betweenChunksMs: 0,
				quietWireTimeoutMs: 1_000,
				pauseExpiryMs: 5_000,
			});
			chunk.setSource(() => [entry("/a", 0, preload)]);
			chunk.pause();

			chunk.start();
			await vi.advanceTimersByTimeAsync(3_000);
			expect(preload).not.toHaveBeenCalled();

			await vi.advanceTimersByTimeAsync(2_100);
			expect(preload).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("the old name of the pause still works, so nobody's config breaks on upgrade", () => {
		// `thingMs` shipped in 2.0.x. It said nothing; `betweenChunksMs` says what it
		// is. The old name is read only when the new one is absent.
		const chunk = new LankaChunkPreload({ thingMs: 0 });
		expect(chunk.getDiagnostics().hasStarted).toBe(false);
	});

	it("a platform that reports no visibility does not block warming", async () => {
		// Some WebViews send no visibility events at all. Trusting that gate would
		// disable warming entirely — invisibly, and only there.
		const preload = vi.fn(() => Promise.resolve());
		const chunk = new LankaChunkPreload({ scheduler: immediateScheduler, betweenChunksMs: 0 });
		chunk.setSource(() => [entry("/a", 0, preload)]);

		chunk.start();
		await vi.waitFor(() => expect(preload).toHaveBeenCalled());
	});
});

describe("LankaDataWarmup", () => {
	const task = (key: string, order: number, run = () => Promise.resolve()) => ({
		key,
		order,
		run,
		keptFreshBy: "the refresh scenario",
	});

	it("runs tasks in order", async () => {
		const seen: string[] = [];
		const warmup = new LankaDataWarmup({ maxConcurrent: 1 });

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
		const warmup = new LankaDataWarmup({ maxConcurrent: 2 });

		await warmup.run([task("a", 1, busy), task("b", 2, busy), task("c", 3, busy)]);

		expect(peak).toBe(2);
	});

	it("zero concurrency is clamped up instead of disabling warming", async () => {
		// Otherwise the setting would be accepted and silently disable everything:
		// "no effect" is the worst way to learn a value was wrong.
		const run = vi.fn(() => Promise.resolve());
		const warmup = new LankaDataWarmup({ maxConcurrent: 0 });

		await warmup.run([task("a", 1, run)]);

		expect(run).toHaveBeenCalledTimes(1);
	});

	it("one task's failure does not cancel the rest", async () => {
		// A batch is not a transaction: half a warm-up beats none.
		const second = vi.fn(() => Promise.resolve());
		const warmup = new LankaDataWarmup({ maxConcurrent: 1 });

		await warmup.run([
			task("fails", 1, () => Promise.reject(new Error("network"))),
			task("works", 2, second),
		]);

		expect(second).toHaveBeenCalledTimes(1);
		expect(warmup.getDiagnostics().failed).toEqual(["fails"]);
	});

	it("what is already warmed does not run again", async () => {
		const run = vi.fn(() => Promise.resolve());
		const warmup = new LankaDataWarmup();

		await warmup.run([task("a", 1, run)]);
		await warmup.run([task("a", 1, run)]);

		expect(run).toHaveBeenCalledTimes(1);
	});

	it("waiting for silence has a CEILING", async () => {
		// A gate without a ceiling is a way to never start: the wire can be busy for
		// a long time, and a warm-up waiting for perfect silence quietly never runs.
		const run = vi.fn(() => Promise.resolve());
		const warmup = new LankaDataWarmup({ activeRequests: () => 5, quietWireTimeoutMs: 20 });

		await warmup.run([task("a", 1, run)]);

		expect(run).toHaveBeenCalledTimes(1);
	});
});

describe("plugin — wiring the counters", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost });
	});

	it("the intent buffer sees the instance's counter", () => {
		const plugin = lankaPrefetch();
		lanka.use(plugin);

		lanka.inFlight.begin();
		plugin.intent.lankaPrefetch(
			{
				id: "x",
				identify: () => "1",
				domain: "d",
				fetch: () => Promise.resolve(1),
			},
			{},
		);

		expect(plugin.intent.getDiagnostics().yielded).toBe(1);
		lanka.inFlight.end();
	});

	it("removing the plugin clears the buffer", async () => {
		const plugin = lankaPrefetch();
		const remove = lanka.use(plugin);
		plugin.intent.lankaPrefetch(
			{ id: "x", identify: () => "1", domain: "d", fetch: () => Promise.resolve(1) },
			{},
		);
		await Promise.resolve();

		remove();

		expect(plugin.intent.getDiagnostics().buffered).toEqual([]);
	});
});
