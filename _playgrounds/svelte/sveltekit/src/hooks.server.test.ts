// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { handle } from "./hooks.server";
import type { RequestEvent } from "@sveltejs/kit";

/**
 * The hook every request passes through, and the one thing it is allowed to do.
 *
 * Small enough to look pointless and worth asserting for exactly that reason:
 * what this file must NOT do is open a scope, and a test that fixes the
 * behaviour is what stops the obvious-looking change.
 */
const eventWith = (locals: Record<string, unknown> = {}): RequestEvent =>
	({ locals, request: new Request("http://atlas.test/") }) as unknown as RequestEvent;

describe("handle", () => {
	it("puts ONE answer to where the API is on the request", async () => {
		const event = eventWith();
		const resolve = vi.fn(() => Promise.resolve(new Response("ok")));

		await handle({ event, resolve });

		expect(event.locals.atlasApiBaseUrl).toBe("http://127.0.0.1:4380/api");
	});

	it("reads the environment the deployment set", async () => {
		const before = process.env.ATLAS_API;
		process.env.ATLAS_API = "https://atlas.example/api";
		const event = eventWith();

		await handle({ event, resolve: vi.fn(() => Promise.resolve(new Response("ok"))) });

		expect(event.locals.atlasApiBaseUrl).toBe("https://atlas.example/api");

		if (before === undefined) delete process.env.ATLAS_API;
		else process.env.ATLAS_API = before;
	});

	it("hands the request on, and answers with what Kit rendered", async () => {
		const rendered = new Response("the page");
		const resolve = vi.fn(() => Promise.resolve(rendered));
		const event = eventWith();

		expect(await handle({ event, resolve })).toBe(rendered);
		expect(resolve).toHaveBeenCalledWith(event);
	});

	it("opens NO scope, which is the refusal this file exists to record", () => {
		// `runLankaRequest` holds an instance for the duration of a callback, and a
		// `load` function that inherited one from here would work without saying so
		// — until the same function was called from a script, a test or a queue
		// worker, where no hook ran and the gateway resolves against nothing.
		//
		// A scope visible at the call site is a scope a reader can check; one
		// inherited from a hook two files away is a scope that is right by accident.
		// Comments stripped first, because the docblock above this hook DISCUSSES
		// both names at length — a scan that matched prose would fail on the file's
		// own explanation of why it does not do the thing.
		const code = readFileSync("src/hooks.server.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

		expect(code).not.toContain("runLankaRequest");
		expect(code).not.toContain("runLankaStatic");
	});
});
