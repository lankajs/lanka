import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { build, version } from "vite";
import { lankaDiVite } from "@lankajs/tool-di/vite";
import type { Rollup } from "vite";

/**
 * `@lankajs/tool-di`'s Vite adapter, in a real Vite 8 build.
 *
 * The adapter imports nothing from Vite at run time — only its `Plugin` type —
 * so what could break on a new major is the hooks it relies on: `config` to
 * return the alias, `buildStart` to scaffold and verify the barrels. This builds
 * an application that loads lanka and reads its own `Host` barrel, with the
 * barrels in a temporary directory so the build writes nothing into this
 * repository.
 *
 * Two assertions, because either alone passes without the adapter: Vite 8 in
 * library mode leaves an unresolved `@lanka_di/…` import EXTERNAL rather than
 * failing, so the output must carry no such import — every barrel bundled — and
 * the barrels must exist in the temporary directory, which only the adapter's
 * `buildStart` scaffold puts there.
 */
describe("tool-di under Vite 8", () => {
	it("builds with the installed major", () => {
		expect(version.split(".")[0]).toBe("8");
	});

	it("wires @lanka_di into a real build of an application that loads lanka", async () => {
		const barrels = mkdtempSync(join(tmpdir(), "lanka-vite8-"));

		try {
			const result = await build({
				configFile: false,
				root: process.cwd(),
				logLevel: "silent",
				plugins: [lankaDiVite({ root: barrels })],
				build: {
					write: false,
					lib: {
						entry: "src/_build/application.ts",
						formats: ["es"],
						fileName: "application",
					},
				},
			});
			const [output] = (Array.isArray(result) ? result : [result]) as Rollup.RollupOutput[];
			const code = output.output
				.map((file) => (file.type === "chunk" ? file.code : ""))
				.join("\n");

			expect(code).not.toMatch(/["']@lanka_di\//);
			expect(readdirSync(join(barrels, ".lanka")).sort()).toContain("Host.ts");
			expect(existsSync(join(barrels, ".lanka", "Gateways.ts"))).toBe(true);
		} finally {
			rmSync(barrels, { recursive: true, force: true });
		}
	});
});
