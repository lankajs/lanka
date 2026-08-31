import { bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { LankaOptimisticActions } from "./LankaOptimisticActions";

/**
 * What a tap costs before anything reaches the network.
 *
 * A like button, a checkbox, a reorder: the point of an optimistic action is
 * that the screen has already changed, so everything this class does happens
 * while the user is looking at the result. The two strategies are measured apart
 * because they buy different things — the last click wins, or the clicks queue.
 */
describe("LankaOptimisticActions", () => {
	lankaBenchCalibration();

	const actions = new LankaOptimisticActions();
	const settled = () => Promise.resolve();

	let applied = 0;

	bench(
		"a tap under runLatest, uncontested",
		async () => {
			await actions.runLatest<number>(
				"like",
				() => applied,
				() => {
					applied += 1;
					return Promise.resolve();
				},
				() => undefined,
			);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a tap under runExclusive, uncontested",
		async () => {
			await actions.runExclusive<number>(
				"reorder",
				() => applied,
				settled,
				() => undefined,
			);
		},
		LANKA_BENCH_OPTIONS,
	);
});
