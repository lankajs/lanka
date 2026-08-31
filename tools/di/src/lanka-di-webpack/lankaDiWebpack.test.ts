import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lankaDiWebpack } from "./lankaDiWebpack";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import type { ILankaWebpackCompiler, TLankaWebpackHook } from "./lankaDiWebpack";

/** A compiler that records instead of compiling. */
const fakeCompiler = (context?: string) => {
	const taps: { name: string; hook: TLankaWebpackHook }[] = [];
	const warnings: string[] = [];

	const compiler: ILankaWebpackCompiler & {
		taps: typeof taps;
		warnings: typeof warnings;
	} = {
		taps,
		warnings,
		context,
		options: {},
		hooks: {
			beforeRun: { tapAsync: (name, hook) => taps.push({ name, hook }) },
			watchRun: { tapAsync: (name, hook) => taps.push({ name, hook }) },
		},
		getInfrastructureLogger: () => ({ warn: (message) => warnings.push(message) }),
	};

	return compiler;
};

/** Runs the first tapped hook and answers what webpack would have been given. */
const run = (compiler: ReturnType<typeof fakeCompiler>, at = 0): Error | undefined => {
	let failure: Error | undefined;
	compiler.taps[at].hook(compiler, (error) => {
		failure = error;
	});
	return failure;
};

describe("lankaDiWebpack", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "lanka-webpack-"));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("sets the alias on the compiler's resolve options", () => {
		const compiler = fakeCompiler(root);

		lankaDiWebpack().apply(compiler);

		expect(compiler.options.resolve?.alias?.[lankaDiContract.alias]).toBe(
			`${root.replace(/\\/g, "/")}/${lankaDiContract.dirname}`,
		);
	});

	// A consumer may already have aliases; replacing the map would remove them and
	// the failure arrives as "module not found" for something unrelated.
	it("keeps aliases the project already had", () => {
		const compiler = fakeCompiler(root);
		compiler.options.resolve = { alias: { "@app": "/somewhere" } };

		lankaDiWebpack().apply(compiler);

		expect(compiler.options.resolve.alias?.["@app"]).toBe("/somewhere");
	});

	it("prefers an explicit root over the compiler's context", () => {
		const compiler = fakeCompiler("/ignored");

		lankaDiWebpack({ root }).apply(compiler);

		expect(compiler.options.resolve?.alias?.[lankaDiContract.alias]).toContain(
			root.replace(/\\/g, "/"),
		);
	});

	it("taps both the run and the watch hook", () => {
		const compiler = fakeCompiler(root);

		lankaDiWebpack().apply(compiler);

		expect(compiler.taps).toHaveLength(2);
		expect(compiler.taps.every((tap) => tap.name === "lanka:di")).toBe(true);
	});

	it("scaffolds the barrels and says they are to be committed", () => {
		const compiler = fakeCompiler(root);
		lankaDiWebpack({ root }).apply(compiler);

		expect(run(compiler)).toBeUndefined();

		expect(existsSync(join(root, lankaDiContract.dirname, "Gateways.ts"))).toBe(true);
		expect(compiler.warnings.join("\n")).toContain("Commit these");
	});

	// The whole point of the plugin: a barrel that no longer exports what the
	// framework calls by name fails the BUILD, not a screen at runtime.
	it("fails the build when a barrel lost a required export", () => {
		mkdirSync(join(root, lankaDiContract.dirname), { recursive: true });
		writeFileSync(
			join(root, lankaDiContract.dirname, "Host.ts"),
			"export const nothing = 1;\n",
		);

		const compiler = fakeCompiler(root);
		lankaDiWebpack({ root }).apply(compiler);

		const failure = run(compiler);

		expect(failure).toBeInstanceOf(Error);
		expect(failure?.message).toContain("lankaHost");
	});

	it("refuses to scaffold when told not to", () => {
		const compiler = fakeCompiler(root);
		lankaDiWebpack({ root, scaffold: false }).apply(compiler);

		expect(run(compiler)).toBeInstanceOf(Error);
		expect(existsSync(join(root, lankaDiContract.dirname, "Gateways.ts"))).toBe(false);
	});

	// A watch rebuild must not read six files again to learn what it learnt a
	// second ago — and must not report the same scaffolding twice.
	it("verifies once per process, however many times a hook fires", () => {
		const compiler = fakeCompiler(root);
		lankaDiWebpack({ root }).apply(compiler);

		run(compiler, 0);
		run(compiler, 1);
		run(compiler, 0);

		expect(compiler.warnings).toHaveLength(1);
	});

	it("works for a compiler with no infrastructure logger", () => {
		const compiler = fakeCompiler(root);
		compiler.getInfrastructureLogger = undefined;
		lankaDiWebpack({ root }).apply(compiler);

		expect(() => run(compiler)).not.toThrow();
	});

	it("falls back to the working directory when nothing says otherwise", () => {
		const cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
		const compiler = fakeCompiler(undefined);

		lankaDiWebpack().apply(compiler);

		expect(compiler.options.resolve?.alias?.[lankaDiContract.alias]).toContain(
			root.replace(/\\/g, "/"),
		);
		cwd.mockRestore();
	});
});
