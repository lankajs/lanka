import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { resolveLankaDiDir } from "./resolveLankaDiDir";

const roots: string[] = [];

const makeRoot = (...dirs: string[]): string => {
	const root = mkdtempSync(join(tmpdir(), "lanka-resolve-"));
	roots.push(root);
	for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true });
	return root;
};

afterEach(() => {
	while (roots.length > 0) rmSync(roots.pop() as string, { recursive: true, force: true });
});

describe("resolveLankaDiDir", () => {
	it("gives a project with nothing the default, which is what a new project gets", () => {
		const resolved = resolveLankaDiDir(makeRoot());

		expect(resolved.dirname).toBe(".lanka");
		expect(resolved.dirname).toBe(lankaDiContract.dirname);
		expect(resolved.found).toEqual([]);
	});

	// The whole compatibility story in one assertion: upgrading must move nothing.
	// A resolver that answered with the default here would scaffold an empty
	// `.lanka` beside a working `.lanka_di` and start the application on the empty
	// one — with no error, because both directories type-check.
	it("keeps a project that is already on .lanka_di", () => {
		const resolved = resolveLankaDiDir(makeRoot(".lanka_di"));

		expect(resolved.dirname).toBe(".lanka_di");
		expect(resolved.found).toEqual([".lanka_di"]);
	});

	it("keeps a project that is already on .lanka", () => {
		expect(resolveLankaDiDir(makeRoot(".lanka")).dirname).toBe(".lanka");
	});

	it("reports BOTH when both are there, rather than quietly picking one", () => {
		const resolved = resolveLankaDiDir(makeRoot(".lanka", ".lanka_di"));

		expect(resolved.found).toEqual([".lanka", ".lanka_di"]);
	});

	it("obeys an explicit dirname over what is on disk", () => {
		// The migration needs to address a directory that does not exist yet, and a
		// consumer may want the choice written down rather than discovered.
		const resolved = resolveLankaDiDir(makeRoot(".lanka_di"), { dirname: ".lanka" });

		expect(resolved.dirname).toBe(".lanka");
		expect(resolved.found).toEqual([".lanka_di"]);
	});

	// `.lanka` is a name somebody may well give a config FILE. `existsSync` would
	// answer yes to it, resolve six barrels into a file, and report every one of
	// them missing — naming the wrong cause.
	it("does not mistake a FILE named .lanka for the directory", () => {
		const root = makeRoot();
		writeFileSync(join(root, ".lanka"), "not a directory\n", "utf8");

		const resolved = resolveLankaDiDir(root);

		expect(resolved.found).toEqual([]);
	});

	it("answers a posix path, because every bundler compares one", () => {
		expect(resolveLankaDiDir("C:\\projects\\app").path).toBe("C:/projects/app/.lanka");
	});

	it("does not double the separator on a root that ends with one", () => {
		expect(resolveLankaDiDir("/tmp/app/").path).toBe("/tmp/app/.lanka");
	});
});
