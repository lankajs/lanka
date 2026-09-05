import { describe, expect, it } from "vitest";
import { LankaEventBusInstance } from "./LankaEventBusInstance";

/**
 * The bus log, and the one thing a reader asks of it: what happened, in order.
 *
 * `getEventLogs(limit)` says "how many RECENT records to return". It kept the
 * records per event TYPE and concatenated the lists, so "recent" meant "the tail
 * of whichever type the registry happened to hold last" — which on a bus with
 * two event types is not a chronology at all. A debugging tool that reorders the
 * evidence sends the reader after the wrong cause.
 */
describe("the bus log across event types", () => {
	const busWithThreeTypes = (): LankaEventBusInstance => {
		const bus = new LankaEventBusInstance();
		bus.enableLogs();
		// Interleaved on purpose: one type dispatching twice in a row is what makes
		// the per-type concatenation look right until it does not.
		bus.dispatch("cart:changed", "first");
		bus.dispatch("order:placed", "second");
		bus.dispatch("cart:changed", "third");
		bus.dispatch("cart:changed", "fourth");
		return bus;
	};

	it("answers every record in the order the bus saw it", () => {
		const logs = busWithThreeTypes().getEventLogs();

		expect(logs.map((log) => log.data)).toEqual(["first", "second", "third", "fourth"]);
	});

	it("`limit` takes the most recent records, not one type's tail", () => {
		const logs = busWithThreeTypes().getEventLogs(undefined, 2);

		expect(logs.map((log) => log.data)).toEqual(["third", "fourth"]);
	});

	it("still answers one type's own records, in order", () => {
		const logs = busWithThreeTypes().getEventLogs("cart:changed");

		expect(logs.map((log) => log.data)).toEqual(["first", "third", "fourth"]);
	});

	it("orders a burst that shares one millisecond", () => {
		// A timestamp is the obvious ordering key and the wrong one: it has
		// millisecond resolution, and a burst — an SSE storm, a bootstrap — dispatches
		// far more than one event per millisecond. Every record in this test carries
		// the same timestamp.
		const bus = new LankaEventBusInstance();
		bus.enableLogs();
		for (let index = 0; index < 50; index += 1) {
			bus.dispatch(index % 2 === 0 ? "even" : "odd", index);
		}

		expect(bus.getEventLogs().map((log) => log.data)).toEqual(
			Array.from({ length: 50 }, (_, index) => index),
		);
	});

	it("answers nothing while logging is off", () => {
		const bus = new LankaEventBusInstance();
		bus.dispatch("cart:changed", "unlogged");

		expect(bus.getEventLogs()).toEqual([]);
	});
});
