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

/**
 * The three rules about a package's own documents.
 *
 * `@lankajs/async` is the subject because the registry gives it one required
 * peer it inherits — `zustand`, through its dependency on core — so the install
 * rule has something to disagree about. The tree holds that package alone: every
 * rule below skips a package directory that is not on disk, which is what lets
 * the tests above drive the guard against a tree with no packages in it at all.
 */
const GUIDE = [
	"# @lankajs/async — user guide",
	"",
	"## You will learn",
	"",
	"- the one thing",
	"",
	"## When to reach for this",
	"",
	"When you need it.",
	"",
	"## Install",
	"",
	"```bash",
	"npm install @lankajs/async zustand",
	"```",
	"",
	"## Recap",
	"",
	"- the one thing",
	"",
].join("\n");

/** A tree holding one real package, with the three documents it must carry. */
const packageTree = ({ guide = GUIDE, docs = ["README.md", "SKILL.md"] } = {}) => {
	root = mkdtempSync(join(tmpdir(), "lanka-check-docs-"));
	const dir = join(root, "modules", "async");
	mkdirSync(dir, { recursive: true });
	// The manifest is what makes the folder a package to the guard.
	writeFileSync(join(dir, "package.json"), '{ "name": "@lankajs/async" }\n', "utf8");
	writeFileSync(join(dir, "GUIDE.md"), guide, "utf8");
	for (const name of docs) writeFileSync(join(dir, name), "# a document\n", "utf8");
	return root;
};

describe("check-docs — a package's three documents", () => {
	it("passes a package carrying all three, with the guide's shape", () => {
		const result = runGuard(packageTree());

		expect(result.code).toBe(0);
	});

	it("fails a package with no SKILL.md, and says what the file answers", () => {
		const result = runGuard(packageTree({ docs: ["README.md"] }));

		expect(result.code).toBe(1);
		expect(result.output).toContain("[package-docs]");
		expect(result.output).toContain("modules/async/SKILL.md");
		expect(result.output).toContain("what may not change in it");
	});

	it("fails a guide missing the adoption section, and names the heading", () => {
		const result = runGuard(
			packageTree({ guide: GUIDE.replace("## When to reach for this", "## Do I need it?") }),
		);

		// The variant heading is not the canon one, and a reader who has read
		// another guide looks for the canon one.
		expect(result.code).toBe(1);
		expect(result.output).toContain("[guide-shape]");
		expect(result.output).toContain("## When to reach for this");
	});

	it("fails a guide whose install line drops a required peer", () => {
		const result = runGuard(
			packageTree({ guide: GUIDE.replace("@lankajs/async zustand", "@lankajs/async") }),
		);

		// `reference.md` is the generated header plus this guide, so the two lines
		// ship on one page and a reader is told to install two different things.
		expect(result.code).toBe(1);
		expect(result.output).toContain("[guide-install]");
		expect(result.output).toContain("npm install @lankajs/async zustand");
	});

	it("reads past a second install line that is not this package's", () => {
		const result = runGuard(
			packageTree({
				guide: `${GUIDE}\n## Next\n\n\`\`\`bash\nnpm install @lankajs/react\n\`\`\`\n`,
			}),
		);

		expect(result.code).toBe(0);
	});
});
