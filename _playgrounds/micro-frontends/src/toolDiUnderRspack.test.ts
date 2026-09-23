import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `@lankajs/tool-di`'s webpack plugin, handed to Rspack unchanged.
 *
 * Its GUIDE says Rspack takes the plugin as it is — the object is the same shape
 * and describes only what it touches. The Rspack pipeline is the evidence: it
 * wires `@lanka_di` through the plugin rather than the test kit's alias, into a
 * barrel root it empties before building. Two things are read off what the build
 * left behind, because each alone could pass without the plugin:
 *
 * - the barrels exist in that root, which only the plugin's scaffold writes;
 * - a bundle that CARRIES lanka — and so reaches every barrel through it —
 *   imports none of them: each was resolved and bundled. An alias that never
 *   reached the resolver would have failed the build instead, in `globalSetup`.
 *
 * Paths from the working directory, which is this application's root: under
 * jsdom `import.meta.url` is not a file URL.
 */
const RSPACK = join(process.cwd(), "dist", "rspack");

describe("tool-di's webpack plugin under Rspack", () => {
	it("scaffolded every barrel into the root the build emptied first", () => {
		expect(readdirSync(join(RSPACK, "barrels", ".lanka")).sort()).toEqual([
			"Contract.ts",
			"Gateways.ts",
			"Host.ts",
			"Scenarios.ts",
			"SharedStores.ts",
			"Singletons.ts",
		]);
	});

	it.each(["react-isolated", "missions-react"])(
		"left no @lanka_di import in %s, which carries its own lanka",
		(name) => {
			const code = readFileSync(join(RSPACK, "own-lanka", `${name}.js`), "utf8");

			expect(code).not.toMatch(/(?:import|from)\s*["']@lanka_di\//);
		},
	);
});
