import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalStorageMemory } from "./createLocalStorageMemory";

afterEach(() => {
	vi.unstubAllGlobals();
	globalThis.localStorage?.clear();
});

describe("remembering the version between visits", () => {
	it("reads back what it wrote", () => {
		const memory = createLocalStorageMemory();

		memory.write("2.0.0");

		expect(memory.read()).toBe("2.0.0");
	});

	it("answers nothing before anything was written", () => {
		expect(createLocalStorageMemory().read()).toBe(null);
	});

	it("stays silent where storage is disabled", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => {
				throw new Error("blocked");
			},
			setItem: () => {
				throw new Error("blocked");
			},
		});
		const memory = createLocalStorageMemory();

		// Every visit then looks like the first one — the caches are dropped once
		// per visit, which is wasteful and correct. Throwing would take down an
		// application over a browser preference.
		expect(() => {
			memory.write("2.0.0");
		}).not.toThrow();
		expect(memory.read()).toBe(null);
	});
});
