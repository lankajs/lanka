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

	it("puts the alias where Metro resolves module names from", () => {
		const config = lankaDiMetro({ projectRoot: root });

		expect(config.resolver?.extraNodeModules?.[lankaDiContract.alias]).toBe(
			`${root.replace(/\\/g, "/")}/.lanka_di`,
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
