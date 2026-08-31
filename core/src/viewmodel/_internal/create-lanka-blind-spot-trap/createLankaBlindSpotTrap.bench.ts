import { bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { createLankaBlindSpotTrap } from "./createLankaBlindSpotTrap";

/**
 * What the development-only diagnostic costs when it is armed.
 *
 * The trap watches every `get()` a ViewModel makes so it can name the key a
 * screen will never re-render for. It is disarmed in production, so the pair
 * below is the whole question: the disarmed path must cost nothing at all, and
 * the armed one must cost little enough that nobody turns development off.
 */
describe("createLankaBlindSpotTrap", () => {
	lankaBenchCalibration();

	const state = { todos: [1, 2, 3], isLoading: false, error: null };
	const read = () => state;

	const armed = createLankaBlindSpotTrap("BenchVM", true).observeGet(read);
	const disarmed = createLankaBlindSpotTrap("BenchVM", false).observeGet(read);

	bench(
		"a read through the armed trap",
		() => {
			void armed().todos;
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"the same read with the trap disarmed",
		() => {
			void disarmed().todos;
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"the same read with nothing in between",
		() => {
			void read().todos;
		},
		LANKA_BENCH_OPTIONS,
	);
});
