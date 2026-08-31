import { describe, expect, it } from "vitest";
import { ALankaSingleton } from "./ALankaSingleton";

/**
 * Singletons have a marker, like the other three locators.
 *
 * A gateway must extend `ALankaGateway`, a scenario must have a `name`, a store
 * must extend `ALankaSharedStore`. Without a marker the selection admits
 * ANYTHING that is a function with a prototype, with two silent consequences:
 *
 * - any stray export in the barrel — a helper, a companion type, an accidentally
 *   re-exported class — becomes part of `lankaSingletons.*`;
 * - a typo in a name is caught only at runtime, on first use, and not where it
 *   was made.
 */

describe("the singleton marker", () => {
	it("recognises a marked class", () => {
		class Service extends ALankaSingleton {}

		expect(ALankaSingleton.is(Service)).toBe(true);
	});

	it("does not treat a plain class as a singleton", () => {
		class NotAService {}

		expect(ALankaSingleton.is(NotAService)).toBe(false);
	});

	it("does not treat a function as a singleton", () => {
		expect(ALankaSingleton.is(function helper() {})).toBe(false);
		expect(ALankaSingleton.is(() => undefined)).toBe(false);
	});

	it("does not stumble on non-functions", () => {
		expect(ALankaSingleton.is(undefined)).toBe(false);
		expect(ALankaSingleton.is(null)).toBe(false);
		expect(ALankaSingleton.is({})).toBe(false);
		expect(ALankaSingleton.is("Service")).toBe(false);
	});

	it("a subclass of a subclass is recognised too", () => {
		class Base extends ALankaSingleton {}
		class Derived extends Base {}

		expect(ALankaSingleton.is(Derived)).toBe(true);
	});
});
