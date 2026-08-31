import { describe, expect, it, vi } from "vitest";
import { LankaIdRegistry } from "./LankaIdRegistry";

describe("LankaIdRegistry", () => {
	it("assigns an id to a string and reads it back", async () => {
		const registry = new LankaIdRegistry();

		const id = await registry.encode("test");

		expect(registry.decode(id)).toBe("test");
	});

	it("the same string gets the same id", async () => {
		const registry = new LankaIdRegistry();

		expect(await registry.encode("same")).toBe(await registry.encode("same"));
	});

	it("an unknown id reads as `null`, not as an empty string", async () => {
		const registry = new LankaIdRegistry();
		await registry.encode("test");

		expect(registry.decode(99999)).toBeNull();
	});

	it("the empty string is an ordinary value", async () => {
		const registry = new LankaIdRegistry();

		const id = await registry.encode("");

		expect(registry.decode(id)).toBe("");
	});

	it("two registries share no mappings", async () => {
		// Why the registry is not static. With statics a second consumer silently
		// gets someone else's mappings: invisible to an application until the
		// second one appears, and normal for a package.
		const first = new LankaIdRegistry();
		const second = new LankaIdRegistry();

		const firstId = await first.encode("a shared string");

		expect(second.decode(firstId)).toBeNull();
		expect(await second.encode("its own string")).toBe(firstId);
	});

	it("numbering starts from the given number", async () => {
		const registry = new LankaIdRegistry({ startId: 50 });

		expect(await registry.encode("first")).toBe(50);
		expect(await registry.encode("second")).toBe(51);
		expect(await registry.encode("third")).toBe(52);
	});

	it("`startId: 0` is a legal start, not “unset”", async () => {
		// A truthiness check silently replaces zero with one: the setting is
		// accepted and not applied.
		const registry = new LankaIdRegistry({ startId: 0 });

		expect(await registry.encode("first")).toBe(0);
	});

	it("an id of 0 does not create a second record for the string", async () => {
		// The same defect continued: a truthiness check reads an id of 0 as absence,
		// so a repeat `encode` mints a new number and leaves two records for one
		// string — `decode` returns it for both, and `encode` stops being stable.
		const registry = new LankaIdRegistry({ startId: 0 });

		const first = await registry.encode("zero");
		const second = await registry.encode("zero");

		expect(first).toBe(0);
		expect(second).toBe(0);
		expect(registry.getSnapshot().entries).toHaveLength(1);
	});

	it("persists a snapshot on every new mapping", async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const registry = new LankaIdRegistry({ persist: { save, load: vi.fn() } });

		await registry.encode("test");

		expect(save).toHaveBeenCalledWith({ nextId: 2, entries: [[1, "test"]] });
	});

	it("persists nothing when the string is already known", async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const registry = new LankaIdRegistry({ persist: { save, load: vi.fn() } });

		await registry.encode("test");
		await registry.encode("test");

		expect(save).toHaveBeenCalledTimes(1);
	});

	it("restores persisted mappings", async () => {
		const load = vi.fn().mockResolvedValue({
			nextId: 5,
			entries: [
				[1, "first"],
				[2, "second"],
			] as [number, string][],
		});
		const registry = new LankaIdRegistry({ persist: { save: vi.fn(), load } });

		await registry.restore();

		expect(registry.decode(1)).toBe("first");
		expect(registry.decode(2)).toBe("second");
		// Continues from the persisted counter: otherwise it would issue a taken
		// number and overwrite an existing mapping.
		expect(await registry.encode("third")).toBe(5);
	});

	it("restoring without persistence, or from empty persistence, breaks nothing", async () => {
		const empty = new LankaIdRegistry();
		const missing = new LankaIdRegistry({ persist: { save: vi.fn(), load: async () => null } });

		await empty.restore();
		await missing.restore();

		expect(await empty.encode("a")).toBe(1);
		expect(await missing.encode("a")).toBe(1);
	});
});

describe("LankaIdRegistry — the round trip, at the size it is used at", () => {
	it("reads back a thousand ids exactly as they went in", async () => {
		const registry = new LankaIdRegistry();
		const ids = Array.from({ length: 1000 }, (_, index) => `7f3c-${String(index)}-schlüssel`);

		const encoded = await Promise.all(ids.map((id) => registry.encode(id)));

		// The invariant every optimisation of this class has to keep: a smaller
		// number, a different hash, a shared table — none of it may change what
		// comes back. A list of read marks that decodes to the wrong id marks the
		// wrong row, and nothing else in the application would notice.
		expect(encoded.map((id) => registry.decode(id))).toEqual(ids);
		expect(new Set(encoded).size).toBe(ids.length);
	});
});
