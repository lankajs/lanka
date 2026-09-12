import { describe, expect, it } from "vitest";
import { createLankaFakeStorageAdapter } from "./createLankaFakeStorageAdapter";

/**
 * The double, beyond the port.
 *
 * Every clause of `ILankaStorageAdapter` is already asserted against this by
 * `lankaStorageAdapterConformance`, twice — once with both optional capabilities
 * declared and once with neither — so repeating them here would be a second copy
 * of a list that already has an owner.
 *
 * What is left is what the double promises ON TOP of the port: a live view of
 * what was written, and two halves over ONE map. The second is not decoration —
 * a double whose halves held separate state would pass clause 9 by construction
 * while every real engine has to earn it.
 */
describe("createLankaFakeStorageAdapter — beyond the port", () => {
	it("shows what was written, as a test would assert on it", async () => {
		const adapter = createLankaFakeStorageAdapter();

		await adapter.setItem("session.token", "abc");

		expect([...adapter.entries]).toEqual([["session.token", "abc"]]);
	});

	it("keeps that view live rather than answering a copy taken at creation", async () => {
		const adapter = createLankaFakeStorageAdapter();
		const seen = adapter.entries;

		await adapter.setItem("a", "1");
		await adapter.setItem("b", "2");
		await adapter.removeItem("a");

		// A test holding `entries` from before the act asserts on what happened
		// during it. A snapshot would make that assertion quietly always empty.
		expect([...seen.keys()]).toEqual(["b"]);
	});

	it("gives both halves one store, which is what a real engine has to earn", async () => {
		const adapter = createLankaFakeStorageAdapter();

		adapter.setItemSync("written.sync", "one");
		await adapter.setItem("written.async", "two");

		expect(adapter.entries.get("written.sync")).toBe("one");
		expect(adapter.getItemSync("written.async")).toBe("two");
		expect([...adapter.entries].length).toBe(2);
	});

	it("hands out a fresh, empty store per call, so one scene cannot seed the next", async () => {
		const first = createLankaFakeStorageAdapter();
		await first.setItem("left.behind", "yes");

		const second = createLankaFakeStorageAdapter();

		expect(await second.getItem("left.behind")).toBeNull();
		expect([...second.entries]).toEqual([]);
	});
});
