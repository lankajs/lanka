import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lankaDiMetro } from "./lankaDiMetro";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";

describe("lankaDiMetro", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "lanka-metro-"));
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	/*
	 * Metro's resolver is keyed by PACKAGE NAME, and a name starting with `@` is
	 * a SCOPE: `metro-resolver`'s `parseBareSpecifier` reads
	 * `@lanka_di/Gateways` as ONE package name with no subpath, never as
	 * `@lanka_di` plus `Gateways`. So the single entry every other bundler takes
	 * is filed under a key Metro never looks up, and every barrel import fails
	 * with "Unable to resolve module" — an alias that silently does nothing.
	 *
	 * Verified against metro-resolver 0.83.3: `{ "@lanka_di": dir }` throws
	 * `FailedToResolveNameError`, `{ "@lanka_di/Gateways": dir + "/Gateways" }`
	 * resolves to `.lanka/Gateways.ts`.
	 */
	it("registers every barrel under its own full specifier, which is what Metro looks up", () => {
		const config = lankaDiMetro({ projectRoot: root });
		const dir = `${root.replace(/\\/g, "/")}/${lankaDiContract.dirname}`;

		for (const { file } of lankaDiContract.barrels) {
			const name = file.replace(/\.ts$/, "");

			expect(config.resolver.extraNodeModules[`${lankaDiContract.alias}/${name}`]).toBe(
				`${dir}/${name}`,
			);
		}
	});

	it("puts the alias where Metro resolves module names from", () => {
		const config = lankaDiMetro({ projectRoot: root });

		expect(config.resolver?.extraNodeModules?.[lankaDiContract.alias]).toBe(
			`${root.replace(/\\/g, "/")}/${lankaDiContract.dirname}`,
		);
	});

	it("takes the root Metro already knows, without being told twice", () => {
		const config = lankaDiMetro({ projectRoot: root }, {});

		expect(config.resolver?.extraNodeModules?.[lankaDiContract.alias]).toContain(
			root.replace(/\\/g, "/"),
		);
	});

	// Expo's default config and every other wrapper in a React Native project
	// write here too. A spread that replaced the map would break resolution for
	// packages this adapter has never heard of.
	it("KEEPS what other wrappers put in extraNodeModules", () => {
		const config = lankaDiMetro({
			projectRoot: root,
			resolver: { extraNodeModules: { "@shared": "/somewhere/shared" } },
		});

		expect(config.resolver?.extraNodeModules?.["@shared"]).toBe("/somewhere/shared");
	});

	it("keeps the rest of the config, including what this adapter knows nothing about", () => {
		const config = lankaDiMetro({ projectRoot: root, transformer: { minify: false } });

		expect(config.transformer.minify).toBe(false);
	});

	it("verifies at config time, before Metro has done anything", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		lankaDiMetro({ projectRoot: root });

		expect(warn.mock.calls[0][0]).toContain("Commit these");
	});

	it("throws out of the config when a barrel lost a required export", () => {
		mkdirSync(join(root, lankaDiContract.dirname), { recursive: true });
		writeFileSync(
			join(root, lankaDiContract.dirname, "Host.ts"),
			"export const nothing = 1;\n",
		);

		expect(() => lankaDiMetro({ projectRoot: root })).toThrow(/lankaHost/);
	});

	it("is quiet on a healthy project", () => {
		lankaDiMetro({ projectRoot: root });

		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		lankaDiMetro({ projectRoot: root });

		expect(warn).not.toHaveBeenCalled();
	});
});
