import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lankaDiRollup } from "./lankaDiRollup";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";

/** Rollup calls `buildStart` with a plugin context; this is the part used. */
const context = () => {
	const warnings: string[] = [];
	return { warnings, ctx: { warn: (message: string) => warnings.push(message) } };
};

describe("lankaDiRollup", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "lanka-rollup-"));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("resolves a barrel to the file on disk", () => {
		const plugin = lankaDiRollup({ root });

		expect(plugin.resolveId(`${lankaDiContract.alias}/Scenarios`)).toBe(
			`${root.replace(/\\/g, "/")}/.lanka_di/Scenarios.ts`,
		);
	});

	// Returning a path for anything else would claim imports this plugin knows
	// nothing about; `null` is rollup's "not mine, ask the next one".
	it("passes every other specifier on", () => {
		const plugin = lankaDiRollup({ root });

		expect(plugin.resolveId("lanka/gateway")).toBe(null);
		expect(plugin.resolveId("./local")).toBe(null);
	});

	it("scaffolds at build start and warns through rollup", () => {
		const { warnings, ctx } = context();
		lankaDiRollup({ root }).buildStart.call(ctx);

		expect(warnings.join("\n")).toContain("Commit these");
	});

	it("says nothing on a healthy project", () => {
		const plugin = lankaDiRollup({ root });
		plugin.buildStart.call(context().ctx);

		const { warnings, ctx } = context();
		plugin.buildStart.call(ctx);

		expect(warnings).toEqual([]);
	});

	it("fails the build when a barrel lost a required export", () => {
		mkdirSync(join(root, lankaDiContract.dirname), { recursive: true });
		writeFileSync(
			join(root, lankaDiContract.dirname, "Host.ts"),
			"export const nothing = 1;\n",
		);

		expect(() => lankaDiRollup({ root }).buildStart.call(context().ctx)).toThrow(/lankaHost/);
	});
});
