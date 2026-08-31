import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { verifyLankaDi } from "./verifyLankaDi";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";

/**
 * The contract version.
 *
 * Inside a monorepo it means nothing: package and consumer update in one commit.
 * Published to npm, "file present, export present, different semantics" becomes
 * possible — the failure this plugin exists to prevent.
 */

const roots: string[] = [];

const makeProject = (contract: string | null): string => {
	const root = mkdtempSync(join(tmpdir(), "lanka-di-"));
	roots.push(root);
	mkdirSync(join(root, lankaDiContract.dirname));
	writeFileSync(
		join(root, "tsconfig.json"),
		JSON.stringify({
			include: ["src", ".lanka_di"],
			compilerOptions: { paths: { "@lanka_di/*": ["./.lanka_di/*"] } },
		}),
	);
	if (contract !== null) {
		writeFileSync(join(root, lankaDiContract.dirname, "Contract.ts"), contract, "utf8");
	}
	return root;
};

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("the .lanka_di contract version", () => {
	it("outdated barrels are rejected, with what to do about it", () => {
		// Without this check, barrels of a previous contract pass: file present,
		// export present, and the framework reads something else.
		const root = makeProject("export const lankaDiContractVersion = 0;\n");

		const report = verifyLankaDi(root, { scaffold: false });

		expect(report.problems.join("\n")).toMatch(/contract version/i);
		expect(report.problems.join("\n")).toContain("0");
		expect(report.problems.join("\n")).toContain(String(lankaDiContract.version));
	});

	it("barrels from the future are rejected too", () => {
		// A framework older than the barrels is the same trouble from the other
		// side, and staying quiet tells someone all is well when it is not.
		const root = makeProject(
			`export const lankaDiContractVersion = ${String(lankaDiContract.version + 1)};\n`,
		);

		const report = verifyLankaDi(root, { scaffold: false });

		expect(report.problems.join("\n")).toMatch(/contract version/i);
	});

	it("a matching version passes silently", () => {
		const root = makeProject(
			`export const lankaDiContractVersion = ${String(lankaDiContract.version)};\n`,
		);

		const report = verifyLankaDi(root, { scaffold: false });

		expect(report.problems.filter((problem) => /version/i.test(problem))).toEqual([]);
	});

	it("an unreadable version is a problem, not good enough", () => {
		// A value that cannot be parsed is no better than a missing one: accepting
		// it returns to exactly the state the version exists to prevent.
		const root = makeProject("export const lankaDiContractVersion = VERSION;\n");

		const report = verifyLankaDi(root, { scaffold: false });

		expect(report.problems.join("\n")).toMatch(/contract version/i);
	});

	it("the scaffolder writes the file with the current version", () => {
		const root = makeProject(null);

		const report = verifyLankaDi(root, { scaffold: true });

		expect(report.created).toContain(`${lankaDiContract.dirname}/Contract.ts`);
		expect(verifyLankaDi(root, { scaffold: false }).problems).toEqual([]);
	});
});
