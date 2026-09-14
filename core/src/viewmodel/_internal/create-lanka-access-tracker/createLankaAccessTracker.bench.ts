import { bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { createLankaAccessTracker } from "./createLankaAccessTracker";

/**
 * What access tracking costs, with no framework in the measurement.
 *
 * `createLankaTrackedHook`'s bench measures the tracker AND a React render
 * together — 7631 yardsticks against 4307 for a plain read, a ratio of 1.77 with
 * no way to tell which half moved. These four benches are the other half on its
 * own, so a change to the recording can be read without a renderer's noise, and
 * so a binding for another framework has something to be compared against.
 *
 * The shape is the one a screen actually has: twenty state keys of which a
 * component reads four. A benchmark over a three-key object would flatter the
 * `shouldNotify` loop, which walks what was READ and not what exists.
 */
describe("createLankaAccessTracker", () => {
	lankaBenchCalibration();

	const KEYS = Array.from({ length: 20 }, (_, index) => `key${String(index)}`);
	const READ = KEYS.slice(0, 4);

	const stateOf = (): Record<string, unknown> =>
		Object.fromEntries(KEYS.map((key) => [key, key]));

	const state = stateOf();
	const read = () => state;

	const tracker = createLankaAccessTracker(read);
	const tracked = tracker.read();
	for (const key of READ) void tracked[key];

	// Spread from one state, so every key but the changed one keeps its identity —
	// which is what a store does when an action writes a single field.
	const touched = { ...state, [READ[0]]: "moved" };
	const untouched = { ...state, [KEYS[19]]: "moved" };

	bench(
		"a screen reading four keys through the tracker",
		() => {
			const proxy = tracker.read();
			for (const key of READ) void proxy[key];
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"the same four keys read straight off the state",
		() => {
			const plain = read();
			for (const key of READ) void plain[key];
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"deciding on a change that DID touch a read key",
		() => {
			void tracker.shouldNotify(touched, state);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"deciding on a change that touched none of them — the skipped render",
		() => {
			void tracker.shouldNotify(untouched, state);
		},
		LANKA_BENCH_OPTIONS,
	);
});
