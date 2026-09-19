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

/**
 * The directory each of the six adapters ends up pointing at, named.
 *
 * One reading, used by every scene that asks the question, because the answer
 * has to hold for BOTH layouts and a copy per layout is a copy that gets updated
 * for one of them. The adapter's name travels with its answer so a failure says
 * which bundler's consumer is broken, not merely that two strings differ.
 */
const everyAdapterDir = (project: TProject): [string, string | null | undefined][] => {
	const { root } = project;

	const webpackCompiler = {
		context: root,
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
	lankaDiEsbuild({ root }).setup(build);

	// The two resolver-style adapters answer with a FILE, so their answer is
	// trimmed back to the directory it names — comparing a path to a barrel
	// against a path to a directory would fail for a reason that is not the one
	// these scenes are about.
	const dirOf = (file: string | null | undefined): string | null | undefined =>
		typeof file === "string" ? file.slice(0, file.lastIndexOf("/")) : file;

	// Vite's `config` is an ObjectHook — a function OR `{ handler }` — and a scene
	// is not the place to teach that distinction. The same `any` the vite spec
	// next door uses, for the same reason: what is under test is which directory
	// comes back, not vite's hook union.
	const viteConfig = (project.plugin() as any).config(
		{ root },
		{ command: "build", mode: "test" },
	) as { resolve: { alias: Record<string, string> } };

	return [
		["vite", viteConfig.resolve.alias["@lanka_di"]],
		["webpack", webpackCompiler.options.resolve?.alias?.["@lanka_di"] as string | undefined],
		["turbopack", lankaDiTurbopack({ root }).resolveAlias["@lanka_di"]],
		["rollup", dirOf(lankaDiRollup({ root }).resolveId("@lanka_di/Gateways"))],
		["esbuild", dirOf(esbuildResolvers[0]({ path: "@lanka_di/Gateways" })?.path)],
		["metro", lankaDiMetro({ projectRoot: root }).resolver?.extraNodeModules?.["@lanka_di"]],
	];
};

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

		for (const [adapter, resolved] of everyAdapterDir(project)) {
			expect([adapter, resolved]).toEqual([adapter, expected]);
		}
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

		expect(compiler.options.resolve?.alias?.["@lanka_di"]).toContain(lankaDiContract.dirname);
		expect(taps).toHaveLength(2);
	});
});

/**
 * The consumer who adopted the framework before `.lanka` existed.
 *
 * Everything above is a new project. This is the other kind, and the promise
 * made to them is stronger than "it still works": they must not be able to tell
 * that a second layout was ever admitted, unless they go looking for it.
 */
describe("a project on the earlier directory", () => {
	it("is wired exactly as well, with no warning and nothing to do", () => {
		project = startPlaygroundProject({ dirname: ".lanka_di" });

		const report = project.verify({ scaffold: true });

		expect(report.dirname).toBe(".lanka_di");
		expect(report.problems).toEqual([]);
		for (const barrel of requiredBarrels()) {
			expect(project.read(`.lanka_di/${barrel}`)).toBeTruthy();
		}
	});

	// The upgrade that must be a no-op. A plugin that read the new DEFAULT here
	// would scaffold an empty `.lanka` beside the working `.lanka_di` and start
	// the application against the empty one — with no error anywhere, because
	// both directories type-check.
	it("keeps its own directory when the plugin runs, rather than getting the new default", () => {
		project = startPlaygroundProject({ dirname: ".lanka_di" });
		project.verify({ scaffold: true });

		const setup = project.setup();

		expect(setup.dirname).toBe(".lanka_di");
		expect(setup.dir.endsWith("/.lanka_di")).toBe(true);
		expect(project.read(".lanka/Gateways.ts")).toBeNull();
	});

	// The compatibility claim is about the PACKAGE, not about one entry point.
	// `lankaDiSetup` resolving correctly proves nothing for a consumer whose
	// build is Metro: an adapter that read the default would alias a directory
	// that is not there, and the app would fail to resolve its own wiring.
	it("is aliased to its own directory by every one of the six adapters", () => {
		project = startPlaygroundProject({ dirname: ".lanka_di" });
		project.verify({ scaffold: true });
		const expected = project.setup().dir;

		expect(expected.endsWith("/.lanka_di")).toBe(true);
		for (const [adapter, resolved] of everyAdapterDir(project)) {
			expect([adapter, resolved]).toEqual([adapter, expected]);
		}
	});

	it("says where it is when asked, and only when asked", () => {
		project = startPlaygroundProject({ dirname: ".lanka_di" });
		project.verify({ scaffold: true });

		expect(project.where().dirname).toBe(".lanka_di");
		expect(project.cli("where").out.trim()).toBe(".lanka_di/");
	});
});

/**
 * The move, end to end, as a person runs it.
 *
 * Three steps and two of them are invisible: a stale `paths` mapping and a stale
 * `include` do not fail, they leave the one file that wires the whole
 * application with no types. So the scene does not assert the steps — it asserts
 * that the project the migration leaves behind is one the verifier has nothing
 * to say about, which is the only claim worth making.
 */
describe("migrating between the two directories", () => {
	it("rehearses first, and changes nothing while rehearsing", () => {
		project = startPlaygroundProject({ dirname: ".lanka_di" });
		project.verify({ scaffold: true });

		const planned = project.cli("migrate", "--dry-run");

		expect(planned.code).toBe(0);
		expect(planned.out).toContain(".lanka_di/ → .lanka/");
		expect(project.read(".lanka_di/Host.ts")).toBeTruthy();
		expect(project.read(".lanka/Host.ts")).toBeNull();
	});

	it("leaves a project the build has nothing to say about", () => {
		project = startPlaygroundProject({ dirname: ".lanka_di" });
		project.verify({ scaffold: true });

		const run = project.cli("migrate");

		expect(run.code).toBe(0);
		expect(project.read(".lanka/Host.ts")).toBeTruthy();
		expect(project.verify({ scaffold: false }).problems).toEqual([]);
		expect(project.setup().dirname).toBe(".lanka");
	});

	it("carries the tsconfig with it, which is the half that does not fail", () => {
		project = startPlaygroundProject({ dirname: ".lanka_di" });
		project.verify({ scaffold: true });

		project.migrate({ to: ".lanka" });

		const tsconfig = project.read("tsconfig.json") ?? "";
		expect(tsconfig).toContain('"@lanka_di/*": [".lanka/*"]');
		expect(tsconfig).toContain('".lanka/**/*"');
	});

	// `.lanka_di` is an alternative, not a deprecation. A team that prefers the
	// explicit name is as well served, and gets there by the same command.
	it("goes back the other way just as readily", () => {
		project = startPlaygroundProject();
		project.verify({ scaffold: true });

		const run = project.cli("migrate", "--to", ".lanka_di");

		expect(run.code).toBe(0);
		expect(project.read(".lanka_di/Host.ts")).toBeTruthy();
		expect(project.verify({ scaffold: false, dirname: ".lanka_di" }).problems).toEqual([]);
	});
});
