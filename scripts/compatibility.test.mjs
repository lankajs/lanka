import { describe, expect, it } from "vitest";
import { PACKAGES, pkgName } from "./registry.mjs";
import {
	clientEntries,
	entriesThatDiffer,
	frameworkOf,
	lankaRelation,
	pageGlobalsOf,
	peersOf,
	renderCompatibility,
	runtimeGroups,
} from "./compatibility.mjs";

/**
 * The compatibility document's derivations, against the repository as it is.
 *
 * Each scene names a package whose answer is known and would be wrong if the
 * derivation stopped reading what it claims to read: a relation taken from the
 * registry instead of the manifest, a client boundary assumed instead of read, a
 * page global missed because the pattern drifted from the code.
 */

const byName = (name) => {
	const found = PACKAGES.find((p) => pkgName(p) === name);
	if (!found) throw new Error(`no package ${name}`);
	return found;
};

describe("compatibility derivations", () => {
	it("reads how each package reaches lanka from its manifest", () => {
		expect(lankaRelation(byName("lanka"))).toBe("is lanka");
		expect(lankaRelation(byName("@lankajs/plugin-relay"))).toBe("peer");
		expect(lankaRelation(byName("@lankajs/host"))).toBe("dependency");
		expect(lankaRelation(byName("@lankajs/collection"))).toBe("none");
	});

	it("names the subpath whose environments differ from its package's", () => {
		expect(entriesThatDiffer(byName("@lankajs/host"))).toEqual([
			{ subpath: "./server", runtimes: ["node"] },
		]);
		expect(entriesThatDiffer(byName("lanka"))).toEqual([]);
	});

	it("reads the client boundary from the entry files, not from the framework", () => {
		expect(clientEntries(byName("@lankajs/react"))).toContain(".");
		expect(clientEntries(byName("@lankajs/vue"))).toEqual([]);
		expect(clientEntries(byName("lanka"))).toEqual([]);
	});

	it("finds the files that write to the page's global object", () => {
		expect(pageGlobalsOf(byName("@lankajs/plugin-relay"))).toEqual([
			"plugins/relay/src/_internal/lanka-relay-channels/lankaRelayChannels.ts",
		]);
		expect(pageGlobalsOf(byName("lanka"))).toContain(
			"core/src/_internal/active-runtime/lankaCopies.ts",
		);
		expect(pageGlobalsOf(byName("@lankajs/collection"))).toEqual([]);
	});

	it("takes a binding's framework range from its peer, including a scoped framework", () => {
		expect(frameworkOf(byName("@lankajs/angular"))).toEqual({
			label: "Angular",
			peer: "@angular/core ^20.0.0 || ^21.0.0 || ^22.0.0",
		});
		expect(frameworkOf(byName("@lankajs/zod"))).toBeNull();
	});

	it("separates required peers from optional ones", () => {
		expect(peersOf(byName("@lankajs/react"))).toEqual({
			required: ["react ^19.2.0"],
			optional: ["@testing-library/react ^16.3.0"],
		});
	});

	it("places every package in exactly one runtime group, whatever combination it declares", () => {
		// The groups are the combinations that EXIST, not a list written once: a
		// package declaring a combination nobody had declared before must still
		// appear, and it did not when the groups were five hard-coded lines.
		const grouped = runtimeGroups().flatMap((group) => group.packages);

		expect(grouped.map(pkgName).sort()).toEqual(PACKAGES.map(pkgName).sort());
		expect(runtimeGroups().every((group) => group.packages.length > 0)).toBe(true);
	});

	it("gives every package exactly one row", () => {
		const text = renderCompatibility();

		for (const p of PACKAGES) {
			const rows = text
				.split("\n")
				.filter((line) => line.startsWith(`| [\`${pkgName(p)}\`]`) && line.includes("| "));
			// One in the main table, and a second only for a binding's own table.
			expect(rows.length).toBe(p.framework ? 2 : 1);
		}
	});
});
