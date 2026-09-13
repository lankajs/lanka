// @vitest-environment node
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { runLankaStatic } from "@lankajs/host/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prerenderAtlasMissions } from "./prerenderAtlasMissions";
import type { IAtlasServer } from "@lanka-playgrounds/_server";

let api: IAtlasServer;

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	process.env.NEXT_PUBLIC_ATLAS_API = await api.listen(0);
});

afterAll(async () => {
	await api.close();
	delete process.env.NEXT_PUBLIC_ATLAS_API;
});

describe("prerenderAtlasMissions", () => {
	it("reads the board for output that will be shared by everybody", async () => {
		expect(await prerenderAtlasMissions()).toHaveLength(5);
	});

	it("REFUSES a caller's identity, which is the only difference from the request call", async () => {
		// A cookie forwarded during a build bakes one reader's data into a file
		// served to everyone — and the build succeeds, and the page looks right to
		// whoever ran it. So it is refused in the types, and again here.
		await expect(
			runLankaStatic(
				// @ts-expect-error — `headers` is not part of the static config, on
				// purpose. The directive sits on the ARGUMENT rather than on the call:
				// it suppresses the next line only, and a formatter that rewraps the
				// call would otherwise move the error out from under it — leaving an
				// unused directive and an unchecked line, both reported as an error by
				// `--noUnusedLocals`-adjacent checking rather than silently.
				{ apiBaseUrl: process.env.NEXT_PUBLIC_ATLAS_API, headers: new Headers() },
				() => Promise.resolve("built"),
			),
		).rejects.toThrow();
	});

	it("answers one id per mission, which is what a route's params are", async () => {
		const missions = await prerenderAtlasMissions();

		expect(missions.map((mission) => mission.id)).toContain("m-1");
	});
});
