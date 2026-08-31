import { bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { createLankaBootstrapPipeline } from "./createLankaBootstrapPipeline";
import type { ILankaBootstrapOutcome } from "../../_interfaces/ILankaBootstrapOutcome";

/**
 * What the first screen waits for.
 *
 * A start-up sequence runs once per session and nothing is rendered until it
 * settles, so its cost is felt as the blank moment after the splash. What is
 * measured here is the pipeline's own overhead — the steps do nothing — because
 * the steps of a real application are its own work and not this package's.
 */
interface IContext extends ILankaBootstrapOutcome {
	steps: number;
}

describe("createLankaBootstrapPipeline", () => {
	lankaBenchCalibration();

	const steps = Array.from({ length: 6 }, (_, index) => ({
		name: `step-${String(index)}`,
		run: (context: IContext) => ({ ...context, steps: context.steps + 1 }),
	}));

	bench(
		"six steps, none of which does anything",
		async () => {
			const pipeline = createLankaBootstrapPipeline<IContext>({
				createContext: () => ({ steps: 0 }),
				steps,
			});

			await pipeline.run();
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"asking a settled pipeline again, which every later caller does",
		async () => {
			await settled.run();
		},
		LANKA_BENCH_OPTIONS,
	);

	const settled = createLankaBootstrapPipeline<IContext>({
		createContext: () => ({ steps: 0 }),
		steps,
	});
});
