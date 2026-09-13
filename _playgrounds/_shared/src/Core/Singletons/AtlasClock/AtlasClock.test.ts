import { ALankaSingleton } from "lanka/locator";
import { describe, expect, it } from "vitest";
import { AtlasClock } from "./AtlasClock";

describe("AtlasClock — a singleton declared by calling", () => {
	it("is a class the locator will recognise", () => {
		// What comes back IS a subclass of the marker, which is how the locator
		// discovers it in a consumer's barrel and builds it on first use. Without
		// the marker, "a singleton" would mean "any exported function with a
		// prototype", and a stray export would silently become public.
		expect(ALankaSingleton.is(AtlasClock)).toBe(true);
	});

	it("answers the time", () => {
		const clock = new AtlasClock();

		expect(clock.now()).toBeGreaterThan(0);
	});

	it("counts what it was asked, which a diagnostics panel shows", () => {
		const clock = new AtlasClock();

		clock.now();
		clock.now();

		expect(clock.readings()).toBe(2);
	});

	it("gives each instance its own count, so one screen cannot read another's", () => {
		const first = new AtlasClock();
		const second = new AtlasClock();

		first.now();

		expect(second.readings()).toBe(0);
	});
});
