import { describe, expect, it } from "vitest";
import { LankaMmkvAdapter } from "./LankaMmkvAdapter";
import type { ILankaMmkvEngine } from "../_interfaces/ILankaMmkvEngine";

/**
 * What this package knows that the port does not.
 *
 * Every clause of `ILankaStorageAdapter` is asserted against this adapter by
 * `lankaStorageAdapterConformance`, in the playground, over BOTH engine shapes.
 * Repeating them here would be a second copy of a list that has an owner.
 *
 * What is left is the vendor knowledge: which delete this instance has, and the
 * two places MMKV's answers are not the port's.
 */
const engineOf = (over: Map<string, string>, shape: "v3" | "v4"): ILankaMmkvEngine => {
	const common = {
		getString: (key: string) => over.get(key),
		set: (key: string, value: string) => {
			over.set(key, value);
		},
		clearAll: () => {
			over.clear();
		},
		getAllKeys: () => [...over.keys()],
	};

	return shape === "v3"
		? { ...common, delete: (key: string) => void over.delete(key) }
		: { ...common, remove: (key: string) => void over.delete(key) };
};

describe("LankaMmkvAdapter — which MMKV it was handed", () => {
	it("removes through `delete` on v3", () => {
		const rows = new Map([["session.token", "abc"]]);
		const adapter = new LankaMmkvAdapter(engineOf(rows, "v3"));

		adapter.removeItemSync("session.token");

		expect([...rows]).toEqual([]);
	});

	it("removes through `remove` on v4, which renamed it", () => {
		const rows = new Map([["session.token", "abc"]]);
		const adapter = new LankaMmkvAdapter(engineOf(rows, "v4"));

		adapter.removeItemSync("session.token");

		expect([...rows]).toEqual([]);
	});

	it("prefers `remove` when an instance carries both", () => {
		// Not a shape either major ships, and reachable through a wrapper. The
		// newer name wins because a library that grew one is the one being wrapped.
		const calls: string[] = [];
		const adapter = new LankaMmkvAdapter({
			getString: () => undefined,
			set: () => undefined,
			clearAll: () => undefined,
			getAllKeys: () => [],
			delete: () => calls.push("delete"),
			remove: () => calls.push("remove"),
		});

		adapter.removeItemSync("session.token");

		expect(calls).toEqual(["remove"]);
	});

	it("refuses an instance that can remove nothing, naming both spellings", () => {
		const adapter = new LankaMmkvAdapter({
			getString: () => undefined,
			set: () => undefined,
			clearAll: () => undefined,
			getAllKeys: () => [],
		});

		// The alternative is a sign-out that removes nothing and reports success,
		// which is the failure this package exists to keep out of an application.
		expect(() => adapter.removeItemSync("session.token")).toThrow(/remove.*v4.*delete.*v3/s);
	});
});

describe("LankaMmkvAdapter — where MMKV's answers are not the port's", () => {
	it("answers null where MMKV answers undefined", async () => {
		const adapter = new LankaMmkvAdapter(engineOf(new Map(), "v4"));

		// Clause 2. `undefined` reaches a caller as "the property is missing"
		// rather than "the key is not there", and `JSON.stringify` drops it.
		expect(adapter.getItemSync("never.written")).toBeNull();
		expect(await adapter.getItem("never.written")).toBeNull();
	});

	it("keeps an empty string, which `|| null` would have thrown away", () => {
		const rows = new Map([["profile.nickname", ""]]);
		const adapter = new LankaMmkvAdapter(engineOf(rows, "v4"));

		expect(adapter.getItemSync("profile.nickname")).toBe("");
	});

	it("answers the engine's own key list", async () => {
		const rows = new Map([
			["a", "1"],
			["b", "2"],
		]);
		const adapter = new LankaMmkvAdapter(engineOf(rows, "v3"));

		expect(await adapter.keys()).toEqual(["a", "b"]);
	});

	it("gives the awaited half the same answers as the immediate one", async () => {
		const adapter = new LankaMmkvAdapter(engineOf(new Map(), "v4"));

		await adapter.setItem("theme", "dark");

		expect(adapter.getItemSync("theme"), "written awaited, read now").toBe("dark");

		adapter.setItemSync("locale", "uk");

		expect(await adapter.getItem("locale"), "written now, read awaited").toBe("uk");

		await adapter.clear();

		expect(adapter.getItemSync("theme")).toBeNull();
	});
});
