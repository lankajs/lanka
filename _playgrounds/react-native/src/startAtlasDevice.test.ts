import { createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createAtlasFakeEngines } from "./_Testing/createAtlasFakeEngines";
import { startAtlasDevice } from "./startAtlasDevice";
import type { IAtlasDevice } from "./startAtlasDevice";
import type { IAtlasServer } from "@lanka-playgrounds/_server";

/**
 * The device application, started against the real API.
 *
 * No renderer and no device — and what is left is most of it: the storage
 * wiring, the first frame's decision, the session, the gateways and the same
 * ViewModels a browser renders. What cannot be tested here is the drawing, which
 * is `react-native`'s to get right.
 *
 * The socket is left closed. React Native HAS a `WebSocket`, so the plugin is
 * not degraded here the way the server-sent stream is — but a connection this
 * suite does not assert about is a connection it should not open.
 */
let api: IAtlasServer;
let base: string;
let device: IAtlasDevice | null = null;

const start = async (engines = createAtlasFakeEngines()): Promise<IAtlasDevice> => {
	device = await startAtlasDevice({ apiBaseUrl: base, engines, connect: false });

	return device;
};

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	base = await api.listen(0);
});

afterEach(() => {
	device?.stop();
	device = null;
	api.world.reset();
});

afterAll(async () => {
	await api.close();
});

describe("startAtlasDevice", () => {
	it("decides the first screen before it has awaited anything", async () => {
		const started = await start();

		expect(started.firstFrame.screen).toBe("sign-in");
	});

	it("sends a returning person straight to the board", async () => {
		const engines = createAtlasFakeEngines();
		engines.mmkv.set("atlas.operator", "Grace");

		const started = await start(engines);

		expect(started.firstFrame.screen).toBe("board");
	});

	it("reads the board through the same gateway every other application uses", async () => {
		const started = await start();
		const useVM = createAtlasMissionsVM(started.app.missionGateway);

		await useVM.getState().fetchMissions();

		expect(useVM.getState().missions).toHaveLength(5);
	});

	it("completes a mission optimistically, exactly as the browser does", async () => {
		const started = await start();
		const useVM = createAtlasMissionsVM(started.app.missionGateway);
		await useVM.getState().fetchMissions();

		await useVM.getState().completeMission("m-2");

		expect(useVM.getState().missions.find((one) => one.id === "m-2")?.status).toBe("done");
		expect(api.world.mission("m-2")?.status).toBe("done");
	});

	it("keeps a token somewhere the first frame cannot read, and a name where it can", async () => {
		const started = await start();

		await started.session.remember("Ada", "a-token");

		expect(started.session.operator()).toBe("Ada");
		expect(await started.session.token()).toBe("a-token");
	});

	it("stops cleanly, because an instance that outlives its screen is a leak", async () => {
		const started = await start();

		started.stop();
		device = null;

		expect(started.app.lanka.isBootstrapped()).toBe(false);
	});
});
