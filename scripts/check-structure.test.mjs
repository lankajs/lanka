/**
 * Pins `check-structure.mjs`: one test per rule, plus the tree it must accept.
 *
 * A guard nothing exercises is a guard that reports success. Each test spawns
 * the real script against a temporary git repository — rules 7 and 8 read git,
 * which a Windows filesystem cannot answer for — and asserts the exit code and
 * the rule tag, because those are what a contributor acts on.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/check-structure.mjs");

let root = null;

const write = (relativePath, content) => {
	const path = join(root, relativePath);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
};

const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "ignore" });

/** The smallest tree the script accepts: four roots, one clean unit, a playground. */
const makeTree = (files = {}) => {
	root = mkdtempSync(join(tmpdir(), "lanka-check-structure-"));

	for (const dir of ["core/src", "modules", "plugins", "tools"]) {
		mkdirSync(join(root, dir), { recursive: true });
	}
	for (const dir of ["modules", "plugins", "tools"]) write(`${dir}/.gitkeep`, "");

	write("core/src/index.ts", 'export { LankaThing } from "./lanka-thing/LankaThing";\n');
	write("core/src/lanka-thing/LankaThing.ts", "export class LankaThing {}\n");
	write("core/src/lanka-thing/LankaThing.test.ts", "export const covered = true;\n");

	// Rule 9 is part of the canon, so the tree the guard must ACCEPT has one.
	// A fixture missing what the canon requires makes every other assertion here
	// read a failure that has nothing to do with the rule under test.
	write(
		"core/_playground/app.ts",
		'export { startPlayground } from "./start-playground/startPlayground";\n',
	);
	write(
		"core/_playground/start-playground/startPlayground.ts",
		"export const startPlayground = () => undefined;\n",
	);
	write("core/_playground/playground.test.ts", "export const exercised = true;\n");

	for (const [path, content] of Object.entries(files)) write(path, content);

	git("init", "--quiet");
	git("add", "-A");
	return root;
};

const runGuard = () => {
	try {
		const stdout = execFileSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
		return { code: 0, output: stdout };
	} catch (error) {
		return { code: error.status, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
	}
};

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
	root = null;
});

