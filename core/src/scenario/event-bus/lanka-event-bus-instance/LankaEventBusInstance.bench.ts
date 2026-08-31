import { bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { LankaEventBusInstance } from "./LankaEventBusInstance";

/**
 * What a scenario costs to fire.
 *
 * Every trigger goes through here, and the number that matters is how it grows
 * with the audience: a fact ten ViewModels listen to is dispatched as often as
 * one nobody listens to, and the difference between them is the whole question.
 */
describe("LankaEventBusInstance", () => {
	lankaBenchCalibration();

	/** What the subscribers added up, so none of them is dead code. */
	let heard = 0;

	const withSubscribers = (count: number): LankaEventBusInstance => {
		const bus = new LankaEventBusInstance();
		bus.registerEvent("todo.completed", { description: "bench", usedBy: ["bench"] });

		// A body that cannot be optimised away: an empty handler would let the
		// engine skip the call it is here to measure.
		for (let index = 0; index < count; index += 1) {
			bus.subscribe<{ id: number }>("todo.completed", (data) => {
				heard += data.id;
			});
		}

		return bus;
	};

	const empty = withSubscribers(0);
	const one = withSubscribers(1);
	const ten = withSubscribers(10);

	bench(
		"dispatching to nobody",
		() => {
			empty.dispatch("todo.completed", { id: 1 });
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"dispatching to one subscriber",
		() => {
			one.dispatch("todo.completed", { id: 1 });
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"dispatching to ten subscribers",
		() => {
			ten.dispatch("todo.completed", { id: 1 });
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"subscribing and unsubscribing, which every screen does twice",
		() => {
			const stop = ten.subscribe("todo.completed", () => undefined);
			stop();
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"reading what the subscribers added up, so the engine cannot skip them",
		() => {
			if (heard < 0) throw new Error("unreachable");
		},
		LANKA_BENCH_OPTIONS,
	);
});
