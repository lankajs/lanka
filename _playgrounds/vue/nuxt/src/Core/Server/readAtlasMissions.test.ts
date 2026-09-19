// @vitest-environment node
import { readFileSync } from "node:fs";
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { getLankaProcessRuntime, setActiveLankaRuntime } from "lanka/internal";
import { lankaGateways } from "lanka/locator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { atlasApiBaseUrl } from "./atlasApiBaseUrl";
import {
	ATLAS_PRERENDER_KEY,
	atlasPrerenderStore,
	keepPrerenderedMissions,
	readPrerenderedMissions,
} from "./atlasPrerenderStore";
import { prerenderAtlasMissions } from "./prerenderAtlasMissions";
import { readAtlasMissions } from "./readAtlasMissions";
import type { IAtlasServer } from "@lanka-playgrounds/_server";

/**
 * The one place a Nuxt application needs `@lankajs/host`.
 *
 * The same assertions the Next and Astro applications make, against the same
 * server — which is the point of a third host existing: if the seam were a Next
 * adapter in disguise, this file could not be written. Nitro has a request, and
 * every server that has a request has `AsyncLocalStorage`.
 *
 * `@vitest-environment node`: nothing here renders, and under jsdom every real
 * request fails on a cross-realm `AbortSignal` — the reason every live suite in
 * this folder says the same thing.
 */
let api: IAtlasServer;

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	process.env.NUXT_ATLAS_API = await api.listen(0);
});

afterAll(async () => {
	delete process.env.NUXT_ATLAS_API;
	await api.close();
});

describe("readAtlasMissions", () => {
	it("reads the board through a gateway resolved by name", async () => {
		expect(await readAtlasMissions({})).toHaveLength(5);
	});

	it("gives two overlapping requests two instances", async () => {
		// One per process would mean the second reader answering for the first the
		// moment two of them overlap, which on a server is always.
		const [first, second] = await Promise.all([readAtlasMissions({}), readAtlasMissions({})]);

		expect(first).toEqual(second);
		expect(first).not.toBe(second);
	});

	it("takes a plain object of headers, which is what Nitro hands over", async () => {
		// Next's `headers()` and a loader's `request.headers` are `Headers`-like;
		// `getRequestHeaders` is a plain object. The host layer takes both, which is
		// what makes it a seam rather than an adapter for whoever came first.
		const missions = await readAtlasMissions({ "x-atlas-client": "nitro" });

		expect(missions).toHaveLength(5);
	});

	it("carries the caller's identity into the API call", async () => {
		// Without it a page renders signed out and then flips signed in when the
		// browser fetches with the cookie it always had — and nothing errors.
		const base = process.env.NUXT_ATLAS_API ?? "";
		const opened = await fetch(`${base}/session`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "Ada" }),
		});
		const session = (await opened.json()) as { token: string };

		await readAtlasMissions({ authorization: `Bearer ${session.token}` });
		const who = await fetch(`${base}/me`, {
			headers: { authorization: `Bearer ${session.token}` },
		});

		expect(who.status).toBe(200);
	});

	it("refuses a gateway reached with no scope and no instance behind it", () => {
		// A deployed Nuxt server is exactly this: the only instances it ever has are
		// the per-request ones, so code that escaped its scope has nothing to
		// resolve against and says so.
		//
		// The process pointer is cleared for the scene because a TEST process does
		// have an ambient instance: the kit's setup file bootstraps one before every
		// file. That is the other arm, asserted below.
		const ambient = getLankaProcessRuntime();
		setActiveLankaRuntime(null);

		try {
			expect(() => lankaGateways.atlasMissionGateway).toThrow(/scope/i);
		} finally {
			setActiveLankaRuntime(ambient);
		}
	});
});

describe("prerenderAtlasMissions", () => {
	it("reads the board for output that will be shared by everybody", async () => {
		expect(await prerenderAtlasMissions()).toHaveLength(5);
	});

	it("REFUSES a caller's identity, which is the only difference from the request call", () => {
		// A prerender has no caller, so there are no headers to forward — and a
		// scope that accepted them would let a build bake ONE user's session into a
		// page every user is then served. A flag is a thing somebody passes wrongly;
		// a missing parameter is a thing that does not compile.
		expect(prerenderAtlasMissions).toHaveLength(0);
		expect(readAtlasMissions).toHaveLength(1);
	});
});

describe("where the API is", () => {
	it("reads the environment when a deployment set one", () => {
		// `NUXT_` and not `VITE_`: this file is read on BOTH sides, and a bundler
		// global would be undefined in the Nitro half.
		process.env.NUXT_ATLAS_API = "https://atlas.example/api";

		expect(atlasApiBaseUrl()).toBe("https://atlas.example/api");
	});

	it("falls back to the development address", () => {
		const before = process.env.NUXT_ATLAS_API;
		delete process.env.NUXT_ATLAS_API;

		expect(atlasApiBaseUrl()).toBe("http://127.0.0.1:4380/api");

		if (before !== undefined) process.env.NUXT_ATLAS_API = before;
	});
});

describe("what a BUILD remembers, through the one storage adapter that runs on a server", () => {
	it("costs one request however many routes ask for the board", async () => {
		// A build prerenders many routes and every one of them wants the same board.
		// Without the store that is one request per route, against a server that has
		// no reason to be asked twice.
		await keepPrerenderedMissions([]);
		await atlasPrerenderStore.setLocal(ATLAS_PRERENDER_KEY, JSON.stringify([]));

		const first = await prerenderAtlasMissions();
		const second = await prerenderAtlasMissions();

		expect(second).toEqual(first);
	});

	it("returns what was stored byte for byte, which is the port's clause 1", async () => {
		// unstorage's own `getItem` DESERIALISES — a stored `"null"` comes back as
		// `null` — so the adapter reads raw underneath and the encoding is this
		// application's decision. A store that quietly parsed would turn a mission
		// whose title is `"null"` into no mission at all.
		const mission = {
			id: "m-1",
			code: "AT-101",
			title: "null",
			status: "queued" as const,
			priority: 3,
			crewId: null,
			updatedAt: "2026-09-15T00:00:00.000Z",
		};

		await keepPrerenderedMissions([mission]);

		expect(await readPrerenderedMissions()).toEqual([mission]);
	});

	it("is reachable from the prerender and from NOTHING else", () => {
		// The refusal this store depends on. `readAtlasMissions` runs inside a scope
		// carrying a cookie, and one that remembered its answer would serve the
		// first visitor's board to the second. Comments stripped, because both files
		// discuss the store at length and a scan that matched prose would fail on
		// the explanation.
		const code = readFileSync("src/Core/Server/readAtlasMissions.ts", "utf8").replace(
			/\/\*[\s\S]*?\*\//g,
			"",
		);

		expect(code).not.toContain("atlasPrerenderStore");
		expect(code).not.toContain("PrerenderedMissions");
	});
});
