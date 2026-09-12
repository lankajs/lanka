import { describe, expect, it } from "vitest";
import { lankaStorageAdapterConformance } from "@lankajs/tool-testing/lankaStorageAdapterConformance";
import {
	createLankaReactNativeAsyncStorageAdapter,
	LankaReactNativeAsyncStorageAdapter,
} from "../src/index";
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
