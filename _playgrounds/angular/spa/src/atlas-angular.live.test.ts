// @vitest-environment node
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { resetActiveLanka } from "lanka/bootstrap";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startAtlasAngular } from "./startAtlasAngular";
import type { IAtlasServer } from "@lanka-playgrounds/_server";
import type { IAtlasAngularApp } from "./startAtlasAngular";

/**
 * The Angular application's start-up, against the real API.
 *
 * `@vitest-environment node` for the reason every live suite here states: under
 * jsdom the `AbortController` is jsdom's and `fetch` is node's, and node's fetch
 * refuses a signal built in another realm — so every request the framework sends
 * fails as `kind: "network"` after spending the whole retry ladder, and reads
 * exactly like a server that is not there.
 *
 * Nothing here renders, which is the point: start-up is the half of a Angular
 * application that has no Angular in it, and this file is where that is checked
 * rather than asserted. The components are tested beside it, under jsdom, and
 * reach no network — the division every application ends up making.
 */
let api: IAtlasServer;
let base: string;
let angular: IAtlasAngularApp | null = null;

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	base = await api.listen(0);
});

afterEach(() => {
	angular?.stop();
	angular = null;
	api.world.reset();
	resetActiveLanka();
});

afterAll(async () => {
	await api.close();
});

const start = async (connect = false): Promise<IAtlasAngularApp> => {
	angular = await startAtlasAngular({ apiBaseUrl: base, connect });

	return angular;
};

describe("starting a Angular application against the real API", () => {
	it("starts, signs in and holds the socket", async () => {
		const started = await start();

		expect(started.app.session.current()?.name).toBe("Ada");
		expect(started.channel).toBeDefined();
	});

	it("answers with the providers an Angular application is bootstrapped from", async () => {
		// The one line in this file that mentions Angular, and it is the whole of how
		// this ecosystem differs: every other start-up returns gateways for a shell to
		// build ViewModels from, and this one returns an injector configuration that
		// already holds them.
		const started = await start();

		expect(started.config.providers).toHaveLength(3);
	});

	it("reads the board over the real wire, with no renderer anywhere", async () => {
		const started = await start();

		const missions = await started.app.missionGateway.list();

		// The same gateway the other four applications call, from a file that
		// mentions no framework at all. If lanka knew which renderer it was under,
		// this is where it would show.
		expect(missions.length).toBeGreaterThan(0);
	});

	it("disposes what it started, so a second start is not a second instance", async () => {
		const first = await start();
		first.stop();
		angular = null;

		const second = await start();

		expect(second.app.session.current()?.name).toBe("Ada");
	});

	it("opens the wires when asked to", async () => {
		const started = await start(true);

		expect(started.app.session.current()?.name).toBe("Ada");
		expect(typeof started.channel.disconnect).toBe("function");
	});
});
