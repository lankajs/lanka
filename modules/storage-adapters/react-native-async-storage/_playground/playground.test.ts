import { describe, expect, it } from "vitest";
import { lankaStorageAdapterConformance } from "@lankajs/tool-testing/lankaStorageAdapterConformance";
import {
	createLankaReactNativeAsyncStorageAdapter,
	LankaReactNativeAsyncStorageAdapter,
} from "../src/index";
import { createLankaFakeStorageAdapter } from "@lankajs/tool-testing";
import type { ILankaStorageAdapter } from "lanka/storage";
import { createPlaygroundAsyncStorage, createPlaygroundPreferences } from "./app";

/**
 * The package, used the way a React Native application uses it.
 *
 * The unit tests prove the mapping. This proves what the mapping costs and what
 * it buys: nothing can be known before the first render, and everything survives
 * the process that wrote it.
 */
describe("preferences that arrive after the first frame", () => {
	it("shows a splash rather than the wrong theme", async () => {
		const engine = createPlaygroundAsyncStorage();
		const preferences = createPlaygroundPreferences(
			createLankaReactNativeAsyncStorageAdapter(engine),
		);
		await preferences.choose("dark", "uk");

		// The frame the device actually draws first. Nothing is known yet, and the
		// application says so instead of guessing "light" and correcting itself.
		expect(preferences.initial()).toEqual({ screen: "splash", theme: "light", locale: "en" });
		expect(await preferences.boot()).toEqual({ screen: "app", theme: "dark", locale: "uk" });
	});

	it("keeps what it was told across a restart of the application", async () => {
		const engine = createPlaygroundAsyncStorage();

		const first = createPlaygroundPreferences(
			createLankaReactNativeAsyncStorageAdapter(engine),
		);
		await first.choose("dark", "uk");

		// A new process over the store the last one left behind — which is what a
		// device store IS, and the only reason to write to one.
		const second = createPlaygroundPreferences(
			createLankaReactNativeAsyncStorageAdapter(engine),
		);

		expect((await second.boot()).theme).toBe("dark");
	});

	it("falls back to the default when one preference is forgotten", async () => {
		const preferences = createPlaygroundPreferences(
			createLankaReactNativeAsyncStorageAdapter(createPlaygroundAsyncStorage()),
		);

		await preferences.choose("dark", "uk");
		await preferences.forgetTheme();

		const booted = await preferences.boot();

		// A removal, not an empty value: `"" ?? "light"` is `""`, and a theme
		// nobody can name is what that renders as.
		expect(booted.theme).toBe("light");
		expect(booted.locale, "the one that was not forgotten").toBe("uk");
	});

	it("leaves the device empty when the session ends", async () => {
		const engine = createPlaygroundAsyncStorage();
		const preferences = createPlaygroundPreferences(
			createLankaReactNativeAsyncStorageAdapter(engine),
		);

		await preferences.choose("dark", "uk");
		await preferences.signOut();

		expect([...engine.rows]).toEqual([]);
	});

	it("is the same adapter whichever style built it", async () => {
		// Both styles over one engine, so a behaviour cannot reach one and not the
		// other. Publishing two names promises two that work.
		const engine = createPlaygroundAsyncStorage();
		const built = new LankaReactNativeAsyncStorageAdapter(engine);
		const made = createLankaReactNativeAsyncStorageAdapter(engine);

		await built.setItem("preferences.theme", "dark");

		expect(await made.getItem("preferences.theme")).toBe("dark");
		expect(made).toBeInstanceOf(LankaReactNativeAsyncStorageAdapter);
	});
});

/**
 * The family's shared assertions.
 *
 * No `sync`, because nothing crossing the bridge answers immediately — the suite
 * holds the adapter to that claim in both directions, so an adapter that grew a
 * synchronous half here without saying so would fail clause 8.
 */
lankaStorageAdapterConformance({
	vendor: "AsyncStorage",
	create: () => createLankaReactNativeAsyncStorageAdapter(createPlaygroundAsyncStorage()),
});

