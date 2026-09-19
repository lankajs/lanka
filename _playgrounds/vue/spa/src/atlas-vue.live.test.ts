// @vitest-environment node
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { resetActiveLanka } from "lanka/bootstrap";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startAtlasVue } from "./startAtlasVue";
import type { IAtlasServer } from "@lanka-playgrounds/_server";
import type { IAtlasVueApp } from "./startAtlasVue";

/**
 * The Vue application's start-up, against the real API.
 *
 * `@vitest-environment node` for the reason every live suite here states: under
 * jsdom the `AbortController` is jsdom's and `fetch` is node's, and node's fetch
 * refuses a signal built in another realm — so every request the framework sends
 * fails as `kind: "network"` after spending the whole retry ladder, and reads
 * exactly like a server that is not there.
 *
 * Nothing here renders, which is the point: start-up is the half of a Vue
 * application that has no Vue in it, and this file is where that is checked
 * rather than asserted. The components are tested beside it, under jsdom, and
 * reach no network — the division every application ends up making.
 */
let api: IAtlasServer;
let base: string;
let vue: IAtlasVueApp | null = null;

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	base = await api.listen(0);
});

afterEach(() => {
	vue?.stop();
	vue = null;
	api.world.reset();
	resetActiveLanka();
});

afterAll(async () => {
	await api.close();
});

const start = async (connect = false): Promise<IAtlasVueApp> => {
	vue = await startAtlasVue({ apiBaseUrl: base, connect });

	return vue;
};

describe("starting a Vue application against the real API", () => {
	it("starts, signs in and holds the socket", async () => {
		const started = await start();

		expect(started.app.session.current()?.name).toBe("Ada");
		expect(started.channel).toBeDefined();
	});

	it("reads the board over the real wire, with no renderer anywhere", async () => {
		const started = await start();

		const missions = await started.app.missionGateway.list();

		// The same gateway the React application calls, from a file that mentions no
		// framework at all. If lanka knew which renderer it was under, this is where
		// it would show.
		expect(missions.length).toBeGreaterThan(0);
	});

	it("disposes what it started, so a second start is not a second instance", async () => {
		const first = await start();
		first.stop();
		vue = null;

		const second = await start();

		expect(second.app.session.current()?.name).toBe("Ada");
	});

	it("opens the wires when asked to", async () => {
		const started = await start(true);

		expect(started.app.session.current()?.name).toBe("Ada");
		expect(typeof started.channel.disconnect).toBe("function");
	});
});

describe("the packages a browser application reaches, over the real wire", () => {
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

	it("holds an avatar cache that outlives any one screen", async () => {
		// Built in start-up rather than inside a view: the bytes outlive a screen,
		// and a cache per screen starts empty every time somebody navigates — which
		// is the fetch it exists to avoid.
		const started = await start();

		expect(typeof started.avatars.warmCache).toBe("function");
	});
});
