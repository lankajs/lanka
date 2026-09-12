import { describe, expect, it } from "vitest";
import { LankaReactNativeAsyncStorageAdapter } from "./LankaReactNativeAsyncStorageAdapter";
import type { ILankaStorageAdapter } from "lanka/storage";
import type { ILankaReactNativeAsyncStorageEngine } from "../_interfaces/ILankaReactNativeAsyncStorageEngine";

/**
 * What this package knows that the port does not.
 *
 * The clauses are asserted against this adapter by the conformance suite in the
 * playground. What is left is the small distance between the library's answers
 * and the port's: a readonly array, and a `clear` that means more than it looks.
 */
const engineOf = (rows: Map<string, string>): ILankaReactNativeAsyncStorageEngine => ({
	getItem: (key) => Promise.resolve(rows.get(key) ?? null),
	setItem: (key, value) => {
		rows.set(key, value);
		return Promise.resolve();
	},
	removeItem: (key) => {
		rows.delete(key);
		return Promise.resolve();
	},
	clear: () => {
		rows.clear();
		return Promise.resolve();
	},
	// The library's own signature, and the point of the test below.
	getAllKeys: () => Promise.resolve(Object.freeze([...rows.keys()])),
});

describe("LankaReactNativeAsyncStorageAdapter", () => {
	it("hands out a key list a caller may sort in place", async () => {
		const adapter = new LankaReactNativeAsyncStorageAdapter(
			engineOf(
				new Map([
					["b", "2"],
					["a", "1"],
				]),
			),
		);

		const keys = await adapter.keys();

		// The library answers a frozen array. Returning it unchanged would make an
		// ordinary `keys.sort()` throw in strict mode — at the caller, about an
		// object they never saw the origin of.
		expect(() => keys.sort()).not.toThrow();
		expect(keys).toEqual(["a", "b"]);
	});

	it("passes every operation through to the engine it was handed", async () => {
		const rows = new Map<string, string>();
		const adapter = new LankaReactNativeAsyncStorageAdapter(engineOf(rows));

		await adapter.setItem("session.token", "abc");

		expect([...rows]).toEqual([["session.token", "abc"]]);
		expect(await adapter.getItem("session.token")).toBe("abc");

		await adapter.removeItem("session.token");

		expect(await adapter.getItem("session.token")).toBeNull();
	});

	it("declares no synchronous half, because nothing crossing a bridge has one", () => {
		// Read through the PORT, which is where the four methods are optional. The
		// class does not declare them at all, and clause 8 — all four or none — is
		// what makes that a promise rather than an omission.
		const port: ILankaStorageAdapter = new LankaReactNativeAsyncStorageAdapter(
			engineOf(new Map()),
		);

		expect(port.getItemSync).toBeUndefined();
		expect(port.setItemSync).toBeUndefined();
		expect(port.removeItemSync).toBeUndefined();
		expect(port.clearSync).toBeUndefined();
	});

	it("empties everything on clear, which is what the library's space is", async () => {
		const rows = new Map([
			["session.token", "abc"],
			["profile.theme", "dark"],
		]);
		const adapter = new LankaReactNativeAsyncStorageAdapter(engineOf(rows));

		await adapter.clear();

		expect([...rows]).toEqual([]);
	});
});
