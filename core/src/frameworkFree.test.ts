import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The claim the whole of `_plans/14` was written to make, asserted by the
 * package that makes it.
 *
 * `check-runtime` proves it at the gate — it reads every package's graph and
 * prints which ones need a UI framework — and a gate is the right place for a
 * fact about thirty-eight packages. This is the same fact about ONE package, in
 * its own suite, where somebody adding an import meets it in the same run as
 * their change rather than at the end of the chain.
 *
 * It is not a duplicate of the gate. The gate reads what a package DECLARES and
 * resolves; this reads the source text, so a dynamic import, a type-only import
 * and a comment that became code are all visible to it.
 */
const FRAMEWORKS = ["react", "react-dom", "vue", "svelte", "solid-js", "@angular/core", "preact"];

const sourcesOf = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);

		if (entry.isDirectory()) return sourcesOf(path);

		// Specs and benches are excluded: they are not what an application installs,
		// and a scene scanning for a word cannot also contain it.
		const isSource = /\.tsx?$/.test(entry.name);
		const isSpec = /\.(test|bench)\.tsx?$/.test(entry.name);

		return isSource && !isSpec ? [path] : [];
	});

const codeOf = (path: string): string =>
	readFileSync(path, "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\/\/.*$/gm, "");

describe("the framework needs no UI framework", () => {
	it("imports none, in any source file", () => {
		const offenders = sourcesOf("src").flatMap((path) => {
			const code = codeOf(path);

			return FRAMEWORKS.filter(
				(name) => code.includes(`from "${name}`) || code.includes(`import("${name}`),
			).map((name) => `${path} imports ${name}`);
		});

		expect(offenders).toEqual([]);
	});

	it("declares none, in its manifest", () => {
		// An import can be deleted while the dependency stays, and the dependency is
		// what an `npm install lanka` actually pulls down.
		const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
			peerDependencies?: Record<string, string>;
		};
		const declared = Object.keys({
			...manifest.dependencies,
			...manifest.devDependencies,
			...manifest.peerDependencies,
		});

		expect(declared.filter((name) => FRAMEWORKS.some((ui) => name.startsWith(ui)))).toEqual([]);
	});

	it("has no `.tsx` file left in its sources", () => {
		// The last one was `createLankaTrackedHook.bench.tsx`, and a `.tsx` in core
		// is a file that needs a JSX runtime to compile — which is a UI framework by
		// another name.
		expect(sourcesOf("src").filter((path) => path.endsWith(".tsx"))).toEqual([]);
	});

	it("carries no `use client` directive anywhere", () => {
		// React Server Components' mechanism, and core has no hook to protect with
		// it. The directive moved to the bindings' barrels, which is where a hook
		// now lives — and one left behind here would make a server component refuse
		// to import a ViewModel.
		const offenders = sourcesOf("src").filter((path) => codeOf(path).includes("use client"));

		expect(offenders).toEqual([]);
	});

	it("names no framework in what it publishes", () => {
		// A type named for a framework is a promise about one. `TLankaStatelessVMHook`
		// and its sibling are the deprecated exceptions the changeset records: the
		// word is kept because a published name is never removed, and it describes
		// nothing here any more.
		const surface = readFileSync("../api/lanka.api.md", "utf8");
		const suspicious = surface
			.split("\n")
			.filter((line) => /\b(React|Vue|Svelte|Solid|Angular)\b/.test(line));

		expect(suspicious).toEqual([]);
	});
});
