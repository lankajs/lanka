import { beforeEach, describe, expect, it, vi } from "vitest";
import { LankaEventBusInstance } from "./LankaEventBusInstance";
import { ALankaScenario } from "../../_abstractions/lanka-scenario/ALankaScenario";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";

/**
 * `subscribe` returns an unsubscribe function.
 *
 * Returning `void` means unsubscribing is possible only by callback identity,
 * and the direct consequence is visible in every ViewModel factory: each keeps
 * an identical `Map<eventType, { scenario, callback }>` — the same code copied
 * solely to hold references.
 */

describe("subscribe returns an unsubscribe function", () => {
	let bus: LankaEventBusInstance;

	beforeEach(() => {
		bus = new LankaEventBusInstance();
	});

	it("the returned function unsubscribes", () => {
		const listener = vi.fn();
		const off = bus.subscribe("E", listener);

		bus.dispatch("E");
		off();
		bus.dispatch("E");

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("calling it twice is safe and does not touch another subscription", () => {
		const first = vi.fn();
		const second = vi.fn();
		const off = bus.subscribe("E", first);
		bus.subscribe("E", second);

		off();
		off();
		bus.dispatch("E");

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});

	it("two subscriptions of one callback are removed one at a time", () => {
		// An `unsubscribe(callback)` removes the FIRST match, with nothing to tell
		// two subscriptions of one function apart. The returned function knows its
		// own.
		const listener = vi.fn();
		const offFirst = bus.subscribe("E", listener);
		bus.subscribe("E", listener);

		offFirst();
		bus.dispatch("E");

		expect(listener).toHaveBeenCalledTimes(1);
	});
});

describe("ALankaScenario.subscribe returns an unsubscribe function", () => {
	beforeEach(() => {
		createLanka({ host: lankaTestHost });
	});

	it("a scenario unsubscribes with what it returned", () => {
		class TestScenario extends ALankaScenario<{ id: number }> {
			readonly name = "UnsubTestScenario";
			readonly eventType = "UNSUB_TEST";
			readonly dataTypeName = "TestData";
		}

		const scenario = new TestScenario();
		const handler = vi.fn();
		const off = scenario.subscribe(handler);

		scenario.trigger({ id: 1 });
		off();
		scenario.trigger({ id: 2 });

		expect(handler).toHaveBeenCalledTimes(1);
	});
});
