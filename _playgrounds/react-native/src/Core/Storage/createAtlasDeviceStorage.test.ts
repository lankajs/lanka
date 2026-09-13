import { describe, expect, it } from "vitest";
import { createAtlasDeviceStorage } from "./createAtlasDeviceStorage";
import { createAtlasFakeEngines } from "../../_Testing/createAtlasFakeEngines";

describe("createAtlasDeviceStorage", () => {
	it("answers from the fast store DURING a render, which is the whole reason it is there", () => {
		// `getLocalSync` exists only because the adapter under `local` has both
		// halves of the port. An engine that must be awaited has not answered by
		// the time a device decides which screen to mount.
		const storage = createAtlasDeviceStorage(createAtlasFakeEngines());

		storage.setLocalSync("atlas.sortField", "priority");

		expect(storage.getLocalSync("atlas.sortField")).toBe("priority");
	});

	it("keeps the three engines apart, so one lifetime cannot read another's", async () => {
		const storage = createAtlasDeviceStorage(createAtlasFakeEngines());

		storage.setLocalSync("shared.key", "from the fast store");
		await storage.setSession("shared.key", "from the keychain");
		await storage.setCache("shared.key", "from the bridge");

		expect(storage.getLocalSync("shared.key")).toBe("from the fast store");
		expect(await storage.getSession("shared.key")).toBe("from the keychain");
		expect(await storage.getCache("shared.key")).toBe("from the bridge");
	});

	it("takes a key a person would write, and gives it back the same way", async () => {
		// A keychain accepts only letters, digits, `.`, `-` and `_`. The adapter
		// encodes on the way in and decodes on the way out, so an application never
		// has to know that — and this test would fail against a double that did not
		// refuse what a keychain refuses.
		const storage = createAtlasDeviceStorage(createAtlasFakeEngines());

		await storage.setSession("auth.access token", "a-token");

		expect(await storage.getSession("auth.access token")).toBe("a-token");
	});

	it("refuses a value too large for a keychain row rather than letting it be cut", async () => {
		// Truncation is the worst available failure: half a token reads back as a
		// whole one and decrypts to nothing a week later.
		const storage = createAtlasDeviceStorage(createAtlasFakeEngines());

		await expect(storage.setSession("auth.big", "x".repeat(4096))).rejects.toThrow();
	});

	it("clears only what the keychain adapter itself wrote", async () => {
		// It walks an index of its own. Without one, a sign-out could delete only
		// the keys the caller happened to name, and a token some earlier screen
		// wrote would outlive the session.
		const storage = createAtlasDeviceStorage(createAtlasFakeEngines());
		await storage.setSession("auth.access token", "a-token");
		storage.setLocalSync("atlas.sortField", "priority");

		await storage.clearSession();

		expect(await storage.getSession("auth.access token")).toBeNull();
		expect(storage.getLocalSync("atlas.sortField")).toBe("priority");
	});
});
