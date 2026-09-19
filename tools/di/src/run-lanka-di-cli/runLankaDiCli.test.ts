import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLankaDiCli } from "./runLankaDiCli";
import { verifyLankaDi } from "../verify-lanka-di/verifyLankaDi";
import type { TLankaDiDirname } from "../lanka-di-contract/lankaDiContract";

const roots: string[] = [];

interface IRun {
	readonly code: number;
	readonly out: string;
	readonly err: string;
}

const makeRoot = (dirname?: TLankaDiDirname): string => {
	const root = mkdtempSync(join(tmpdir(), "lanka-di-cli-"));
	roots.push(root);
	if (dirname) verifyLankaDi(root, { dirname });
	return root;
};

const run = (root: string, ...argv: string[]): IRun => {
	let out = "";
	let err = "";
	const code = runLankaDiCli({
		argv,
		root,
		write: (text) => (out += text),
		writeError: (text) => (err += text),
	});
	return { code, out, err };
};

afterEach(() => {
	while (roots.length > 0) rmSync(roots.pop() as string, { recursive: true, force: true });
});

describe("lanka-di — help", () => {
	it.each([[], ["--help"], ["-h"], ["help"]])("prints usage for %j", (...argv) => {
		const result = run(makeRoot(), ...(argv as string[]));

		expect(result.code).toBe(0);
		expect(result.out).toContain("lanka-di migrate");
	});

	// The sentence a person is here to read. Both names work and neither is on its
	// way out — a help text that said only what the default is would read as the
	// other one being on borrowed time.
	it("says both directories are supported", () => {
		const out = run(makeRoot(), "--help").out;

		expect(out).toContain(".lanka");
		expect(out).toContain(".lanka_di");
		expect(out).toContain("neither is deprecated");
	});

	it("fails on a command it does not have, rather than doing something near it", () => {
		const result = run(makeRoot(), "move");

		expect(result.code).toBe(1);
		expect(result.err).toContain('unknown command "move"');
	});
});

describe("lanka-di where", () => {
	it("names the directory a project actually uses", () => {
		expect(run(makeRoot(".lanka_di"), "where").out.trim()).toBe(".lanka_di/");
	});

	it("names the default, and says it is one, when there is nothing yet", () => {
		const out = run(makeRoot(), "where").out;

		expect(out).toContain(".lanka/");
		expect(out).toContain("default");
	});

	it("says BOTH out loud, because only one of them is read", () => {
		const root = makeRoot(".lanka_di");
		mkdirSync(join(root, ".lanka"), { recursive: true });

		expect(run(root, "where").out).toContain("BOTH");
	});
});

describe("lanka-di migrate", () => {
	it("moves the barrels and reports what it touched", () => {
		const root = makeRoot(".lanka_di");
		writeFileSync(
			join(root, "tsconfig.json"),
			'{ "compilerOptions": { "paths": { "@lanka_di/*": [".lanka_di/*"] } }, "include": [".lanka_di/**/*"] }',
			"utf8",
		);

		const result = run(root, "migrate");

		expect(result.code).toBe(0);
		expect(result.out).toContain(".lanka_di/ → .lanka/");
		expect(result.out).toContain("tsconfig.json");
		expect(existsSync(join(root, ".lanka", "Host.ts"))).toBe(true);
	});

	// Unconditional, because the one time it is missing is the time it mattered:
	// this command renames a directory and the tsconfigs beside it, and a CI
	// config or a script naming the old one is the person's to find.
	it("always says what it did NOT look at", () => {
		const out = run(makeRoot(".lanka_di"), "migrate").out;

		expect(out).toContain("CI config");
		expect(out).toContain(".gitignore");
	});

	it("writes nothing under --dry-run", () => {
		const root = makeRoot(".lanka_di");

		const result = run(root, "migrate", "--dry-run");

		expect(result.out).toContain("would change");
		expect(existsSync(join(root, ".lanka_di"))).toBe(true);
	});

	it("goes the other way when asked", () => {
		const root = makeRoot(".lanka");

		run(root, "migrate", "--to", ".lanka_di");

		expect(existsSync(join(root, ".lanka_di", "Host.ts"))).toBe(true);
	});

	// A typo accepted here renames the directory to something the framework cannot
	// find, and the failure arrives one build later as "module not found" with
	// nothing pointing back at this command.
	it("refuses a --to the framework does not read", () => {
		const root = makeRoot(".lanka_di");

		const result = run(root, "migrate", "--to", ".lanka-di");

		expect(result.code).toBe(1);
		expect(result.err).toContain("not a directory this framework reads");
		expect(existsSync(join(root, ".lanka_di"))).toBe(true);
	});

	// Someone who typed `--to` meant to name a directory. Reading past the end of
	// the arguments and falling back to the default migrates them somewhere they
	// did not ask for, and reports success while doing it.
	it("refuses --to with nothing after it, rather than defaulting", () => {
		const root = makeRoot(".lanka_di");

		const result = run(root, "migrate", "--to");

		expect(result.code).toBe(1);
		expect(result.err).toContain("--to");
		expect(existsSync(join(root, ".lanka_di"))).toBe(true);
		expect(existsSync(join(root, ".lanka"))).toBe(false);
	});

	// The same mistake with another flag after it. This one is caught by the
	// value check, and the two must not disagree about whether it is an error.
	it("refuses --to followed by another flag", () => {
		const root = makeRoot(".lanka_di");

		const result = run(root, "migrate", "--to", "--dry-run");

		expect(result.code).toBe(1);
		expect(existsSync(join(root, ".lanka_di"))).toBe(true);
	});

	it("exits non-zero when the migration refuses", () => {
		const root = makeRoot(".lanka_di");
		mkdirSync(join(root, ".lanka"), { recursive: true });

		const result = run(root, "migrate");

		expect(result.code).toBe(1);
		expect(result.err).toContain("both present");
	});

	it("says there is nothing to do rather than inventing work", () => {
		const result = run(makeRoot(".lanka"), "migrate");

		expect(result.code).toBe(0);
		expect(result.out).toContain("already on .lanka/");
	});
});