describe("check-structure", () => {
	it("passes a tree that follows the canon", () => {
		makeTree();

		const result = runGuard();

		expect(result.code).toBe(0);
		expect(result.output).toContain("follows the canon");
	});

	it("rule 1: rejects two runtime exports in one file", () => {
		makeTree({
			"core/src/lanka-thing/LankaThing.ts":
				"export class LankaThing {}\nexport const lankaOther = 1;\n",
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[one-runtime-export]");
	});

	it("rule 1: ignores an export inside a template literal", () => {
		// A scaffolder writes source into a file it creates. Counting that as its
		// own export made the checker demand a split of a file with one export.
		makeTree({
			"core/src/lanka-thing/LankaThing.ts":
				"export class LankaThing {\n\tstub = `export const lankaStub = 1;`;\n}\n",
		});

		expect(runGuard().code).toBe(0);
	});

	it("rule 2: rejects a type no declaration in the file references", () => {
		makeTree({
			"core/src/lanka-thing/LankaThing.ts":
				"export type TLankaStray = string;\nexport class LankaThing {}\n",
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[orphan-type]");
	});

	it("rule 2: accepts a type DERIVED from the file's runtime export", () => {
		// Ownership runs the other way here: nothing names the type, but the type
		// names the export.
		makeTree({
			"core/src/lanka-thing/LankaThing.ts":
				"export const LANKA_KINDS = { A: 'a' } as const;\n" +
				"export type TLankaKind = (typeof LANKA_KINDS)[keyof typeof LANKA_KINDS];\n",
			"core/src/lanka-thing/LankaThing.test.ts": "export const covered = true;\n",
		});

		expect(runGuard().code).toBe(0);
	});

	it("rule 3: rejects a barrel that declares anything", () => {
		makeTree({ "core/src/index.ts": "export const lankaInline = 1;\n" });

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[barrel-declares]");
	});

	it("rule 4: rejects two tested units in one directory", () => {
		makeTree({
			"core/src/pair/LankaFirst.ts": "export class LankaFirst {}\n",
			"core/src/pair/LankaFirst.test.ts": "export const a = 1;\n",
			"core/src/pair/LankaSecond.ts": "export class LankaSecond {}\n",
			"core/src/pair/LankaSecond.test.ts": "export const b = 1;\n",
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[flat-tested-units]");
	});

	it("rule 5: rejects a test with no unit of its name", () => {
		makeTree({ "core/src/lanka-thing/somethingElse.test.ts": "export const a = 1;\n" });

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[orphan-test]");
	});

	it("rule 6: rejects a folder holding only one folder", () => {
		makeTree({
			"core/src/wrapper/lanka-inner/LankaInner.ts": "export class LankaInner {}\n",
			"core/src/wrapper/lanka-inner/LankaInner.test.ts": "export const a = 1;\n",
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[wrapper-folder]");
	});

	it("rule 7: rejects a bucket name without the underscore", () => {
		makeTree({ "core/src/types/TLankaThing.ts": "export type TLankaThing = string;\n" });

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[bucket-without-underscore]");
	});

	it("rule 7: rejects the underscore on a name that is not a bucket", () => {
		makeTree({ "core/src/_gateway/LankaGateway.ts": "export class LankaGateway {}\n" });

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[underscore-without-bucket]");
	});

	it("rule 7: accepts a marked bucket", () => {
		makeTree({ "core/src/_types/TLankaThing.ts": "export type TLankaThing = string;\n" });

		expect(runGuard().code).toBe(0);
	});

	it("rule 8: rejects a tested unit sitting outside its own folder", () => {
		makeTree({
			"core/src/loose/LankaLoose.ts": "export class LankaLoose {}\n",
			"core/src/loose/LankaLoose.test.ts": "export const a = 1;\n",
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[unit-outside-folder]");
	});

	it("rejects a protected member on a class not designed for inheritance", () => {
		makeTree({
			"core/src/lanka-seam/LankaSeam.ts":
				"export class LankaSeam {\n\tprotected seam = 1;\n}\n",
			"core/src/lanka-seam/LankaSeam.test.ts": "export const covered = true;\n",
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[inheritance-not-declared]");
	});

	it("accepts a protected member on an A-prefixed base", () => {
		makeTree({
			// In its bucket, as rule 9 asks: the prefix is the promise, and
			// `_abstractions/` is where a reader goes looking for the promises.
			"core/src/_abstractions/lanka-seam/ALankaSeam.ts":
				"export abstract class ALankaSeam {\n\tprotected seam = 1;\n}\n",
			"core/src/_abstractions/lanka-seam/ALankaSeam.test.ts":
				"export const covered = true;\n",
			"core/src/index.ts":
				'export { LankaThing } from "./lanka-thing/LankaThing";\nexport { ALankaSeam } from "./_abstractions/lanka-seam/ALankaSeam";\n',
		});

		// The prefix is the promise: a subclass may see it, and the class says so.
		expect(runGuard().code).toBe(0);
	});

	it("accepts an override that keeps a designed base's visibility", () => {
		makeTree({
			"core/src/lanka-seam/LankaSeam.ts":
				"export class LankaSeam extends ALankaSeam {\n\tprotected seam = 2;\n}\n",
			"core/src/lanka-seam/LankaSeam.test.ts": "export const covered = true;\n",
		});

		// Overriding a member the base already promised is not a second promise.
		expect(runGuard().code).toBe(0);
	});

	it("accepts a private member on a concrete class", () => {
		makeTree({
			"core/src/lanka-seam/LankaSeam.ts":
				"export class LankaSeam {\n\tprivate seam = 1;\n}\n",
			"core/src/lanka-seam/LankaSeam.test.ts": "export const covered = true;\n",
		});

		expect(runGuard().code).toBe(0);
	});

	it("names the offending path, not just the rule", () => {
		makeTree({ "core/src/index.ts": "export const lankaInline = 1;\n" });

		expect(runGuard().output).toContain("core/src/index.ts");
	});
});

describe("check-structure — a kind outside its bucket", () => {
	it("rejects an abstract base sitting among the implementations", () => {
		makeTree({
			"core/src/ALankaSeam.ts": "export abstract class ALankaSeam {}\n",
			"core/src/index.ts": 'export { ALankaSeam } from "./ALankaSeam";\n',
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[kind-outside-its-bucket]");
	});

	it("rejects a factory sitting at a root", () => {
		makeTree({
			"core/src/create-lanka-seam/createLankaSeam.ts":
				"export const createLankaSeam = () => 1;\n",
			"core/src/index.ts":
				'export { createLankaSeam } from "./create-lanka-seam/createLankaSeam";\n',
		});

		expect(runGuard().output).toContain("[kind-outside-its-bucket]");
	});

	it("leaves a factory inside another bucket alone", () => {
		// `_internal/create-…` is internal first: a bucket inside a bucket says
		// nothing, and the rule stops at the first one.
		makeTree({
			"core/src/_internal/create-seam/createSeam.ts": "export const createSeam = () => 1;\n",
			"core/src/index.ts": "export {};\n",
		});

		expect(runGuard().output).not.toContain("[kind-outside-its-bucket]");
	});
});

describe("check-structure — _factories holds what the package publishes", () => {
	/** The manifest the surface is read from: without one, no package is known. */
	const manifest = JSON.stringify({ name: "lanka", exports: { ".": "./src/index.ts" } });

	/** The base tree's barrel, plus one re-export of the factory under test. */
	const barrelWithFactory =
		'export { LankaThing } from "./lanka-thing/LankaThing";\n' +
		'export { createLankaSeam } from "./_factories/create-lanka-seam/createLankaSeam";\n';

	it("rejects a factory the package does not export", () => {
		// Both are `create…`, so rule 9 puts them in one bucket and a reader cannot
		// tell the calls an application makes from the pieces they are built from.
		makeTree({
			"core/package.json": manifest,
			"core/src/_factories/create-lanka-seam/createLankaSeam.ts":
				"export const createLankaSeam = () => 1;\n",
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[factory-not-published]");
		expect(result.output).toContain("_internal/");
	});

	it("accepts one it does export", () => {
		makeTree({
			"core/package.json": manifest,
			"core/src/index.ts": barrelWithFactory,
			"core/src/_factories/create-lanka-seam/createLankaSeam.ts":
				"export const createLankaSeam = () => 1;\n",
		});

		expect(runGuard().code).toBe(0);
	});

	it("says nothing about the same factory inside `_internal/`", () => {
		// `_internal/create-…` is internal first: the bucket already says the file
		// is not published, which is the whole point of moving it there.
		makeTree({
			"core/package.json": manifest,
			"core/src/_internal/create-lanka-seam/createLankaSeam.ts":
				"export const createLankaSeam = () => 1;\n",
		});

		expect(runGuard().code).toBe(0);
	});

	it("does not read a bench beside a published factory as a second factory", () => {
		makeTree({
			"core/package.json": manifest,
			"core/src/index.ts": barrelWithFactory,
			"core/src/_factories/create-lanka-seam/createLankaSeam.ts":
				"export const createLankaSeam = () => 1;\n",
			"core/src/_factories/create-lanka-seam/createLankaSeam.bench.ts":
				"export const benched = true;\n",
		});

		expect(runGuard().code).toBe(0);
	});

	it("stays quiet when the package has no manifest, which is this fixture's normal state", () => {
		// The spec runs the real script over a tree with no manifests. A gate that
		// threw there could not be tested at all — so an absent package is skipped.
		makeTree({
			"core/src/_factories/create-lanka-seam/createLankaSeam.ts":
				"export const createLankaSeam = () => 1;\n",
		});

		expect(runGuard().code).toBe(0);
	});
});
