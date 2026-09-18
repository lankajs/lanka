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
 * The one place a Kit application needs `@lankajs/host`.
 *
 * The same assertions the Next, Nuxt and Astro applications make, against the
 * same server — which is the point of a fourth host existing: if the seam were a
 * Next adapter in disguise, this file could not be written. Kit's `load` hands
 * over a real `Request`, and every server that has a request has
 * `AsyncLocalStorage`.
 *
 * `@vitest-environment node`: nothing here renders, and under jsdom every real
 * request fails on a cross-realm `AbortSignal` — the reason every live suite in
 * this folder says the same thing.
 */
let api: IAtlasServer;

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	process.env.ATLAS_API = await api.listen(0);
});

afterAll(async () => {
	delete process.env.ATLAS_API;
	await api.close();
});

describe("readAtlasMissions", () => {
	it("reads the board inside a request scope", async () => {
		expect(await readAtlasMissions(new Headers())).toHaveLength(5);
	});

	it("gives every request its own instance", async () => {
		// One per process would mean the second reader answering for the first the
		// moment two of them overlap, which on a server is always.
		const [first, second] = await Promise.all([
			readAtlasMissions(new Headers()),
			readAtlasMissions(new Headers()),
		]);

		expect(first).toEqual(second);
		expect(first).not.toBe(second);
	});

	it("takes a `Headers`, which is what Kit's `load` hands over", async () => {
		// Nitro's `getRequestHeaders` is a plain object; `event.request.headers` is
		// a `Headers`. The host layer takes both, which is what makes it a seam
		// rather than an adapter for whoever came first.
		const missions = await readAtlasMissions(new Headers({ "x-atlas-client": "kit" }));

		expect(missions).toHaveLength(5);
	});

	it("carries the caller's identity into the API call", async () => {
		// Without it a page renders signed out and then flips signed in when the
		// browser fetches with the cookie it always had — and nothing errors.
		const base = process.env.ATLAS_API ?? "";
		const opened = await fetch(`${base}/session`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "Ada" }),
		});
		const session = (await opened.json()) as { token: string };

		await readAtlasMissions(new Headers({ authorization: `Bearer ${session.token}` }));
		const who = await fetch(`${base}/me`, {
			headers: { authorization: `Bearer ${session.token}` },
		});

		expect(who.status).toBe(200);
	});

	it("refuses a gateway reached with no scope and no instance behind it", () => {
		// A deployed Kit server is exactly this: the only instances it ever has are
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

	it("resolves against the ambient instance when there IS one", () => {
		// The other arm. A test process, a script and a `vite dev` boot all have one,
		// and code outside a scope must keep working there rather than throwing for a
		// reason that only exists in production.
		expect(getLankaProcessRuntime()).not.toBeNull();
		expect(lankaGateways.atlasMissionGateway).toBeDefined();
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
		// `ATLAS_API` with no bundler prefix, unlike the SPA's `VITE_ATLAS_API`:
		// this module is server-only, so the value never has to be public and a name
		// that is not public should not claim to be.
		process.env.ATLAS_API = "https://atlas.example/api";

		expect(atlasApiBaseUrl()).toBe("https://atlas.example/api");
	});

	it("falls back to the development address", () => {
		const before = process.env.ATLAS_API;
		delete process.env.ATLAS_API;

		expect(atlasApiBaseUrl()).toBe("http://127.0.0.1:4380/api");

		if (before !== undefined) process.env.ATLAS_API = before;
	});
});
