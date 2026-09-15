// @vitest-environment node
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { lankaGateways } from "lanka/locator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readAtlasMissions } from "./readAtlasMissions";
import type { IAtlasServer } from "@lanka-playgrounds/_server";

/**
 * The server half, against the real API.
 *
 * Node, not jsdom, for the reason the browser application's live suite states in
 * full — and here it is not even a compromise: this code only ever runs in node.
 */
let api: IAtlasServer;

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	const base = await api.listen(0);
	process.env.NEXT_PUBLIC_ATLAS_API = base;
});

afterAll(async () => {
	await api.close();
	delete process.env.NEXT_PUBLIC_ATLAS_API;
});

describe("readAtlasMissions", () => {
	it("reads the board through a gateway resolved by name", async () => {
		// By NAME, out of this application's own `.lanka_di` barrels — which is
		// what makes the barrels part of what this test covers.
		const missions = await readAtlasMissions(new Headers());

		expect(missions).toHaveLength(5);
	});

	it("gives two overlapping requests two instances", async () => {
		// One per process would mean the second request answering for the first the
		// moment they overlap — which on a server is always.
		const seen: unknown[] = [];
		const remember = async () => {
			await readAtlasMissions(new Headers());
			seen.push(lankaGateways);
		};

		await Promise.all([remember(), remember()]);

		expect(seen).toHaveLength(2);
	});

	it("refuses a gateway reached with no scope around it", () => {
		// The failure IS the feature, and it arrives SYNCHRONOUSLY — on the
		// property access rather than on the call. The alternative was reading
		// whichever instance the process created last, which is another user's.
		expect(() => lankaGateways.atlasMissionGateway).toThrow(/scope/i);
	});

	it("carries the caller's identity into the API call", async () => {
		// Without it a page renders signed out and then flips signed in when the
		// browser fetches with the cookie it always had — and nothing errors.
		const opened = await fetch(`${process.env.NEXT_PUBLIC_ATLAS_API ?? ""}/session`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "Ada" }),
		});
		const session = (await opened.json()) as { token: string };

		const who = await readAtlasMissions(
			new Headers({ authorization: `Bearer ${session.token}` }),
		).then(() =>
			fetch(`${process.env.NEXT_PUBLIC_ATLAS_API ?? ""}/me`, {
				headers: { authorization: `Bearer ${session.token}` },
			}),
		);

		expect(who.status).toBe(200);
	});
});
