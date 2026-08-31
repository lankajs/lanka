import { afterEach, describe, expect, it, vi } from "vitest";
import { dropCacheStorage } from "./dropCacheStorage";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("dropping what the previous build cached", () => {
	it("deletes every cache this origin holds", async () => {
		const deleted: string[] = [];
		vi.stubGlobal("caches", {
			keys: () => Promise.resolve(["avatars", "polyfilled-state"]),
			delete: (name: string) => {
				deleted.push(name);
				return Promise.resolve(true);
			},
		});

		await dropCacheStorage();

		// Everything, not a named subset: a build that changed may have changed
		// anything, and a half-dropped cache serves two versions at once.
		expect(deleted).toEqual(["avatars", "polyfilled-state"]);
	});

	it("does nothing where there is no Cache Storage at all", async () => {
		vi.stubGlobal("caches", undefined);

		await expect(dropCacheStorage()).resolves.toBeUndefined();
	});
});
