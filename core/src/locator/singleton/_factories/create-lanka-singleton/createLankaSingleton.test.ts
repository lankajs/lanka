import { describe, expect, it, vi } from "vitest";
import { ALankaSingleton } from "../../_abstractions/lanka-singleton/ALankaSingleton";
import { createLankaSingleton } from "./createLankaSingleton";

describe("createLankaSingleton", () => {
	it("does not build until the locator constructs it", () => {
		const build = vi.fn(() => ({ value: 1 }));

		const Declared = createLankaSingleton(build);

		// A singleton declared in a module body must not touch a runtime that does
		// not exist yet — which is the whole reason the builder is deferred.
		expect(build).not.toHaveBeenCalled();

		const instance = new Declared();

		expect(build).toHaveBeenCalledTimes(1);
		expect(instance.value).toBe(1);
	});

	it("carries the marker, so the locator discovers it like a hand-written class", () => {
		const Declared = createLankaSingleton(() => ({ who: "declared" }));

		expect(ALankaSingleton.is(Declared)).toBe(true);
	});

	it("answers what the builder returned, methods and all", () => {
		const Declared = createLankaSingleton(() => {
			let seen = 0;

			return {
				ticks: () => {
					seen += 1;
					return seen;
				},
			};
		});

		const instance = new Declared();

		expect(instance.ticks()).toBe(1);
		expect(instance.ticks()).toBe(2);

		// Caching belongs to the locator: two constructions are two objects, which
		// is what lets a scope hold its own.
		expect(new Declared().ticks()).toBe(1);
	});
});
