import {
	installLankaCacheStoragePolyfill,
	lankaStorage,
	setLankaStorageSecret,
} from "@lankajs/storage";
import { beforeEach, describe, expect, it } from "vitest";
import { AtlasPreferences } from "./AtlasPreferences";

/** The secret is set once, before anything reads or writes. There is no default. */
setLankaStorageSecret("atlas-test-secret");

/*
 * jsdom has no Cache Storage, and the encrypted store reaches for it.
 *
 * A function called here rather than code that runs on import — which is the
 * whole reason the polyfill is shaped as one: importing a module must not
 * silently rewrite `window.caches` for a whole page, and the decision belongs to
 * the application. A test environment is an application too.
 */
installLankaCacheStoragePolyfill();

describe("AtlasPreferences", () => {
	let preferences: AtlasPreferences;

	beforeEach(async () => {
		await lankaStorage.clearLocal();
		preferences = new AtlasPreferences("atlas-test-secret");
	});

	it("answers defaults before anything was ever written", async () => {
		expect(await preferences.read()).toEqual({ sortField: null, isPanelOpen: false });
	});

	it("remembers what it was given", async () => {
		await preferences.write({ sortField: "priority", isPanelOpen: true });

		expect(await preferences.read()).toEqual({ sortField: "priority", isPanelOpen: true });
	});

	it("survives a value somebody else wrote under its key", async () => {
		// Through the STORE, not through `localStorage`: every store keeps an
		// in-memory read cache, so a value written behind its back is a value it
		// will not see. That is documented behaviour and the commonest surprise.
		await lankaStorage.setLocal("atlas.preferences", "not json at all");

		expect(await preferences.read()).toEqual({ sortField: null, isPanelOpen: false });
	});

	it("fills in a field a previous build did not write", async () => {
		await lankaStorage.setLocal("atlas.preferences", JSON.stringify({ sortField: "code" }));

		expect(await preferences.read()).toEqual({ sortField: "code", isPanelOpen: false });
	});

	it("keeps the operator's name out of storage in the clear", async () => {
		// The KEY is hashed as well as the value: a key name tells you what is
		// stored under it, so leaving it in the clear leaves half the information
		// outside.
		await preferences.rememberOperator("Ada Lovelace");

		const written = Object.entries(localStorage);
		expect(written.some(([key]) => key.includes("operator"))).toBe(false);
		expect(written.some(([, value]) => String(value).includes("Ada"))).toBe(false);
	});

	it("reads the operator's name back under the name it was written with", async () => {
		await preferences.rememberOperator("Ada Lovelace");

		expect(await preferences.operator()).toBe("Ada Lovelace");
	});

	it("forgets the operator without taking the preferences with it", async () => {
		// A sign-out must not empty the whole page's storage. The encrypted store
		// namespaces itself; the plain one was given the real `localStorage` and
		// would clear keys this application never wrote.
		await preferences.write({ sortField: "priority", isPanelOpen: true });
		await preferences.rememberOperator("Ada Lovelace");

		await preferences.forgetOperator();

		expect(await preferences.operator()).toBeNull();
		expect(await preferences.read()).toEqual({ sortField: "priority", isPanelOpen: true });
	});
});
