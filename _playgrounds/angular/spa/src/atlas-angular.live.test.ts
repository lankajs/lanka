// @vitest-environment node
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { lankaDevtools } from "@lankajs/plugin-devtools";
import { lankaPrefetch } from "@lankajs/plugin-prefetch";
import { lankaSse } from "@lankajs/plugin-sse";
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

		expect(started.config.providers).toHaveLength(4);
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

/**
 * The browser-side packages this application reaches, checked here rather than
 * beside the components.
 *
 * Start-up is the half of an Angular application with no Angular in it, and this
 * file is where that half is exercised against the real API. It is also the only
 * place it CAN be: `startAtlas` signs in over the network, and under jsdom every
 * request dies on a cross-realm `AbortSignal` before a plugin is ever installed
 * — the reason this file declares `@vitest-environment node` in the first place.
 *
 * A package proved under one framework is a package proved under one framework,
 * which is why these say the same things `_playgrounds/react/spa` says about the
 * same three.
 */
describe("the packages start-up installs, beyond the two wires", () => {
	it("installs the inspector and the prefetch ladder, and refuses a second of either", async () => {
		// A duplicate is refused BY NAME, which is both the cheapest proof a plugin
		// is on the instance and the more interesting claim: two copies of one
		// policy do everything twice, and that surfaces as backend load — much
		// later, and to somebody else.
		const started = await start();

		expect(() => started.app.lanka.use(lankaDevtools({ exposeAs: "__atlas" }))).toThrow(
			/@lankajs\/plugin-devtools/,
		);
		expect(() => started.app.lanka.use(lankaPrefetch({ intent: { ttlMs: 20_000 } }))).toThrow(
			/@lankajs\/plugin-prefetch/,
		);
		expect(() => started.app.lanka.use(lankaSse({ path: "/sse/events" }))).toThrow(
			/@lankajs\/plugin-sse/,
		);
	});

	it("registers the read cache under the NAME the locator resolves", async () => {
		// `registerInstance` under a name, not a class the locator could build: the
		// client is an argument, and a locator that defaulted one would hand out a
		// second cache that disagrees with this one on the first mutation.
		const started = await start();

		expect(started.app.lanka.resolve("AtlasReadCache")).toBe(started.cache);
	});

	it("reads one resource once when two screens ask for it", async () => {
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

	it("records a request the application made, because the inspector is installed FIRST", async () => {
		// Installed before the wires so its middleware WRAPS the retry policy: one
		// row is then one call the application made, including whatever it took to
		// succeed, rather than one row per attempt.
		//
		// `isDevelopment`, because a disabled inspector accumulates nothing — which
		// is its main property and the reason the other scenes here see no rows.
		const started = await startAtlasAngular({
			apiBaseUrl: base,
			connect: false,
			isDevelopment: true,
		});
		angular = started;

		await started.app.missionGateway.list();

		const devtools = (
			globalThis as { __atlas?: { getSnapshot: () => { requests: unknown[] } } }
		).__atlas;

		expect(devtools?.getSnapshot().requests.length).toBeGreaterThan(0);
	});
});
