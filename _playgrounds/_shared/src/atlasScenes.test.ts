import { describe, expect, it } from "vitest";
import {
	ASTRO_ISLAND_BINDINGS,
	ASTRO_ISLAND_EXCLUSIONS,
	ATLAS_HOST_SCENES,
	ATLAS_ISLAND_SCENES,
	ATLAS_SPA_SCENES,
} from "./atlasScenes";

/**
 * The scene lists, checked from the TypeScript side.
 *
 * `scripts/check-playgrounds.mjs` reads this file as TEXT, because a gate in
 * plain node cannot import TypeScript from a workspace consumed from source.
 * That parser has been wrong once already — it matched the bracket in
 * `readonly string[]` and reported success over four applications it never read
 * — so the lists are also asserted here, where they are values rather than
 * characters.
 *
 * Between the two: the gate proves the applications say what the lists name,
 * and this file proves the lists say anything at all.
 */
describe("the scene lists", () => {
	it.each([
		["ATLAS_SPA_SCENES", ATLAS_SPA_SCENES],
		["ATLAS_HOST_SCENES", ATLAS_HOST_SCENES],
		["ATLAS_ISLAND_SCENES", ATLAS_ISLAND_SCENES],
	])("%s names at least one claim", (_name, list) => {
		// An empty list satisfies every contract silently, which is how a gate
		// reports success over work nobody did.
		expect(list.length).toBeGreaterThan(0);
	});

	it("names each claim once", () => {
		// A duplicated title is a claim counted twice and checked once, and it
		// reads as a longer contract than the one being enforced.
		const all = [...ATLAS_SPA_SCENES, ...ATLAS_HOST_SCENES, ...ATLAS_ISLAND_SCENES];

		expect(new Set(all).size).toBe(all.length);
	});

	it("keeps titles that a suite can carry verbatim", () => {
		// The gate matches exactly, so a title with a newline or a stray tab in it
		// would be a scene no application could ever satisfy.
		for (const title of [...ATLAS_SPA_SCENES, ...ATLAS_HOST_SCENES, ...ATLAS_ISLAND_SCENES]) {
			expect(title).toBe(title.trim());
			expect(title).not.toContain("\n");
		}
	});
});

describe("which bindings have an Astro island", () => {
	it("accounts for each binding once, as an island or as an exclusion", () => {
		const excluded = Object.keys(ASTRO_ISLAND_EXCLUSIONS);

		expect(ASTRO_ISLAND_BINDINGS.some((one) => excluded.includes(one))).toBe(false);
	});

	it("gives every exclusion a reason long enough to be one", () => {
		// A one-word reason is a reason nobody wrote. The absence of an island is a
		// DECISION, and the next person to read this list is the one it is for.
		for (const reason of Object.values(ASTRO_ISLAND_EXCLUSIONS)) {
			expect(reason.length).toBeGreaterThan(40);
		}
	});
});
