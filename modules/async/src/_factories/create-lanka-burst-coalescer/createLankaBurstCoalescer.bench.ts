import { bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { createLankaBurstCoalescer } from "./createLankaBurstCoalescer";

/**
 * What a burst of identical requests costs to collapse.
 *
 * An SSE storm, a list of rows each asking for the same parent, a screen mounted
 * twice by a route transition: the coalescer is what turns those into one call.
 * The number that matters is the overhead per JOINED call, because that is the
 * one multiplied by the size of the burst.
 */
describe("createLankaBurstCoalescer", () => {
	lankaBenchCalibration();

	const settled = () => Promise.resolve();
	const coalescer = createLankaBurstCoalescer<string>();

	bench(
		"a call with nothing in flight",
		async () => {
			await coalescer.run("todos", settled);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"ten callers arriving together, which is what a burst is",
		async () => {
			await Promise.all(Array.from({ length: 10 }, () => coalescer.run("todos", settled)));
		},
		LANKA_BENCH_OPTIONS,
	);
});
