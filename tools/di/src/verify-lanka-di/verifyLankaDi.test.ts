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

describe("verifyLankaDi — the path is taken by something else", () => {
	// `.lanka` is a name somebody may well give a config FILE, which is why the
	// resolver checks for a DIRECTORY. The verifier has to agree: an `existsSync`
	// here is true for the file, so the directory is never created and the first
	// barrel write fails with a raw ENOENT naming a path inside a file — the
	// exact confusing failure this package exists to replace.
	it("says the path is a file rather than crashing on the first barrel", () => {
		const root = makeRoot();
		writeFileSync(join(root, ".lanka"), "not a directory\n", "utf8");

		const report = verifyLankaDi(root);

		expect(report.problems.join("\n")).toContain(".lanka");
		expect(report.problems.join("\n")).toMatch(/file/i);
	});

	it("does not overwrite the file it found there", () => {
		const root = makeRoot();
		writeFileSync(join(root, ".lanka"), "mine\n", "utf8");

		verifyLankaDi(root);

		expect(readFileSync(join(root, ".lanka"), "utf8")).toBe("mine\n");
	});

	// The way out is named, and it is the OTHER directory each time — not a
	// constant. A message that always said `.lanka_di` would send a consumer
	// whose `.lanka_di` is the occupied one straight back where they came from.
	it.each([
		[".lanka", ".lanka_di"],
		[".lanka_di", ".lanka"],
	])("tells a consumer whose %s is a file to use %s", (taken, way) => {
		const root = makeRoot();
		writeFileSync(join(root, taken), "not a directory\n", "utf8");

		const problems = verifyLankaDi(root, {
			dirname: taken as ".lanka" | ".lanka_di",
		}).problems.join("\n");

		expect(problems).toContain(`use ${way}/`);
	});

	// The other layout is reachable and correct, so the message must not be a
	// dead end: a consumer with a `.lanka` file of their own has somewhere to go.
	it("leaves .lanka_di usable when .lanka is taken", () => {
		const root = makeRoot();
		writeFileSync(join(root, ".lanka"), "not a directory\n", "utf8");

		const report = verifyLankaDi(root, { dirname: ".lanka_di" });

		expect(report.problems).toEqual([]);
		expect(existsSync(join(root, ".lanka_di", "Host.ts"))).toBe(true);
	});
});

describe("verifyLankaDi — both directories at once", () => {
	// Neither name is wrong; having both is. The framework reads one and the other
	// keeps type-checking, so a gateway added to the wrong file is never seen and
	// never reported — no error, anywhere, in the file that wires the whole app.
	it("reports the ambiguity rather than quietly reading one of them", () => {
		const root = makeRoot();
		verifyLankaDi(root);
		mkdirSync(join(root, ".lanka_di"), { recursive: true });

		const problems = verifyLankaDi(root).problems.join("\n");

		expect(problems).toContain("both present");
		expect(problems).toContain(".lanka_di");
	});

	// Reported, not repaired. Deleting one is a choice about which half of
	// somebody's wiring is real, and this tool never overwrites a consumer's code
	// to satisfy a contract.
	it("leaves both on disk", () => {
		const root = makeRoot();
		verifyLankaDi(root);
		mkdirSync(join(root, ".lanka_di"), { recursive: true });

		verifyLankaDi(root);

		expect(existsSync(join(root, ".lanka"))).toBe(true);
		expect(existsSync(join(root, ".lanka_di"))).toBe(true);
	});

	// The CI posture is where this matters most: a build that quietly reads one of
	// two directories is a build that behaves differently on the machine where
	// the other one was checked out.
	it("fails the CI posture too, rather than only the scaffolding one", () => {
		const root = makeRoot();
		verifyLankaDi(root);
		mkdirSync(join(root, ".lanka_di"), { recursive: true });

		expect(verifyLankaDi(root, { scaffold: false }).problems.join("\n")).toContain(
			"both present",
		);
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
	"compilerOptions": { "paths": { "@lanka_di/*": [".lanka/*"] } },
	"include": ["src/**/*", ".lanka/**/*"]
}`;

	it("says nothing when the mapping and the include are both there", () => {
		expect(withTsconfig(COMPLETE)).toEqual([]);
	});

	it("names the exact mapping to add when it is missing", () => {
		const problems = withTsconfig(`{ "include": [".lanka/**/*"] }`).join("\n");

		expect(problems).toContain('"@lanka_di/*"');
		expect(problems).toContain('"@lanka_di/*": [".lanka/*"]');
	});

	it("names the include when it is missing, because a wildcard skips dot-directories", () => {
		const problems = withTsconfig(
			`{ "compilerOptions": { "paths": { "@lanka_di/*": [".lanka/*"] } }, "include": ["src/**/*"] }`,
		).join("\n");

		expect(problems).toContain('".lanka/**/*"');
	});

	it("does not read a commented-out mapping as a live one", () => {
		// The defect this check exists for, in its most plausible form: the line is
		// present in the file and does nothing.
		const problems = withTsconfig(`{
	"compilerOptions": { "paths": {
		// "@lanka_di/*": [".lanka/*"],
	} },
	/* "include": [".lanka/**/*"] */
	"include": ["src/**/*"]
}`).join("\n");

		expect(problems).toContain('"@lanka_di/*"');
		expect(problems).toContain('".lanka/**/*"');
	});

	// `.lanka` is a PREFIX of `.lanka_di`, so a substring check answers yes to the
	// wrong layout and goes quiet for exactly the project that changed its mind —
	// leaving the one file that wires the whole application with no types.
	it("does not accept a stale .lanka_di include for a .lanka project", () => {
		const problems = withTsconfig(
			`{ "compilerOptions": { "paths": { "@lanka_di/*": [".lanka/*"] } }, "include": [".lanka_di/**/*"] }`,
		).join("\n");

		expect(problems).toContain('".lanka/**/*"');
	});

	// The alternative layout, checked as an equal. A project on `.lanka_di` must
	// be told about `.lanka_di` — being told to add `.lanka` would be advice that
	// breaks a working build.
	it("names the project's OWN directory, not the default", () => {
		const root = makeRoot();
		mkdirSync(join(root, ".lanka_di"), { recursive: true });
		verifyLankaDi(root);
		writeFileSync(join(root, "tsconfig.json"), `{ "include": ["src/**/*"] }`, "utf8");

		const problems = verifyLankaDi(root).problems.join("\n");

		expect(problems).toContain('".lanka_di/**/*"');
		expect(problems).not.toContain('".lanka/**/*"');
	});

	it("stays quiet when the consumer has no tsconfig at all", () => {
		const root = makeRoot();

		expect(verifyLankaDi(root).problems).toEqual([]);
	});
});
