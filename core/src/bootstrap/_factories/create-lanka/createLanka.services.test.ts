import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "./createLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";

/**
 * A bootstrap service may be optional and may overrun its deadline.
 *
 * ## What this fixes
 *
 * The async phase is a `Promise.all`: one failed service fails the whole phase.
 * The sync phase is a loop with a `throw`: a failure cancels everything after it.
 * Wrapping that in a swallowing `try/catch` is worse — the application starts
 * with a PARTIALLY executed plan and does not know it.
 *
 * So failing analytics takes realtime down with it, and the only symptom is that
 * realtime does not work.
 */

describe("bootstrap services", () => {
	beforeEach(() => {
		vi.useRealTimers();
	});

	it("an optional service does not abort the plan", async () => {
		const after = vi.fn();
		const lanka = createLanka({ host: lankaTestHost });

		await lanka.bootstrap({
			services: [
				{
					name: "Analytics",
					sync: true,
					priority: 10,
					optional: true,
					init: () => {
						throw new Error("analytics unavailable");
					},
				},
				{ name: "Realtime", sync: true, priority: 5, init: after },
			],
		});

		expect(after).toHaveBeenCalledTimes(1);
		expect(lanka.isBootstrapped()).toBe(true);
	});

	it("a required service still fails the plan", async () => {
		// Otherwise `optional` would mean nothing: the distinction must be carried by
		// the flag, not by a blanket "we are more tolerant now".
		const after = vi.fn();
		const lanka = createLanka({ host: lankaTestHost });

		await expect(
			lanka.bootstrap({
				services: [
					{
						name: "Session",
						sync: true,
						priority: 10,
						init: () => {
							throw new Error("no session");
						},
					},
					{ name: "Later", sync: true, priority: 5, init: after },
				],
			}),
		).rejects.toThrow("no session");

		expect(after).not.toHaveBeenCalled();
		expect(lanka.isBootstrapped()).toBe(false);
	});

	it("an optional service in the async phase does not fail the others", async () => {
		const other = vi.fn();
		const lanka = createLanka({ host: lankaTestHost });

		await lanka.bootstrap({
			services: [
				{ name: "Warmup", optional: true, init: () => Promise.reject(new Error("no")) },
				{ name: "Cache", init: other },
			],
		});

		expect(other).toHaveBeenCalledTimes(1);
	});

	it("a service that overruns its deadline counts as failed, and the plan does not hang", async () => {
		const lanka = createLanka({ host: lankaTestHost });
		const after = vi.fn();

		await lanka.bootstrap({
			services: [
				{
					name: "Hanging",
					sync: true,
					priority: 10,
					optional: true,
					timeoutMs: 10,
					// Never settles. Without a deadline the plan would wait forever and
					// the application would never paint its first screen.
					init: () => new Promise<void>(() => undefined),
				},
				{ name: "Next", sync: true, priority: 5, init: after },
			],
		});

		expect(after).toHaveBeenCalledTimes(1);
	});

	it("a required service that times out fails the plan with a clear reason", async () => {
		const lanka = createLanka({ host: lankaTestHost });

		await expect(
			lanka.bootstrap({
				services: [
					{
						name: "Session",
						sync: true,
						timeoutMs: 10,
						init: () => new Promise<void>(() => undefined),
					},
				],
			}),
		).rejects.toThrow(/Session.*10/);
	});

	it("a service that finishes in time is untouched by the timer", async () => {
		const lanka = createLanka({ host: lankaTestHost });
		const done = vi.fn();

		await lanka.bootstrap({
			services: [{ name: "Fast", sync: true, timeoutMs: 1000, init: done }],
		});

		expect(done).toHaveBeenCalledTimes(1);
		expect(lanka.isBootstrapped()).toBe(true);
	});
});
