// @vitest-environment node
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { lankaGateways } from "lanka/locator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readAtlasBoard } from "./readAtlasBoard";
import type { IAtlasServer } from "@lanka-playgrounds/_server";

/**
 * The one place an Astro application needs `@lankajs/host`.
 *
 * The same two assertions the Next application makes, against the same server —
 * which is the point of a fourth application existing: if the seam were a Next
 * adapter in disguise, this file could not be written.
 */
let api: IAtlasServer;

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	// `vi.stubEnv` rather than an assignment: `import.meta.env` is declared
	// readonly — by vite and by this application's own `env.d.ts` — because in a
	// build those values are substituted, not stored. Writing through a cast
	// would compile and would also be a test quietly disagreeing with the type it
	// is testing under. The stub is the supported way, and it undoes itself.
	vi.stubEnv("PUBLIC_ATLAS_API", await api.listen(0));
});

afterAll(async () => {
	vi.unstubAllEnvs();
	await api.close();
});

describe("readAtlasBoard", () => {
	it("reads the board inside a request scope", async () => {
		expect(await readAtlasBoard(new Headers())).toHaveLength(5);
	});

	it("gives every render its own instance", async () => {
		// One per process would mean the second reader answering for the first the
		// moment two of them overlap, which on a server is always.
		const [first, second] = await Promise.all([
			readAtlasBoard(new Headers()),
			readAtlasBoard(new Headers()),
		]);

		expect(first).toEqual(second);
		expect(first).not.toBe(second);
	});

	it("refuses a gateway reached with no scope around it", () => {
		// The failure IS the feature: the alternative was reading whichever
		// instance the process created last, which is another reader's.
		expect(() => lankaGateways.atlasMissionGateway).toThrow(/scope/i);
	});

	it("survives a module-level ViewModel having been declared already", async () => {
		// The island beside this file declares one when its module is evaluated,
		// and on a server that happens before any request. Creating an instance
		// then asked for an ACTIVE runtime that could not exist yet, and every
		// server render threw from inside the call creating the scope.
		await import("../../Modules/AtlasBoardModule/AtlasBoardIsland");

		expect(await readAtlasBoard(new Headers())).toHaveLength(5);
	});
});
