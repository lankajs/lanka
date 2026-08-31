/**
 * Pins `check-docs.mjs`: what it fails on, and what it lets through.
 *
 * A guard nothing exercises is a guard that reports success — the defect class
 * the guard itself exists to catch. Each test drives the real script as a child
 * process against a temporary tree, so what is asserted is the exit code a
 * contributor and CI will see, not an internal function.
 *
 * The Cyrillic samples below are fixture data and carry the escape marker on
 * their own line; without it this file would fail the guard it tests.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/check-docs.mjs");

const CYRILLIC = "Привет"; // check-docs:allow — fixture data
const SCRIPTS_REJECTED = ["中", "あ", "م"]; // check-docs:allow — fixture data

let root = null;

/** A tree the script accepts as a repository: one source file under `core`. */
const treeWith = (source) => {
	root = mkdtempSync(join(tmpdir(), "lanka-check-docs-"));
	mkdirSync(join(root, "core"), { recursive: true });
	writeFileSync(join(root, "core", "sample.ts"), source, "utf8");
	return root;
};

/** Runs the guard and reports what a caller sees: exit code and message. */
const runGuard = (cwd) => {
	try {
		const stdout = execFileSync(process.execPath, [SCRIPT], { cwd, encoding: "utf8" });
		return { code: 0, output: stdout };
	} catch (error) {
		return { code: error.status, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
	}
};

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
	root = null;
});

describe("check-docs", () => {
	it("passes a tree written entirely in Latin script", () => {
		const result = runGuard(
			treeWith("/** A plain English docblock. */\nexport const x = 1;\n"),
		);

		expect(result.code).toBe(0);
		expect(result.output).toContain("follows the canon");
	});

	it("fails on Cyrillic in a comment and names the line", () => {
		const result = runGuard(treeWith(`/** ${CYRILLIC} */\nexport const x = 1;\n`));

		expect(result.code).toBe(1);
		expect(result.output).toContain("[language]");
		expect(result.output).toContain("core/sample.ts:1");
	});

	it("fails on CJK, Kana and Arabic as well", () => {
		for (const sample of SCRIPTS_REJECTED) {
			const result = runGuard(treeWith(`/** ${sample} */\nexport const x = 1;\n`));

			expect(result.code).toBe(1);
			expect(result.output).toContain("[language]");
		}
	});

	it("allows Latin-1 typography — an em dash is not a second language", () => {
		const result = runGuard(
			treeWith("/** A dash — and “quotes” — are typography. */\nexport const x = 1;\n"),
		);

		expect(result.code).toBe(0);
	});

	it("fails on a deprecation with no replacement", () => {
		const tag = "@deprecated"; // check-docs:allow — fixture data

		const result = runGuard(
			treeWith(`/** ${tag} use the other one. */\nexport const x = 1;\n`),
		);

		// "the other one" is not a name, and a reader cannot act on it.
		expect(result.code).toBe(1);
		expect(result.output).toContain("[deprecation-form]");
	});

	it("fails on a deprecation with no version", () => {
		const tag = "@deprecated"; // check-docs:allow — fixture data

		const result = runGuard(
			treeWith(
				`/** ${tag} use createLankaThing, it names the rule. */\nexport const x = 1;\n`,
			),
		);

		expect(result.code).toBe(1);
		expect(result.output).toContain("[deprecation-form]");
	});

	it("accepts a deprecation carrying its four facts", () => {
		const tag = "@deprecated"; // check-docs:allow — fixture data
		const mark = `${tag} since 1.2.0 - use createLankaThing, the old name said how.`;

		const result = runGuard(treeWith(`/** ${mark} */\nexport const x = 1;\n`));

		expect(result.code).toBe(0);
	});

	it("leaves prose about the tag alone", () => {
		const tag = "@deprecated"; // check-docs:allow — fixture data
		root = mkdtempSync(join(tmpdir(), "lanka-check-docs-"));
		mkdirSync(join(root, "skills"), { recursive: true });
		writeFileSync(join(root, "skills", "SKILL.md"), `A ${tag} tag is a promise.\n`, "utf8");

		const result = runGuard(root);

		// A markdown file quoting the tag is citing the rule, not making a promise —
		// and the canon that documents deprecation must be able to discuss it.
		expect(result.code).toBe(0);
	});

	it("exempts a line carrying the escape marker", () => {
		const marker = "check-docs" + ":allow";

		const result = runGuard(treeWith(`const sample = "${CYRILLIC}"; // ${marker}\n`));

		expect(result.code).toBe(0);
	});

	it("exempts only the marked line, not the rest of the file", () => {
		const marker = "check-docs" + ":allow";

		const result = runGuard(
			treeWith(`const ok = "${CYRILLIC}"; // ${marker}\nconst bad = "${CYRILLIC}";\n`),
		);

		expect(result.code).toBe(1);
		expect(result.output).toContain("core/sample.ts:2");
	});

	it("ignores file types it does not own", () => {
		root = mkdtempSync(join(tmpdir(), "lanka-check-docs-"));
		mkdirSync(join(root, "core"), { recursive: true });
		writeFileSync(join(root, "core", "notes.txt"), CYRILLIC, "utf8");

		expect(runGuard(root).code).toBe(0);
	});

	it("does not walk into build output", () => {
		root = mkdtempSync(join(tmpdir(), "lanka-check-docs-"));
		mkdirSync(join(root, "core", "dist"), { recursive: true });
		writeFileSync(join(root, "core", "dist", "index.js"), `// ${CYRILLIC}`, "utf8");

		expect(runGuard(root).code).toBe(0);
	});
});
