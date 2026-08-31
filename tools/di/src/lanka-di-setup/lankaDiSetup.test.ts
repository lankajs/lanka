import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lankaDiSetup } from "./lankaDiSetup";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";

describe("lankaDiSetup", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "lanka-setup-"));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("answers the alias every bundler is given", () => {
		const setup = lankaDiSetup({ root });

		expect(setup.alias).toEqual({ [lankaDiContract.alias]: setup.dir });
		expect(setup.dir.endsWith(`/${lankaDiContract.dirname}`)).toBe(true);
	});

	// A backslash in an alias matches nothing in any of the five bundlers: they
	// all compare posix paths, whatever the platform underneath.
	it("normalises separators, so a Windows root still matches", () => {
		expect(lankaDiSetup({ root: "C:\\projects\\app" }).dir).toBe("C:/projects/app/.lanka_di");
	});

	it("cannot be reached into: the alias is frozen", () => {
		const setup = lankaDiSetup({ root });

		expect(Object.isFrozen(setup.alias)).toBe(true);
	});

	it("scaffolds and answers what it wrote — the directory included", () => {
		const created = lankaDiSetup({ root }).verify();

		// The directory counts as written: a consumer looking at the list has to
		// see the folder they are being asked to commit, not only its contents.
		expect(created).toContain(`${lankaDiContract.dirname}/`);
		for (const barrel of lankaDiContract.barrels) {
			expect(created).toContain(`${lankaDiContract.dirname}/${barrel.file}`);
		}
		expect(existsSync(join(root, lankaDiContract.dirname, "Gateways.ts"))).toBe(true);
	});

	it("says nothing on a healthy project", () => {
		lankaDiSetup({ root }).verify();

		expect(lankaDiSetup({ root }).verify()).toEqual([]);
	});

	// The one thing every adapter turns into its own kind of failure. Throwing
	// here rather than returning a report is what lets five of them stay three
	// lines each.
	it("throws when a barrel exists and lost a required export", () => {
		mkdirSync(join(root, lankaDiContract.dirname), { recursive: true });
		writeFileSync(
			join(root, lankaDiContract.dirname, "Host.ts"),
			"export const nothing = 1;\n",
		);

		expect(() => lankaDiSetup({ root }).verify()).toThrow(/lankaHost/);
	});

	it("refuses to scaffold when told not to", () => {
		expect(() => lankaDiSetup({ root, scaffold: false }).verify()).toThrow();
		expect(existsSync(join(root, lankaDiContract.dirname, "Gateways.ts"))).toBe(false);
	});
});
