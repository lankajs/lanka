import { createAtlasServer } from "@lanka-playgrounds/_server";
import { resetActiveLanka } from "lanka/bootstrap";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createAtlasNodeService } from "./createAtlasNodeService";
import { startAtlasNode } from "./startAtlasNode";
import type { IAtlasNodeService } from "./createAtlasNodeService";
import type { IAtlasServer } from "@lanka-playgrounds/_server";

/**
 * The headless service against the real API.
 *
 * No `@vitest-environment` comment, and that is the one thing worth noticing:
 * every other live suite in this folder needs one, because a browser
 * application's tests run under jsdom and node's fetch refuses a signal built in
 * jsdom's realm. This package has no jsdom to escape from.
 *
 * What only this file can show: the two lifetimes side by side. The process has
 * one ViewModel and watches it; a request has its own instance and touches none.
 */
let api: IAtlasServer;
let base: string;
let service: IAtlasNodeService | null = null;

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	base = await api.listen(0);
	process.env.ATLAS_API = base;
});

afterEach(async () => {
	await service?.stop();
	service = null;
	api.world.reset();
	resetActiveLanka();
});

afterAll(async () => {
	delete process.env.ATLAS_API;
	await api.close();
});

const start = async (): Promise<IAtlasNodeService> => {
	service = await createAtlasNodeService({ apiBaseUrl: base, connect: false });

	return service;
};

describe("starting the framework in a process with no screen", () => {
	it("starts and signs in with the socket open and the stream quietly absent", async () => {
		// The asymmetry, asserted rather than assumed: `WebSocket` is a node global
		// and `EventSource` is not. The SSE transport ASKS, finds no class, and
		// stays quiet — so start-up completes on a runtime that has only one of the
		// two wires, which is what makes this application deployable at all.
		const node = await startAtlasNode({ apiBaseUrl: base });

		expect(node.app.session.current()?.name).toBe("Ada");
		expect(typeof WebSocket).toBe("function");
		expect(typeof EventSource).toBe("undefined");
		node.stop();
	});

	it("starts without opening anything, when the caller says not to", async () => {
		const node = await startAtlasNode({ apiBaseUrl: base, connect: false });

		expect(node.app.session.current()?.name).toBe("Ada");
		node.stop();
	});
});

describe("the process's own ViewModel", () => {
	it("fills from the real API and the watcher hears about it", async () => {
		const running = await start();

		await running.refresh();

		expect(running.changes.length).toBeGreaterThan(0);
		expect(running.changes[0]?.count).toBeGreaterThan(0);
	});

	it("reports nothing on a refresh that changed nothing", async () => {
		const running = await start();
		await running.refresh();
		const afterFirst = running.changes.length;

		await running.refresh();

		// The same rows came back, so there is nothing to tell anybody. A watcher
		// that forwarded every notification would turn a poll into a message storm.
		expect(running.changes).toHaveLength(afterFirst);
	});
});

describe("a request, which has its own instance", () => {
	it("answers a caller from inside a request scope", async () => {
		const running = await start();

		const response = await fetch(`${running.url}/missions`);
		const body = (await response.json()) as { missions: unknown[] };

		expect(response.status).toBe(200);
		expect(body.missions.length).toBeGreaterThan(0);
	});

	it("serves two overlapping requests without either seeing the other", async () => {
		// The failure `runLankaRequest` exists to prevent: on a server, "the
		// instance this process created last" is another caller's. Two at once is
		// the smallest arrangement where a shared instance would show.
		const running = await start();

		const [first, second] = await Promise.all([
			fetch(`${running.url}/missions`).then(
				(r) => r.json() as Promise<{ missions: unknown[] }>,
			),
			fetch(`${running.url}/missions`).then(
				(r) => r.json() as Promise<{ missions: unknown[] }>,
			),
		]);

		expect(first.missions).toEqual(second.missions);
		expect(first.missions.length).toBeGreaterThan(0);
	});

	it("leaves the process's ViewModel alone", async () => {
		const running = await start();

		await fetch(`${running.url}/missions`);

		// A request fetched through a gateway and handed the data back. If it had
		// filled the ViewModel instead, this service would be answering every
		// caller with whatever the last one asked for.
		expect(running.changes).toEqual([]);
	});

	it("answers 404 for a route it does not have", async () => {
		const running = await start();

		const response = await fetch(`${running.url}/nothing-here`);

		expect(response.status).toBe(404);
	});

	it("answers 502 rather than a stack when the API is gone", async () => {
		const running = await start();
		process.env.ATLAS_API = "http://127.0.0.1:1/api";

		const response = await fetch(`${running.url}/missions`);

		expect(response.status).toBe(502);
		process.env.ATLAS_API = base;
	});
});