describe("moving to another engine, which is what the port is for", () => {
	/**
	 * The migration an application performs once, and the reason the port has
	 * `keys()` at all.
	 *
	 * An application outgrows AsyncStorage — it wants an answer on the first frame
	 * — and installs a faster engine. Nothing above the port changes; what has to
	 * happen is that everything already on the device moves across, and that the
	 * old space is emptied afterwards so the next launch cannot read a stale copy.
	 *
	 * Written as a loop over the PORT, so this is not a migration from
	 * AsyncStorage to anything in particular. It is the migration, and the
	 * destination is whichever adapter was handed in.
	 */
	const moveEverything = async (
		from: ILankaStorageAdapter,
		to: ILankaStorageAdapter,
	): Promise<number> => {
		const keys = (await from.keys?.()) ?? [];

		for (const key of keys) {
			const value = await from.getItem(key);
			// A key that vanished between the listing and the read is not an error:
			// another part of the application removed it, and it is not ours to
			// resurrect.
			if (value !== null) await to.setItem(key, value);
		}

		await from.clear();

		return keys.length;
	};

	it("carries every value across and leaves the old engine empty", async () => {
		const engine = createPlaygroundAsyncStorage();
		const old = createLankaReactNativeAsyncStorageAdapter(engine);
		const preferences = createPlaygroundPreferences(old);
		await preferences.choose("dark", "uk");

		const faster = createLankaFakeStorageAdapter();
		const moved = await moveEverything(old, faster);

		expect(moved, "what was on the device").toBe(2);
		expect([...faster.entries].sort()).toEqual([
			["preferences.locale", "uk"],
			["preferences.theme", "dark"],
		]);
		expect([...engine.rows], "the old engine after the move").toEqual([]);
	});

	it("leaves the application reading the same answers from the new engine", async () => {
		const old = createLankaReactNativeAsyncStorageAdapter(createPlaygroundAsyncStorage());
		await createPlaygroundPreferences(old).choose("dark", "uk");

		const faster = createLankaFakeStorageAdapter();
		await moveEverything(old, faster);

		// The same application code, over the engine it was moved to. Nothing above
		// the port was told the migration happened.
		expect(await createPlaygroundPreferences(faster).boot()).toEqual({
			screen: "app",
			theme: "dark",
			locale: "uk",
		});
	});

	it("moves a value that looks like something else, byte for byte", async () => {
		const old = createLankaReactNativeAsyncStorageAdapter(createPlaygroundAsyncStorage());
		await old.setItem("preferences.raw", "null");
		await old.setItem("preferences.empty", "");

		const faster = createLankaFakeStorageAdapter();
		await moveEverything(old, faster);

		// Clause 1 on both sides of the move at once. An engine that parsed on the
		// way out, or one that treated an empty value as a removal, would lose one
		// of these in a migration nobody watches.
		expect(await faster.getItem("preferences.raw")).toBe("null");
		expect(await faster.getItem("preferences.empty")).toBe("");
	});

	it("is a no-op on a device with nothing on it", async () => {
		const old = createLankaReactNativeAsyncStorageAdapter(createPlaygroundAsyncStorage());
		const faster = createLankaFakeStorageAdapter();

		expect(await moveEverything(old, faster)).toBe(0);
		expect([...faster.entries]).toEqual([]);
	});
});

describe("one space for the whole application, which is what the library gives", () => {
	/**
	 * The property the guide states, driven rather than asserted.
	 *
	 * AsyncStorage has one space per application and no namespaces. Another
	 * library's rows, an older version's rows and this application's rows are all
	 * in it — so `keys()` lists them and `clear()` takes them. Neither is a bug in
	 * the adapter; both are the library, and an application that does not know it
	 * signs a user out of somebody else's feature.
	 */
	it("lists rows this application did not write", async () => {
		const engine = createPlaygroundAsyncStorage();
		// A row from an analytics SDK, an older build, a navigation library.
		engine.rows.set("@react-navigation/state", "{}");

		const adapter = createLankaReactNativeAsyncStorageAdapter(engine);
		await createPlaygroundPreferences(adapter).choose("dark", "uk");

		expect((await adapter.keys()).sort()).toEqual([
			"@react-navigation/state",
			"preferences.locale",
			"preferences.theme",
		]);
	});

	it("takes them with it on a clear, which is why a sign-out should not use one", async () => {
		const engine = createPlaygroundAsyncStorage();
		engine.rows.set("@react-navigation/state", "{}");

		const adapter = createLankaReactNativeAsyncStorageAdapter(engine);
		await createPlaygroundPreferences(adapter).choose("dark", "uk");

		await adapter.clear();

		expect([...engine.rows], "everything, not only this application's").toEqual([]);
	});

	it("removes a session by name and leaves the rest standing", async () => {
		// The shape to write instead. It costs the application a list of its own
		// keys, and that list is the thing a namespace would have given for free.
		const engine = createPlaygroundAsyncStorage();
		engine.rows.set("@react-navigation/state", "{}");

		const adapter = createLankaReactNativeAsyncStorageAdapter(engine);
		const preferences = createPlaygroundPreferences(adapter);
		await preferences.choose("dark", "uk");

		for (const key of (await adapter.keys()).filter((one) => one.startsWith("preferences."))) {
			await adapter.removeItem(key);
		}

		expect(await adapter.keys()).toEqual(["@react-navigation/state"]);
		expect((await preferences.boot()).theme, "back to the default").toBe("light");
	});
});
