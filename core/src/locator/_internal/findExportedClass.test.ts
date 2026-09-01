import { describe, expect, it } from "vitest";
import { findExportedClass } from "./findExportedClass";

/**
 * What a barrel export has to look like to be resolved as a class.
 *
 * The boundary is deliberately loose in one direction and strict in the other,
 * and only the strict half was asserted anywhere: a name the module does not
 * export answers `undefined`. The loose half — `typeof === "function"` also
 * admits a plain function, and the locator accepts it because a class and a
 * constructible function cannot be told apart before calling — is documented in
 * the source and pinned here, so widening or narrowing it is a decision rather
 * than an accident.
 */
describe("findExportedClass", () => {
	class Real {}
	const arrow = (): void => undefined;
	function plain(): void {}

	const module = { Real, arrow, plain, notAFunction: 42, nothing: undefined };

	it("resolves a class by its EXPORT key", () => {
		expect(findExportedClass(module, "Real")).toBe(Real);
	});

	it("answers undefined for a key the module does not export", () => {
		// `in` before indexing: a vitest module proxy THROWS on an unknown key
		// rather than answering undefined, so the check cannot be `=== undefined`.
		expect(findExportedClass(module, "Missing")).toBeUndefined();
	});

	it("answers undefined for an exported key whose value is not a function", () => {
		expect(findExportedClass(module, "notAFunction")).toBeUndefined();
		expect(findExportedClass(module, "nothing")).toBeUndefined();
	});

	it("REFUSES an arrow function — it has no prototype, so it cannot be constructed", () => {
		// The one case `typeof === "function"` alone would let through and `new`
		// would then throw on, three layers from the barrel that declared it.
		expect(findExportedClass(module, "arrow")).toBeUndefined();
	});

	it("accepts a plain function, deliberately", () => {
		// It has a prototype and `new` works. Telling it from a class before
		// calling is not possible, and `@lankajs/tool-di` verifies the barrel.
		expect(findExportedClass(module, "plain")).toBe(plain);
	});

	it("does not resolve a name it only INHERITS, even a constructible one", () => {
		// `in` walks the prototype chain, so `"constructor" in module` is true and
		// `module.constructor` is `Object` — a function with a prototype, which the
		// two checks below it accept. The locator would then hand back a class the
		// barrel never exported.
		//
		// `toString` and its siblings slipped through by luck: built-in methods
		// have no `.prototype`. `constructor` does, and it is the one that matters.
		//
		// Unreachable through the facades today — they convert a camelCase property
		// to PascalCase first, so the lookup asks for "Constructor" — which makes
		// this a trap rather than a live defect, and exactly the kind that is
		// cheapest to close before something else starts calling by class name.
		expect(findExportedClass(module, "constructor")).toBeUndefined();
		expect(findExportedClass(module, "toString")).toBeUndefined();
	});
});
