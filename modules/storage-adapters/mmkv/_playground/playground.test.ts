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

describe("more than one store, and an engine that refuses", () => {
	/**
	 * The two things an application discovers after the first screen works.
	 *
	 * MMKV instances are separated by id, which is how one application keeps a
	 * session, a per-tenant space and a test's scratch space apart. The adapter
	 * never constructs an instance, so this separation is the application's to
	 * make — and this is the scene that says the adapter does not get in the way.
	 *
	 * The second is what a device does when the store cannot take a write: a full
	 * disk, an encryption key that no longer opens the file. An adapter that
	 * swallowed it would leave the application believing it had saved something.
	 */
	it("keeps two instances apart, because their ids are", async () => {
		const session = createLankaMmkvAdapter(createPlaygroundMmkv());
		const tenant = createLankaMmkvAdapter(createPlaygroundMmkv());

		await session.setItem("theme", "dark");
		await tenant.setItem("theme", "light");

		expect(await session.getItem("theme")).toBe("dark");
		expect(await tenant.getItem("theme")).toBe("light");

		await tenant.clear();

		expect(await session.getItem("theme"), "one space emptied, not both").toBe("dark");
	});

	it("hands a refusal to the caller instead of reporting success", async () => {
		const engine = createPlaygroundMmkv();
		const refusing = {
			...engine,
			set: () => {
				throw new Error("mmkv: no space left on device");
			},
		};
		const adapter = createLankaMmkvAdapter(refusing);

		// Synchronously for the synchronous half, and as a rejection for the other,
		// because a caller writing `await` must be able to catch it the same way.
		expect(() => adapter.setItemSync("session.token", "abc")).toThrow(/no space/);
		await expect(adapter.setItem("session.token", "abc")).rejects.toThrow(/no space/);
		expect(await adapter.getItem("session.token")).toBeNull();
	});

	it("survives a store somebody else already filled", async () => {
		// A device store is never empty on the second launch, and the rows may be
		// older than the code reading them.
		const engine = createPlaygroundMmkv(3);
		engine.rows.set("left.by.version.1", "{}");
		engine.rows.set("session.token", "abc");

		const adapter = createLankaMmkvAdapter(engine);

		expect((await adapter.keys()).sort()).toEqual(["left.by.version.1", "session.token"]);

		await adapter.clear();

		expect([...engine.rows], "a wipe takes the older rows too").toEqual([]);
	});
});
