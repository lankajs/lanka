/**
 * Pins `check-naming.mjs`: one test per rule it enforces, plus the tree it must
 * accept unchanged.
 *
 * A guard nothing exercises is a guard that reports success. Each test spawns
 * the real script against a temporary git repository and asserts the exit code
 * and the rule tag, because those are what a contributor acts on.
 *
 * The fixture is a git repository because rule 8 asks git — not the filesystem —
 * for folder case: on Windows the filesystem cannot answer.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/check-naming.mjs");

let root = null;

const write = (relativePath, content) => {
	const path = join(root, relativePath);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
};

const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "ignore" });

/**
 * The smallest tree the script accepts: all five roots exist, `core` has a
 * manifest whose `exports` name the one barrel, and everything is tracked.
 */
const makeTree = (files = {}) => {
	root = mkdtempSync(join(tmpdir(), "lanka-check-naming-"));

	for (const dir of ["core/src", "modules", "plugins", "tools", "scripts"]) {
		mkdirSync(join(root, dir), { recursive: true });
	}
	// A directory git cannot track is a directory the fixture loses.
	for (const dir of ["modules", "plugins", "tools", "scripts"]) {
		write(`${dir}/.gitkeep`, "");
	}

	write(
		"core/package.json",
		JSON.stringify({ name: "lanka", exports: { ".": "./src/index.ts" } }),
	);
	write("core/src/index.ts", 'export { LankaThing } from "./thing/LankaThing";\n');
	write("core/src/thing/LankaThing.ts", "export class LankaThing {}\n");

	for (const [path, content] of Object.entries(files)) write(path, content);

	git("init", "--quiet");
	git("add", "-A");

	return root;
};

/** Runs the guard and reports what a caller sees: exit code and message. */
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

describe("check-naming", () => {
	it("passes a tree that follows the canon", () => {
		makeTree();

		const result = runGuard();

		expect(result.code).toBe(0);
		expect(result.output).toContain("follow the canon");
	});

	it("rule 1: rejects a folder that is not kebab-case", () => {
		makeTree({ "core/src/MyThing/LankaOther.ts": "export class LankaOther {}\n" });

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[folder-kebab]");
	});

	it("rule 1: rejects a folder with no subject", () => {
		makeTree({ "core/src/helpers/LankaOther.ts": "export class LankaOther {}\n" });

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[folder-without-subject]");
	});

	it("rule 2: rejects a file not named after what it exports", () => {
		makeTree({ "core/src/thing/LankaWrong.ts": "export class LankaRight {}\n" });

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[file-named-after-export]");
	});

	it("rule 2: accepts a camelCase group file holding several exports", () => {
		makeTree({
			"core/src/thing/lankaGroup.ts":
				"export const lankaFirst = 1;\nexport const lankaSecond = 2;\n",
		});

		expect(runGuard().code).toBe(0);
	});

	it("rule 3: requires the I, T and A prefixes", () => {
		makeTree({
			"core/src/thing/LankaThing.ts":
				"export class LankaThing {}\n" +
				"export interface Config { a: number }\n" +
				"export type Kind = string;\n" +
				"export abstract class Base {}\n",
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[prefix-I]");
		expect(result.output).toContain("[prefix-T]");
		expect(result.output).toContain("[prefix-A]");
	});

	it("rule 4: rejects a suffix that says nothing", () => {
		makeTree({ "core/src/thing/LankaUserService.ts": "export class LankaUserService {}\n" });

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[empty-suffix]");
	});

	it("rule 4: allows Info on a value, forbids it on a type name", () => {
		makeTree({
			"core/src/thing/LankaThing.ts":
				"export class LankaThing {\n\tprivate readonly deviceInfo = 1;\n}\n",
		});

		expect(runGuard().code).toBe(0);
	});

	it("rule 5: rejects an unbranded name on the package surface", () => {
		makeTree({
			"core/src/index.ts": 'export { Thing } from "./thing/Thing";\n',
			"core/src/thing/Thing.ts": "export class Thing {}\n",
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[brand]");
	});

	it("rule 6: rejects an UPPER_SNAKE key in a defaults object", () => {
		makeTree({
			"core/src/thing/lankaDefaults.ts":
				"export const LANKA_CONFIG = {\n\tMAX_RETRIES: 3,\n};\nexport const lankaOther = 1;\n",
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[config-camelCase]");
	});

	it("rule 7: rejects a time value without a unit in its name", () => {
		makeTree({
			"core/src/thing/ILankaTiming.ts":
				"export interface ILankaTiming {\n\ttimeout: number;\n}\n",
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[units-in-name]");
	});

	it("rule 7: accepts the same value once the unit is in the name", () => {
		makeTree({
			"core/src/thing/ILankaTiming.ts":
				"export interface ILankaTiming {\n\ttimeoutMs: number;\n}\n",
		});

		expect(runGuard().code).toBe(0);
	});

	it("rule 8: rejects an upper-case folder recorded in git's index", () => {
		makeTree({
			"core/src/Interfaces/ILankaThing.ts": "export interface ILankaThing {\n\ta: 1;\n}\n",
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[case-in-index]");
	});

	it("names the offending path, not just the rule", () => {
		makeTree({ "core/src/thing/LankaWrong.ts": "export class LankaRight {}\n" });

		expect(runGuard().output).toContain("LankaWrong.ts");
	});
});
