import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { verifyLankaDi } from "./verifyLankaDi";

const roots: string[] = [];

const makeRoot = (): string => {
	const root = mkdtempSync(join(tmpdir(), "lanka-di-"));
	roots.push(root);
	return root;
};

const diPath = (root: string, file = ""): string => join(root, lankaDiContract.dirname, file);

afterEach(() => {
	while (roots.length > 0) rmSync(roots.pop() as string, { recursive: true, force: true });
});

describe("verifyLankaDi — scaffolding", () => {
	it("writes every barrel the contract declares, not a hand-kept list", () => {
		const root = makeRoot();

		const report = verifyLankaDi(root);

		// Derived from the contract on purpose: a barrel added to the list and
		// forgotten in the scaffolder fails HERE, the one place the divergence is
		// noticed cheaply.
		for (const barrel of lankaDiContract.barrels) {
			expect(existsSync(diPath(root, barrel.file))).toBe(true);
			expect(report.created).toContain(`${lankaDiContract.dirname}/${barrel.file}`);
		}
		expect(report.problems).toEqual([]);
	});

	it("is idempotent — a second run creates nothing and complains about nothing", () => {
		const root = makeRoot();
		verifyLankaDi(root);

		const second = verifyLankaDi(root);

		expect(second.created).toEqual([]);
		expect(second.problems).toEqual([]);
	});

	it("never overwrites a barrel the consumer has already written", () => {
		const root = makeRoot();
		verifyLankaDi(root);
		const mine = `export const lankaHost = { httpErrorMessage: () => "mine" };\n`;
		writeFileSync(diPath(root, "Host.ts"), mine, "utf8");

		verifyLankaDi(root);

		// A missing file is "created" while a wrong one is a "problem": fixing the
		// second by overwriting would destroy someone's work.
		expect(readFileSync(diPath(root, "Host.ts"), "utf8")).toBe(mine);
	});
});

describe("verifyLankaDi — scaffold disabled (the CI posture)", () => {
	it("reports the missing directory instead of creating it", () => {
		const root = makeRoot();

		const report = verifyLankaDi(root, { scaffold: false });

		expect(existsSync(diPath(root))).toBe(false);
		expect(report.created).toEqual([]);
		expect(report.problems.join("\n")).toContain(`${lankaDiContract.dirname}/ is missing`);
	});

	it("names each missing barrel rather than the directory", () => {
		const root = makeRoot();
		mkdirSync(diPath(root), { recursive: true });
		writeFileSync(diPath(root, "Host.ts"), lankaDiContract.barrels[0].stub, "utf8");

		const report = verifyLankaDi(root, { scaffold: false });

		expect(report.problems.join("\n")).toContain(
			`${lankaDiContract.dirname}/Gateways.ts is missing`,
		);
		expect(report.problems.join("\n")).not.toContain("Host.ts is missing");
	});
});

describe("verifyLankaDi — the required export", () => {
	it("fails a Host barrel that no longer exports what lanka calls by name", () => {
		const root = makeRoot();
		verifyLankaDi(root);
		writeFileSync(diPath(root, "Host.ts"), `export const somethingElse = {};\n`, "utf8");

		const report = verifyLankaDi(root);

		expect(report.problems.join("\n")).toContain("does not export `lankaHost`");
	});

	it.each([
		["a const declaration", `export const lankaHost = {};\n`],
		["an export list", `const lankaHost = {};\nexport { lankaHost };\n`],
		["a renamed export", `const h = {};\nexport { h as lankaHost };\n`],
		["a function declaration", `export function lankaHost() {}\n`],
	])("accepts %s", (_name, source) => {
		const root = makeRoot();
		verifyLankaDi(root);
		writeFileSync(diPath(root, "Host.ts"), source, "utf8");

		expect(verifyLankaDi(root).problems).toEqual([]);
	});
});

describe("verifyLankaDi — the consumer's tsconfig", () => {
	const withTsconfig = (contents: string): string[] => {
		const root = makeRoot();
		verifyLankaDi(root);
		writeFileSync(join(root, "tsconfig.json"), contents, "utf8");
		return [...verifyLankaDi(root).problems];
	};

	const COMPLETE = `{
	"compilerOptions": { "paths": { "@lanka_di/*": [".lanka_di/*"] } },
	"include": ["src/**/*", ".lanka_di/**/*"]
}`;

	it("says nothing when the mapping and the include are both there", () => {
		expect(withTsconfig(COMPLETE)).toEqual([]);
	});

	it("names the exact mapping to add when it is missing", () => {
		const problems = withTsconfig(`{ "include": [".lanka_di/**/*"] }`).join("\n");

		expect(problems).toContain('"@lanka_di/*"');
		expect(problems).toContain('"@lanka_di/*": [".lanka_di/*"]');
	});

	it("names the include when it is missing, because a wildcard skips dot-directories", () => {
		const problems = withTsconfig(
			`{ "compilerOptions": { "paths": { "@lanka_di/*": [".lanka_di/*"] } }, "include": ["src/**/*"] }`,
		).join("\n");

		expect(problems).toContain('".lanka_di/**/*"');
	});

	it("does not read a commented-out mapping as a live one", () => {
		// The defect this check exists for, in its most plausible form: the line is
		// present in the file and does nothing.
		const problems = withTsconfig(`{
	"compilerOptions": { "paths": {
		// "@lanka_di/*": [".lanka_di/*"],
	} },
	/* "include": [".lanka_di/**/*"] */
	"include": ["src/**/*"]
}`).join("\n");

		expect(problems).toContain('"@lanka_di/*"');
		expect(problems).toContain('".lanka_di/**/*"');
	});

	it("stays quiet when the consumer has no tsconfig at all", () => {
		const root = makeRoot();

		expect(verifyLankaDi(root).problems).toEqual([]);
	});
});
