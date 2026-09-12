import { describe, expect, it } from "vitest";
import { requireWebEngine } from "./requireWebEngine";

describe("requireWebEngine", () => {
	it("hands back the engine when there is one", () => {
		const engine = { getItem: () => null };

		expect(requireWebEngine(engine, "localStorage", "local")).toBe(engine);
	});

	it("refuses when there is none, and says which global was missing", () => {
		expect(() => requireWebEngine(undefined, "sessionStorage", "session")).toThrow(
			/sessionStorage/,
		);
	});

	it("names the handler the caller should have passed", () => {
		// The sentence is the whole point. `ReferenceError: localStorage is not
		// defined`, thrown from inside a lazy getter nobody called by name, is the
		// failure this replaces.
		expect(() => requireWebEngine(undefined, "localStorage", "local")).toThrow(/local handler/);
	});

	it("points at the adapters that answer the port", () => {
		expect(() => requireWebEngine(undefined, "caches", "cache")).toThrow(
			/createLankaMmkvAdapter|createLankaUnstorageAdapter/,
		);
	});

	it("does not treat null as absent", () => {
		// Only `undefined` means "this runtime has none". A caller holding a null
		// engine has a different problem, and swallowing it here would hide it.
		expect(requireWebEngine(null, "localStorage", "local")).toBeNull();
	});
});
