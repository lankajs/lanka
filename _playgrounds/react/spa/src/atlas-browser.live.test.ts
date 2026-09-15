// @vitest-environment node
import { createAtlasServer } from "@lanka-playgrounds/_server";
import {
	atlasBoardMessagePosted,
	atlasMissionCompleted,
	createAtlasMissionsVM,
} from "@lanka-playgrounds/_shared";
import { createLankaEventRecorder } from "@lankajs/tool-testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AtlasBoardChannel } from "./Gateways/AtlasBoardChannel/AtlasBoardChannel";
import { installAtlasEventSource } from "./_Testing/installAtlasEventSource";
import { startAtlasBrowser } from "./startAtlasBrowser";
import type { IAtlasBrowser } from "./startAtlasBrowser";
import type { IAtlasServer } from "@lanka-playgrounds/_server";

/**
 * The two wires, against the real API.
 *
 * `@vitest-environment node` for the reason `atlas.live.test.ts` states in full:
 * under jsdom the `AbortController` is jsdom's and `fetch` is node's, and every
 * request carrying a deadline is refused by the realm it was handed to. Nothing
 * here renders, so node is the honest environment — the tests that DO render
 * keep jsdom and reach no network, which is the division every application
 * makes in the end.
 *
 * What this file is for, and what the component tests beside it cannot show: a
 * server event and a socket message become the SAME facts a button press does,
 * and a screen cannot tell which one arrived.
 */
let api: IAtlasServer;
let base: string;
let browser: IAtlasBrowser | null = null;
let uninstallEventSource: (() => void) | null = null;

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	base = await api.listen(0);
	uninstallEventSource = installAtlasEventSource();
});

afterEach(() => {
	browser?.stop();
	browser = null;
	api.world.reset();
});

afterAll(async () => {
	uninstallEventSource?.();
	await api.close();
});

const start = async (): Promise<IAtlasBrowser> => {
	browser = await startAtlasBrowser({ apiBaseUrl: base });

	return browser;
};

describe("the browser application against the real API", () => {
	it("starts, signs in and holds both wires", async () => {
		const started = await start();

		expect(started.app.session.current()?.name).toBe("Ada");
		expect(started.cache).toBeDefined();
	});

	it("turns a server-sent event into the fact a screen already listens for", async () => {
		// Nothing about this is SSE-shaped by the time it reaches a ViewModel: the
		// bridge is where the protocol stops, which is what lets the wire be
		// swapped without a screen noticing.
		const started = await start();
		const useVM = createAtlasMissionsVM(started.app.missionGateway);
		await useVM.getState().fetchMissions();
		const events = createLankaEventRecorder({ lanka: started.app.lanka });

		api.world.change("m-2", { status: "done" });
		await events.waitFor("mission.completed", { timeoutMs: 3000 });

		events.stop();
		expect(api.world.mission("m-2")?.status).toBe("done");
	});

	it("holds a message sent before the link is up, and sends it when it opens", async () => {
		// `false` is not a failure: the link was down and the message was HELD for
		// the next connection. Losing the click that happened during a reconnect is
		// not a behaviour anybody chose, and a reconnect is invisible from a screen.
		const started = await start();
		const channel = new AtlasBoardChannel(started.channel);
		const events = createLankaEventRecorder({ lanka: started.app.lanka });

		expect(channel.say("north ridge clear")).toBe(false);
		const said = await events.waitFor<{ text: string }>("board.said", { timeoutMs: 3000 });

		expect(said.text).toBe("north ridge clear");
		events.stop();
	});

	it("reports a message as sent once the link is actually open", async () => {
		const started = await start();
		const channel = new AtlasBoardChannel(started.channel);
		await expect.poll(() => started.channel.isOpen(), { timeout: 3000 }).toBe(true);

		expect(channel.say("relay mast up")).toBe(true);
	});

	it("completes a mission over the socket, which is the other wire for one intent", async () => {
		const started = await start();
		const channel = new AtlasBoardChannel(started.channel);
		const events = createLankaEventRecorder({ lanka: started.app.lanka });

		channel.complete("m-3");
		await events.waitFor("mission.completed", { timeoutMs: 3000 });

		events.stop();
		expect(api.world.mission("m-3")?.status).toBe("done");
	});

	it("reads one resource once when two screens ask for it", async () => {
		// The slot a host framework would fill. In a plain single-page application
		// it is empty, and without a cache two screens reading one resource send
		// two requests and grow two independently ageing copies.
		//
		// `staleMs` is what makes the second read free. Without it the answer is
		// stale the moment it arrives, which is the right default for a cache and
		// the wrong one for this claim.
		const started = await start();
		let reads = 0;
		const load = () => {
			reads += 1;

			return started.app.missionGateway.list();
		};

		await started.cache.read(["missions"], load, { staleMs: 30_000 });
		await started.cache.read(["missions"], load, { staleMs: 30_000 });

		expect(reads).toBe(1);
	});

	it("tells the cache what the SERVER answered after a save", async () => {
		const started = await start();
		await started.cache.read(["missions"], () => started.app.missionGateway.list());

		const saved = await started.app.missionGateway.rename("m-1", "Survey the south ridge");
		started.cache.write(["mission", "m-1"], saved);

		expect(await started.cache.read(["mission", "m-1"], () => Promise.resolve(saved))).toEqual(
			saved,
		);
	});

	it("keeps a mission the board announced, without refetching for it", async () => {
		const started = await start();
		const useVM = createAtlasMissionsVM(started.app.missionGateway);
		await useVM.getState().fetchMissions();

		atlasMissionCompleted.trigger({
			id: "m-2",
			mission: { ...api.world.mission("m-2")!, status: "done" },
		});

		expect(useVM.getState().missions.find((one) => one.id === "m-2")?.status).toBe("done");
	});

	it("announces a board message as a fact any screen may subscribe to", async () => {
		const started = await start();
		const events = createLankaEventRecorder({ lanka: started.app.lanka });

		atlasBoardMessagePosted.trigger({ text: "relay mast up", at: "2026-09-13T00:00:00Z" });

		expect(events.of<{ text: string }>("board.said")).toEqual([
			{ text: "relay mast up", at: "2026-09-13T00:00:00Z" },
		]);
		events.stop();
	});
});
