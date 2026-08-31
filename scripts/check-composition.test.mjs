/**
 * Pins `check-composition.mjs`: one test per rule, plus the tree it must accept.
 *
 * The budgets are a ratchet, so the test that matters most is the one proving a
 * long function is REPORTED — a ratchet that cannot fail is a list of numbers.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/check-composition.mjs");

let root = null;

const write = (relativePath, content) => {
	const path = join(root, relativePath);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
};

const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "ignore" });

const makeTree = (files = {}) => {
	root = mkdtempSync(join(tmpdir(), "lanka-check-composition-"));

	for (const dir of ["core/src", "modules", "plugins", "tools"]) {
		mkdirSync(join(root, dir), { recursive: true });
	}
	for (const dir of ["modules", "plugins", "tools"]) write(`${dir}/.gitkeep`, "");
	write("core/src/lankaShort.ts", "export const lankaShort = (): number => 1;\n");

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

/** A function body of `count` trivial statements. */
const functionOf = (count) =>
	`export const lankaLong = (): number => {\n${"\tlet x = 0;\n".repeat(count)}\treturn 0;\n};\n`;

/** A block of `count` distinct statements, identical wherever it is pasted. */
const sharedBlock = `const first = 1;
const second = 2;
const third = 3;
const fourth = 4;
const fifth = 5;
const sixth = 6;
`;

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
	root = null;
});

describe("check-composition", () => {
	it("passes a tree that follows the canon", () => {
		makeTree();

		const result = runGuard();

		expect(result.code).toBe(0);
		expect(result.output).toContain("follows the canon");
	});

	it("rule 1: reports a function past the default budget", () => {
		makeTree({ "core/src/lankaLong.ts": functionOf(45) });

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[long-function]");
	});

	it("rule 1: states the span and the budget", () => {
		makeTree({ "core/src/lankaLong.ts": functionOf(45) });

		const output = runGuard().output;

		expect(output).toMatch(/\d+ lines, budget 40/);
	});

	it("rule 1: accepts a function just inside the budget", () => {
		makeTree({ "core/src/lankaLong.ts": functionOf(30) });

		expect(runGuard().code).toBe(0);
	});

	it("rule 1: skips test files", () => {
		makeTree({ "core/src/lankaLong.test.ts": functionOf(60) });

		expect(runGuard().code).toBe(0);
	});

	it("rule 2: reports a block repeated in three files", () => {
		makeTree({
			"core/src/lankaFirst.ts": sharedBlock,
			"modules/pkg/src/lankaSecond.ts": sharedBlock,
			"plugins/pkg/src/lankaThird.ts": sharedBlock,
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[duplicate-block]");
	});

	it("rule 2: allows a block repeated in only two files", () => {
		// Two is a coincidence; the third is the rule. Acting on the second builds
		// an abstraction from two examples that fits neither by the time a third
		// arrives.
		makeTree({
			"core/src/lankaFirst.ts": sharedBlock,
			"modules/pkg/src/lankaSecond.ts": sharedBlock,
		});

		expect(runGuard().code).toBe(0);
	});

	it("rule 2: lists every site, so the extraction has somewhere to go", () => {
		makeTree({
			"core/src/lankaFirst.ts": sharedBlock,
			"modules/pkg/src/lankaSecond.ts": sharedBlock,
			"plugins/pkg/src/lankaThird.ts": sharedBlock,
		});

		const output = runGuard().output;

		expect(output).toContain("core/src/lankaFirst.ts");
		expect(output).toContain("modules/pkg/src/lankaSecond.ts");
		expect(output).toContain("plugins/pkg/src/lankaThird.ts");
	});

	it("rule 2: exempts generated build configs", () => {
		makeTree({
			"core/tsup.config.ts": sharedBlock,
			"modules/pkg/tsup.config.ts": sharedBlock,
			"plugins/pkg/tsup.config.ts": sharedBlock,
		});

		expect(runGuard().code).toBe(0);
	});

	it("rule 3: reports a three-branch else-if chain", () => {
		makeTree({
			"core/src/lankaBranchy.ts": `export const lankaPick = (n: number): string => {
	if (n === 1) {
		return "one";
	} else if (n === 2) {
		return "two";
	} else if (n === 3) {
		return "three";
	}
	return "other";
};
`,
		});

		const result = runGuard();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[else-if-chain]");
	});

	it("rule 3: leaves a single else-if alone", () => {
		makeTree({
			"core/src/lankaBranchy.ts": `export const lankaPick = (n: number): string => {
	if (n === 1) {
		return "one";
	} else if (n === 2) {
		return "two";
	}
	return "other";
};
`,
		});

		expect(runGuard().code).toBe(0);
	});

	it("rule 3: leaves guard clauses alone", () => {
		// Three independent refusals are not one decision with three cases.
		makeTree({
			"core/src/lankaGuarded.ts": `export const lankaCheck = (n: number | null): number => {
	if (n === null) return 0;
	if (n < 0) return 0;
	if (n > 100) return 100;
	return n;
};
`,
		});

		expect(runGuard().code).toBe(0);
	});
});
