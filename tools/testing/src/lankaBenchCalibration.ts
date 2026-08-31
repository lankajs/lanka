import { bench } from "vitest";

/** What every bench in a file is measured against. */
export const LANKA_CALIBRATION_NAME = "calibration: a plain property read";

/** How long each bench runs, and how long it warms up first. */
export const LANKA_BENCH_OPTIONS = { time: 200, warmupTime: 50 } as const;

/**
 * Registers the yardstick every bench file is read against.
 *
 * ## Why a yardstick at all
 *
 * `27,212,092 ops/sec` is a fact about this machine on this afternoon: a laptop
 * on battery answers half of it, and CI answers something else again. Recorded as
 * a baseline it produces a check that fails for reasons nobody caused, and a check
 * that cries wolf stops being read.
 *
 * A RATIO between two operations measured in the same process survives all of
 * that — the machine, the thermal state, the noise of a parallel run scale both
 * numbers together. So every bench file registers this one first, and every
 * number in `perf/<pkg>.perf.md` is "how many of these one call costs".
 *
 * ## Why in every file rather than once per package
 *
 * Vitest gives each bench file its own worker. A yardstick measured in another
 * process is a yardstick measured on another machine, for the purposes that
 * matter here. It costs 0.25s per file, which is a fifth of what starting that
 * worker already cost.
 *
 * ```ts
 * describe("createLankaTrackedHook", () => {
 * 	lankaBenchCalibration();
 *
 * 	bench("reads a tracked key", () => { ... }, LANKA_BENCH_OPTIONS);
 * });
 * ```
 *
 * Canon: `skills/performance/SKILL.md`.
 */
export const lankaBenchCalibration = (): void => {
	// Not a constant folded away by the engine: the object is read through a
	// binding the optimiser cannot prove is unused, which is what keeps the
	// yardstick a property read rather than nothing at all.
	const target = { value: 1 };
	let sink = 0;

	bench(
		LANKA_CALIBRATION_NAME,
		() => {
			sink += target.value;
			if (sink < 0) throw new Error("unreachable");
		},
		LANKA_BENCH_OPTIONS,
	);
};
