import { describe, expect, it } from "vitest";
import { AtlasDeviceSession } from "./AtlasDeviceSession";
import { createAtlasDeviceStorage } from "./createAtlasDeviceStorage";
import { createAtlasFakeEngines } from "../../_Testing/createAtlasFakeEngines";

const session = () => {
	const storage = createAtlasDeviceStorage(createAtlasFakeEngines());

	return { storage, session: new AtlasDeviceSession(storage) };
};

describe("AtlasDeviceSession", () => {
	it("knows nobody before anybody signs in", async () => {
		const device = session();

		expect(device.session.operator()).toBeNull();
		expect(await device.session.token()).toBeNull();
	});

	it("puts the token behind the lock and the NAME where the first frame can read it", async () => {
		// Two stores for one fact: the keychain is slow and asynchronous, and the
		// first frame has to decide which screen to mount without waiting for it.
		const device = session();

		await device.session.remember("Ada", "a-token");

		expect(device.session.operator()).toBe("Ada");
		expect(await device.session.token()).toBe("a-token");
	});

	it("reads the name synchronously, which a keychain could not answer", () => {
		const device = session();

		device.storage.setLocalSync("atlas.operator", "Grace");

		expect(device.session.operator()).toBe("Grace");
	});

	it("forgets the token and the name together", async () => {
		const device = session();
		await device.session.remember("Ada", "a-token");

		await device.session.forget();

		expect(device.session.operator()).toBeNull();
		expect(await device.session.token()).toBeNull();
	});

	it("leaves everything else on the device alone when it forgets", async () => {
		// `clear()` on the engine an application already has would empty its whole
		// space, preferences included. The keychain adapter namespaces itself.
		const device = session();
		await device.session.remember("Ada", "a-token");
		device.storage.setLocalSync("atlas.sortField", "priority");

		await device.session.forget();

		expect(device.storage.getLocalSync("atlas.sortField")).toBe("priority");
	});
});
