import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalStorageMemory } from "./createLocalStorageMemory";

afterEach(() => {
	vi.unstubAllGlobals();
	globalThis.localStorage?.clear();
});

/**
 * A working `localStorage`, supplied rather than assumed.
 *
 * The round-trip case used to read the AMBIENT global, which the `jsdom`
 * environment normally provides — and node 26 broke that: it defines a
 * `globalThis.localStorage` accessor of its own that answers `undefined` unless
 * the process was started with `--localstorage-file`, and that own property wins
 * over the one jsdom installs. The subject here is the wrapper, not the
 * platform's storage, so the platform is no longer part of the test.
 *
 * `engines` admits node >= 20.19, so "it passes on the version I happen to run"
 * was never the property worth asserting.
 */
const stubWorkingStorage = (): void => {
	const store = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, value),
		removeItem: (key: string) => void store.delete(key),
		clear: () => store.clear(),
	});
};

describe("remembering the version between visits", () => {
	it("reads back what it wrote", () => {
		stubWorkingStorage();
		const memory = createLocalStorageMemory();

		memory.write("2.0.0");

		expect(memory.read()).toBe("2.0.0");
	});

	it("answers nothing before anything was written", () => {
		stubWorkingStorage();

		expect(createLocalStorageMemory().read()).toBe(null);
	});

	it("stays silent where the runtime has no localStorage at all", () => {
		// Node without `--localstorage-file`, a worker, SSR. `?.` has to carry it.
		vi.stubGlobal("localStorage", undefined);
		const memory = createLocalStorageMemory();

		expect(() => {
			memory.write("2.0.0");
		}).not.toThrow();
		expect(memory.read()).toBe(null);
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
