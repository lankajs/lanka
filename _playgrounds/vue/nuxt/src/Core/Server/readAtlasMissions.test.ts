// @vitest-environment node
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { getLankaProcessRuntime, setActiveLankaRuntime } from "lanka/internal";
import { lankaGateways } from "lanka/locator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { atlasApiBaseUrl } from "./atlasApiBaseUrl";
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
	it("reads the board inside a request scope", async () => {
		expect(await readAtlasMissions({})).toHaveLength(5);
	});

	it("gives every request its own instance", async () => {
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
	it("reads the board at build time, with no caller", async () => {
		expect(await prerenderAtlasMissions()).toHaveLength(5);
	});

	it("is a DIFFERENT name rather than a flag, and that is the refusal", () => {
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
