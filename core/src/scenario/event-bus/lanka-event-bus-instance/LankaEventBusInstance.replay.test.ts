import { beforeEach, describe, expect, it, vi } from "vitest";
import { LankaEventBusInstance } from "./LankaEventBusInstance";

/**
 * Buffering only on explicit request.
 *
 * ## What this fixes
 *
 * Buffering every payload regardless of whether anyone asked for replay keeps
 * up to a hundred payloads per event type until the end of the session: in an
 * app where user data arrives over SSE, that is personal data held in memory
 * with no consumer at all.
 *
 * The second, less visible half: replaying the WHOLE buffer hands a late
 * subscriber a hundred events in a row — almost never what "give me the current
 * state" means.
 */

describe("the bus buffer", () => {
	let bus: LankaEventBusInstance;

	beforeEach(() => {
		vi.useFakeTimers();
		bus = new LankaEventBusInstance();
	});

	it("accumulates nothing until someone asks for replay", () => {
		for (let i = 0; i < 100; i++) bus.dispatch("E", { i });

		// Unfixed, a hundred values would sit here — silently, until the session
		// ends.
		expect(bus.getBufferedCount("E")).toBe(0);
	});

	it('`replay: "last"` delivers one last value rather than the whole history', () => {
		bus.subscribe("E", vi.fn(), { replay: "last" });
		bus.dispatch("E", { i: 1 });
		bus.dispatch("E", { i: 2 });
		bus.dispatch("E", { i: 3 });

		const late = vi.fn();
		bus.subscribe("E", late, { replay: "last" });
		vi.runAllTimers();

		expect(late).toHaveBeenCalledTimes(1);
		expect(late).toHaveBeenCalledWith({ i: 3 });
	});

	it("`replay: N` delivers exactly the last N", () => {
		bus.subscribe("E", vi.fn(), { replay: 2 });
		bus.dispatch("E", { i: 1 });
		bus.dispatch("E", { i: 2 });
		bus.dispatch("E", { i: 3 });

		const late = vi.fn();
		bus.subscribe("E", late, { replay: 2 });
		vi.runAllTimers();

		expect(late.mock.calls.map(([d]) => d)).toEqual([{ i: 2 }, { i: 3 }]);
	});

	it("the buffer holds exactly what the greediest subscriber asked for", () => {
		bus.subscribe("E", vi.fn(), { replay: 2 });
		bus.subscribe("E", vi.fn(), { replay: 5 });

		for (let i = 0; i < 20; i++) bus.dispatch("E", { i });

		expect(bus.getBufferedCount("E")).toBe(5);
	});

	it("`replay: true` means “the last one”, not “all history”", () => {
		// A BREAKING behaviour change, deliberately: nobody meant "the whole
		// buffer", and anyone could have relied on it. CHANGELOG carries the line.
		bus.subscribe("E", vi.fn(), { replay: true });
		bus.dispatch("E", { i: 1 });
		bus.dispatch("E", { i: 2 });

		const late = vi.fn();
		bus.subscribe("E", late, { replay: true });
		vi.runAllTimers();

		expect(late).toHaveBeenCalledTimes(1);
		expect(late).toHaveBeenCalledWith({ i: 2 });
	});

	it("`replay: false` receives nothing", () => {
		bus.subscribe("E", vi.fn(), { replay: "last" });
		bus.dispatch("E", { i: 1 });

		const late = vi.fn();
		bus.subscribe("E", late, { replay: false });
		vi.runAllTimers();

		expect(late).not.toHaveBeenCalled();
	});

	it("a subscription without replay creates no buffer at all", () => {
		bus.subscribe("E", vi.fn());
		for (let i = 0; i < 10; i++) bus.dispatch("E", { i });

		expect(bus.getBufferedCount("E")).toBe(0);
	});

	it("resetting an event clears its buffer too", () => {
		bus.subscribe("E", vi.fn(), { replay: 3 });
		bus.dispatch("E", { i: 1 });

		bus.clearEvent("E");

		expect(bus.getBufferedCount("E")).toBe(0);
	});
});
