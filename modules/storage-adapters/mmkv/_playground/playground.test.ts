import { describe, expect, it } from "vitest";
import { lankaStorageAdapterConformance } from "@lankajs/tool-testing/lankaStorageAdapterConformance";
import { createLankaMmkvAdapter, LankaMmkvAdapter } from "../src/index";
import { createPlaygroundDeviceSession, createPlaygroundMmkv } from "./app";

/**
 * The package, used the way a device application uses it.
 *
 * The unit tests prove the mapping. This proves the reason for the mapping: an
 * application that must decide something before its first render can, and the
 * same application runs unchanged over either major of the library.
 */
describe("a session that has to answer before the first render", () => {
	it("knows which screen to mount without awaiting anything", () => {
		const engine = createPlaygroundMmkv();
		const session = createPlaygroundDeviceSession(createLankaMmkvAdapter(engine));

		expect(session.firstScreen(), "a device nobody has signed in on").toBe("sign-in");

		// Written by a previous run of the application, which is what a device
		// store is: the value is already there when the process starts.
		engine.rows.set("session.token", "abc");

		expect(session.firstScreen()).toBe("feed");
	});

	it("restores where the visitor was on the same frame as the screen", async () => {
		const session = createPlaygroundDeviceSession(
			createLankaMmkvAdapter(createPlaygroundMmkv()),
		);

		await session.signIn("abc");
		await session.rememberScreen("order/7");

		// No await on the read: this is the line an awaited engine cannot offer,
		// and the whole reason to install MMKV rather than something else.
		expect(session.lastScreen()).toBe("order/7");
	});

	it("leaves nothing on the device when the session ends", async () => {
		const engine = createPlaygroundMmkv();
		const session = createPlaygroundDeviceSession(createLankaMmkvAdapter(engine));

		await session.signIn("abc");
		await session.rememberScreen("order/7");
		await session.signOut();

		expect([...engine.rows], "what is left on the device").toEqual([]);
		expect(session.firstScreen()).toBe("sign-in");
	});
});

describe("the same application over either major", () => {
	it("runs unchanged over v3 and v4, which name their delete differently", async () => {
		const v3 = createPlaygroundMmkv(3);
		const v4 = createPlaygroundMmkv(4);

		for (const engine of [v3, v4]) {
			const session = createPlaygroundDeviceSession(createLankaMmkvAdapter(engine));

			await session.signIn("abc");
			await session.rememberScreen("order/7");
			await session.signOut();

			expect([...engine.rows], "after a sign-out").toEqual([]);
		}
	});

	it("is the same adapter whichever style built it", () => {
		// Both styles over one class, so a behaviour cannot reach one and not the
		// other. A consumer picks the style their project already uses.
		const engine = createPlaygroundMmkv();
		const built = new LankaMmkvAdapter(engine);
		const made = createLankaMmkvAdapter(engine);

		built.setItemSync("theme", "dark");

		expect(made.getItemSync("theme")).toBe("dark");
		expect(made).toBeInstanceOf(LankaMmkvAdapter);
	});
});

/**
 * The family's shared assertions, over BOTH shapes of the engine.
 *
 * Twice, because the difference between the majors is exactly the kind of thing
 * a suite run once over the newer one would miss — and the older one is what
 * most applications have installed.
 */
lankaStorageAdapterConformance({
	vendor: "MMKV v4",
	create: () => createLankaMmkvAdapter(createPlaygroundMmkv(4)),
	sync: true,
});

lankaStorageAdapterConformance({
	vendor: "MMKV v3",
	create: () => createLankaMmkvAdapter(createPlaygroundMmkv(3)),
	sync: true,
});
