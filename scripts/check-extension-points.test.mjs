/**
 * Pins `check-extension-points.mjs`: what it calls a divergence.
 *
 * The declaration and the scan are driven directly, because the subject is the
 * comparison between them. Running the real script against the real repository
 * would only prove today's answer.
 */
import { describe, expect, it } from "vitest";
import { divergences, EXTENSION_POINTS, pluginSources } from "./check-extension-points.mjs";

const point = (occupants) => [{ name: "aDoor", what: "a door", call: /\.aDoor\s*\(/, occupants }];

describe("comparing the declaration with the code", () => {
	it("says nothing when they agree", () => {
		const sources = new Map([["plugins/one", "lanka.aDoor(() => 1);"]]);

		expect(divergences(point(["plugins/one"]), sources)).toEqual([]);
	});

	it("names a plugin using a door it is not listed against", () => {
		const sources = new Map([
			["plugins/one", "lanka.aDoor(() => 1);"],
			["plugins/two", "lanka.aDoor(() => 2);"],
		]);

		const found = divergences(point(["plugins/one"]), sources);

		// An undocumented hook is load-bearing before anyone decides it should be.
		expect(found).toHaveLength(1);
		expect(found[0].tag).toBe("undeclared-occupant");
		expect(found[0].where).toContain("plugins/two");
	});

	it("names an occupant that stopped using its door", () => {
		const sources = new Map([["plugins/one", "nothing here"]]);

		const found = divergences(point(["plugins/one"]), sources);

		// Either the plugin stopped needing the door, or the call was renamed and
		// the list stopped seeing it. Both are worth a look.
		expect(found).toHaveLength(1);
		expect(found[0].tag).toBe("absent-occupant");
	});

	it("refuses a door nobody walks through", () => {
		const found = divergences(point([]), new Map());

		expect(found.map((p) => p.tag)).toContain("point-without-occupant");
	});
});

describe("the repository's own five", () => {
	it("agree with what the plugins do", () => {
		expect(divergences(EXTENSION_POINTS, pluginSources())).toEqual([]);
	});

	it("are five, and each says what it is for", () => {
		expect(EXTENSION_POINTS).toHaveLength(5);
		for (const entry of EXTENSION_POINTS) {
			expect(entry.what.length, entry.name).toBeGreaterThan(20);
			expect(entry.occupants.length, entry.name).toBeGreaterThan(0);
		}
	});
});
