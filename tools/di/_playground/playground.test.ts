import { existsSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { lankaDiContract, lankaDiScaffoldNotice } from "../src/index";
import { requiredBarrels, startPlaygroundProject } from "./app";
import { lankaDiEsbuild } from "../src/esbuild";
import { lankaDiMetro } from "../src/metro";
import { lankaDiRollup } from "../src/rollup";
import { lankaDiTurbopack } from "../src/turbopack";
import type { ILankaEsbuildBuild } from "../src/esbuild";

/**
 * The package, used as a consumer's project uses it.
 *
 * Adoption is a sequence across a real filesystem — scaffold, verify, configure
 * — and every step below depends on the one before it. A unit can prove that a
 * file is written; only this can prove a project ends up buildable.
 */
type TProject = ReturnType<typeof startPlaygroundProject>;

let project: TProject | null = null;

afterEach(() => {
	project?.remove();
	project = null;
});

describe("the di tool playground", () => {
	it("scaffolds every barrel the contract requires", () => {
		project = startPlaygroundProject();

		const report = project.verify({ scaffold: true });

		for (const barrel of requiredBarrels()) {
			expect(project.read(`${lankaDiContract.dirname}/${barrel}`)).toBeTruthy();
			expect(report.created).toContain(`${lankaDiContract.dirname}/${barrel}`);
		}
	});

	it("writes barrels that are legal while still empty", () => {
		// A scaffolded project must boot before it has a single gateway, or
		// adopting the framework starts with a broken build.
		project = startPlaygroundProject();

		project.verify({ scaffold: true });

		expect(project.read(`${lankaDiContract.dirname}/Gateways.ts`)).toContain("export {}");
	});

	it("stamps the contract version the barrels are written for", () => {
		project = startPlaygroundProject();

		project.verify({ scaffold: true });

		expect(project.read(`${lankaDiContract.dirname}/Contract.ts`)).toContain(
			`= ${String(lankaDiContract.version)}`,
		);
	});

	it("reports nothing to do on a project already wired", () => {
		project = startPlaygroundProject();
		project.verify({ scaffold: true });

		const second = project.verify({ scaffold: true });

		expect(second.created).toEqual([]);
		expect(second.problems).toEqual([]);
	});

	it("NEVER overwrites what the consumer wrote", () => {
		// A missing file is "created"; a wrong one is a "problem". Repairing the
		// second by overwriting would destroy somebody's work.
		project = startPlaygroundProject();
		project.verify({ scaffold: true });
		const mine = "export const lankaHost = { mine: true };\n";
		project.write(`${lankaDiContract.dirname}/Host.ts`, mine);

		project.verify({ scaffold: true });

		expect(project.read(`${lankaDiContract.dirname}/Host.ts`)).toBe(mine);
	});

	it("reports a missing tsconfig mapping rather than un-typing the app", () => {
		// TypeScript's wildcard include skips dot-directories, so a missing mapping
		// does not fail — it silently un-types the one file that wires everything.
		project = startPlaygroundProject();
		project.write("tsconfig.json", '{ "compilerOptions": {} }\n');

		const report = project.verify({ scaffold: true });

		expect(report.problems.join(" ")).toContain(lankaDiContract.alias);
	});

	it("does not read a commented-out mapping as a live one", () => {
		project = startPlaygroundProject();
		project.write(
			"tsconfig.json",
			'{\n"compilerOptions": { "paths": {\n// "@lanka_di/*": [".lanka_di/*"]\n} } }\n',
		);

		const report = project.verify({ scaffold: true });

		expect(report.problems.length).toBeGreaterThan(0);
	});

	it("builds a vite plugin a config can use", () => {
		project = startPlaygroundProject();

		const plugin = project.plugin();

		expect(plugin.name).toContain("lanka");
	});

	// What a build with no adapter writes: the primitive, and the sentence the
	// six adapters say — so a consumer's own integration reports scaffolding the
	// same way theirs do rather than inventing a second phrasing.
	it("gives a bundler it has never heard of the same three lines", () => {
		project = startPlaygroundProject();
		const lanka = project.setup();

		const created = lanka.verify();

		expect(lanka.alias["@lanka_di"]).toBe(lanka.dir);
		expect(lankaDiScaffoldNotice(created)).toContain("Commit these");
		for (const barrel of requiredBarrels()) {
			expect(created.some((path) => path.endsWith(barrel))).toBe(true);
		}
	});

	// Six vocabularies, one contract. What a consumer must be able to trust is
	// that the adapter they use points at the same directory as every other — an
	// alias that differed by a bundler would be a project that builds in one and
	// not the next.
	it("every adapter points at the SAME directory", () => {
		project = startPlaygroundProject();
		const expected = project.setup().dir;

		const webpackCompiler = {
			context: project.root,
			options: {} as { resolve?: { alias?: Record<string, unknown> } },
			hooks: {
				beforeRun: { tapAsync: () => undefined },
				watchRun: { tapAsync: () => undefined },
			},
		};
		project.webpackPlugin().apply(webpackCompiler);

		const esbuildResolvers: ((args: { path: string }) => { path: string } | undefined)[] = [];
		const build: ILankaEsbuildBuild = {
			onStart: () => undefined,
			onResolve: (_options, callback) => esbuildResolvers.push(callback),
		};
		lankaDiEsbuild({ root: project.root }).setup(build);

		expect(webpackCompiler.options.resolve?.alias?.["@lanka_di"]).toBe(expected);
		expect(lankaDiTurbopack({ root: project.root }).resolveAlias["@lanka_di"]).toBe(expected);
		expect(lankaDiRollup({ root: project.root }).resolveId("@lanka_di/Gateways")).toBe(
			`${expected}/Gateways.ts`,
		);
		expect(esbuildResolvers[0]({ path: "@lanka_di/Gateways" })?.path).toBe(
			`${expected}/Gateways.ts`,
		);
		expect(
			lankaDiMetro({ projectRoot: project.root }).resolver?.extraNodeModules?.["@lanka_di"],
		).toBe(expected);
	});

	// The path being right is not the same as the path being there. The two
	// resolver-style adapters answer with a FILE, and a scaffolded project has to
	// have written it — otherwise the alias is correct and the build still says
	// "module not found".
	it("resolves the alias to a barrel that is actually on disk", () => {
		project = startPlaygroundProject();
		project.verify({ scaffold: true });

		const resolved = lankaDiRollup({ root: project.root }).resolveId("@lanka_di/Gateways");

		expect(resolved).not.toBeNull();
		expect(existsSync(resolved as string)).toBe(true);
	});

	it("answers nothing for a specifier that is not the alias", () => {
		// A resolver that claimed every import would take over the consumer's whole
		// module graph. `null` is how rollup is told "not mine".
		project = startPlaygroundProject();

		expect(lankaDiRollup({ root: project.root }).resolveId("react")).toBeNull();
	});

	// The same contract, the other bundler. What a consumer must be able to trust
	// is that neither plugin knows about the other: the verification, the
	// scaffolding and the alias are the package's root entry, and each adapter is
	// only how one bundler is told about them.
	it("builds a webpack plugin over the SAME project", () => {
		project = startPlaygroundProject();

		const compiler = {
			context: project.root,
			options: {} as { resolve?: { alias?: Record<string, unknown> } },
			hooks: {
				beforeRun: { tapAsync: (_n: string, fn: unknown) => taps.push(fn) },
				watchRun: { tapAsync: (_n: string, fn: unknown) => taps.push(fn) },
			},
		};
		const taps: unknown[] = [];

		project.webpackPlugin().apply(compiler);

		expect(compiler.options.resolve?.alias?.["@lanka_di"]).toContain(".lanka_di");
		expect(taps).toHaveLength(2);
	});
});
