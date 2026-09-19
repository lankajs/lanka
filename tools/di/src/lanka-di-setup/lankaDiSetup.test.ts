import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
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
	// A backslash in an alias matches nothing in any of the six bundlers: they
	// all compare posix paths, whatever the platform underneath. The input is a
	// real absolute path from the platform running the suite, because the root
	// is made absolute FIRST now — a hard-coded `C:\\projects\\app` resolves
	// against the working directory on linux, and the old spec asserted a
	// windows-only answer that a linux runner could never give.
	it("normalises separators, so a Windows root still matches", () => {
		const { dir } = lankaDiSetup({ root });

		expect(dir).toBe(`${root.replace(/\\/g, "/")}/${lankaDiContract.dirname}`);
		expect(dir).not.toContain("\\");
	});

	/*
	 * A bundler's root is allowed to be RELATIVE — `root: "app"` is an ordinary
	 * vite config — and every bundler resolves it against the working directory
	 * before using it. Passed through as written it produced a relative alias,
	 * and a relative alias is not a path: `app/.lanka/Gateways` is a bare
	 * specifier, looked for in `node_modules` and not found. Measured before the
	 * fix, on a real dev server: 500, "Failed to resolve import
	 * @lanka_di/Singletons".
	 *
	 * What hid it is that the directory check still passed — `existsSync`
	 * resolves against the same working directory — so the scaffolding was
	 * correct and only the alias was wrong, and only at import time.
	 */
	it("makes a relative root absolute, so the alias is a path and not a specifier", () => {
		const { dir } = lankaDiSetup({ root: "app" });

		expect(isAbsolute(dir)).toBe(true);
		expect(dir).toBe(`${resolve("app").replace(/\\/g, "/")}/${lankaDiContract.dirname}`);
	});

	// The adapters hand `dir` to a bundler and the CLI prints `dirname`; a setup
	// whose two halves disagreed would alias one directory and report the other.
	it("answers a dirname that is the tail of the dir it resolved", () => {
		const setup = lankaDiSetup({ root });

		expect(setup.dirname).toBe(".lanka");
		expect(setup.dir.endsWith(`/${setup.dirname}`)).toBe(true);
	});

	// The compatibility promise, at the level every bundler is wired through: a
	// project on the older directory keeps it, and the new default never reaches
	// a project that already made a choice.
	it("aliases .lanka_di when that is what the project has", () => {
		mkdirSync(join(root, ".lanka_di"), { recursive: true });

		const setup = lankaDiSetup({ root });

		expect(setup.dirname).toBe(".lanka_di");
		expect(setup.alias[lankaDiContract.alias]).toBe(`${root.replace(/\\/g, "/")}/.lanka_di`);
	});

	it("takes an explicit dirname over what is on disk", () => {
		mkdirSync(join(root, ".lanka_di"), { recursive: true });

		expect(lankaDiSetup({ root, dirname: ".lanka" }).dirname).toBe(".lanka");
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
