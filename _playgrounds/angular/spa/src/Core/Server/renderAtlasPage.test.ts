// @vitest-environment node
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { getLankaProcessRuntime, setActiveLankaRuntime } from "lanka/internal";
import { lankaGateways } from "lanka/locator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { atlasApiBaseUrl } from "./atlasApiBaseUrl";
import { prerenderAtlasMissions } from "./prerenderAtlasMissions";
import { readAtlasMissions } from "./readAtlasMissions";
import { atlasServerGateways, renderAtlasPage } from "./renderAtlasPage";
import type { IAtlasServer } from "@lanka-playgrounds/_server";

/**
 * The server half of an Angular application, which is the SAME project as its
 * browser half.
 *
 * React, Vue and Svelte each needed a separate application for their server
 * host, because in those frameworks the server story is a separate project.
 * Angular's is a second call against the same component tree, so this file sits
 * beside the browser suite rather than in a package of its own — and that is the
 * claim worth asserting: the shell rendered here is `./App/AtlasApp`, imported
 * unchanged.
 *
 * `@vitest-environment node`: this renders to a STRING and reaches the real API,
 * and under jsdom every request fails on a cross-realm `AbortSignal` — the reason
 * every live suite in this folder says the same thing.
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
	it("reads the board through a gateway resolved by name", async () => {
		expect(await readAtlasMissions(new Headers())).toHaveLength(5);
	});

	it("gives two overlapping requests two instances", async () => {
		// One per process would mean the second reader answering for the first the
		// moment two of them overlap, which on a server is always.
		const [first, second] = await Promise.all([
			readAtlasMissions(new Headers()),
			readAtlasMissions(new Headers()),
		]);

		expect(first).toEqual(second);
		expect(first).not.toBe(second);
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
		// A deployed server is exactly this: the only instances it ever has are the
		// per-request ones, so code that escaped its scope has nothing to resolve
		// against and says so.
		//
		// The process pointer is cleared for the scene because a TEST process does
		// have an ambient instance: the kit's setup file bootstraps one before every
		// file.
		const ambient = getLankaProcessRuntime();
		setActiveLankaRuntime(null);

		try {
			expect(() => lankaGateways.atlasMissionGateway).toThrow(/scope/i);
		} finally {
			setActiveLankaRuntime(ambient);
		}
	});
});

describe("renderAtlasPage", () => {
	it("sends a FIRST frame that already has rows in it", async () => {
		const html = await renderAtlasPage(new Headers());

		// The assertion IS the feature: a page that fetched on mount would ship an
		// empty list and fill it on the second frame, over a slower connection,
		// while the user watched a spinner over content the server already had.
		expect(html).toContain("AT-");
		expect(html).toContain("Missions");
	});

	it("renders the SAME shell the browser bootstraps", async () => {
		// One project, two entry points. If the server rendered a shell of its own,
		// this ecosystem would be two applications wearing one name.
		const html = await renderAtlasPage(new Headers());

		expect(html).toContain('aria-label="Missions"');
		expect(html).toContain('aria-label="Board"');
	});

	it("gives every RENDER its own ViewModels", async () => {
		// A module-level provider would be one store for every user connected to the
		// process, and the first request to write a draft into it would serve that
		// draft to the next stranger. Two renders in flight at once is the cheapest
		// way to say the providers belong to a call.
		const [first, second] = await Promise.all([
			renderAtlasPage(new Headers()),
			renderAtlasPage(new Headers({ "x-atlas-client": "second" })),
		]);

		expect(first).toContain("AT-");
		expect(second).toContain("AT-");
	});

	it("takes the document it is told to render into", async () => {
		const html = await renderAtlasPage(
			new Headers(),
			"<html><body><atlas-app></atlas-app></body></html>",
		);

		expect(html).toContain("<body>");
	});
});

describe("where the API is", () => {
	it("reads the environment when a deployment set one", () => {
		// Restored afterwards, because the scenes below this one reach the REAL
		// server and a leaked `https://atlas.example/api` reads as "fetch failed"
		// several files away from the line that set it.
		const before = process.env.ATLAS_API;
		process.env.ATLAS_API = "https://atlas.example/api";

		expect(atlasApiBaseUrl()).toBe("https://atlas.example/api");

		if (before === undefined) delete process.env.ATLAS_API;
		else process.env.ATLAS_API = before;
	});

	it("falls back to the development address", () => {
		const before = process.env.ATLAS_API;
		delete process.env.ATLAS_API;

		expect(atlasApiBaseUrl()).toBe("http://127.0.0.1:4380/api");

		if (before !== undefined) process.env.ATLAS_API = before;
	});
});

describe("the gateways a server render is given", () => {
	it("answers `list` from the rows the request scope already read", async () => {
		// No second network call for what the renderer is holding. A screen's
		// `ngOnInit` does not know it is on a server, and it should not have to.
		const rows = await readAtlasMissions(new Headers());

		expect(await atlasServerGateways(rows).missionGateway.list()).toEqual(rows);
	});

	it("REFUSES every write, which is the design rather than an omission", async () => {
		// A render produces a string, and an action that completed a mission halfway
		// through producing one would have changed the world for a page nobody has
		// seen yet. Nothing calls these during a render; if something starts to, the
		// rejection is where it is noticed.
		const gateways = atlasServerGateways([]);

		await expect(gateways.missionGateway.complete("m-1")).rejects.toThrow(/cannot complete/);
		await expect(gateways.missionGateway.remove("m-1")).rejects.toThrow(/cannot remove/);
		// Reached structurally: `post` is protected on the real GraphQL gateway this
		// object stands in for, and the refusal is worth asserting anyway — it is the
		// one a render would meet if a screen ever tried to write during one.
		const board = gateways.boardGateway as unknown as {
			post: (at: string) => Promise<unknown>;
		};

		await expect(board.post("anything")).rejects.toThrow(/cannot post/);
	});

	it("answers `summary` with nothing, because a first frame has none", async () => {
		expect(await atlasServerGateways([]).boardGateway.summary()).toBeNull();
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
		// a missing parameter is a thing that does not compile, and the arities
		// below are that difference made visible.
		expect(prerenderAtlasMissions).toHaveLength(0);
		expect(readAtlasMissions).toHaveLength(1);
	});
});
