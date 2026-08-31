/**
 * Pins `check-runtime.mjs`: what counts as a requirement, and what a divergence is.
 *
 * The readers are driven directly with source text and declarations, because the
 * subject is the reading. Run against the real repository the spec could only
 * prove today's answer — the one state in which the gate passes.
 */
import { describe, expect, it } from "vitest";
import {
	builtinRequirements,
	clientBoundary,
	clientDivergences,
	divergences,
	domRequirements,
	ENVIRONMENTS,
	guardedNames,
	withoutInert,
} from "./check-runtime.mjs";

const ENTRY = "modules/thing/src/index.ts";
const pkg = (runtime, entries) => [{ kind: "module", slug: "thing", runtime, entries }];
const found = (runtime, requirements, entries) =>
	divergences(pkg(runtime, entries), new Map([[ENTRY, requirements]]), () => [ENTRY]);

describe("reading what a file requires", () => {
	it("sees a browser global used outright", () => {
		expect(domRequirements("export const x = () => document.title;")).toEqual(["document"]);
	});

	it("does NOT see one that is only spoken about", () => {
		// Prose is where `window` appears most often in this repository, and a gate
		// that read comments would force every doc to avoid naming the thing it
		// documents.
		const source =
			"/** Comes from `window.localStorage` — see the note. */\nexport const x = 1;";

		expect(domRequirements(source)).toEqual([]);
	});

	it("does not see one named inside a string", () => {
		expect(domRequirements('throw new Error("no document here");')).toEqual([]);
	});

	it("treats a feature detection as a question, not a requirement", () => {
		const source = 'if (typeof EventSource !== "function") return;\nnew EventSource(url);';

		expect(domRequirements(source)).toEqual([]);
	});

	it("reads `in globalThis` as a detection too", () => {
		expect(domRequirements('if ("indexedDB" in globalThis) indexedDB.open("x");')).toEqual([]);
	});

	it("collects the guarded names of one file only", () => {
		expect([...guardedNames('typeof window === "undefined"')]).toEqual(["window"]);
	});

	it("keeps a template literal from swallowing the rest of the file", () => {
		const code = withoutInert("const a = `x ${1} y`;\nexport const b = () => document.title;");

		expect(code).toContain("document");
	});

	it("reads a node builtin as a requirement no guard can lift", () => {
		// A static import resolves before a line of the module runs, so a `typeof`
		// beside it protects nothing.
		const source = 'import { readFileSync } from "node:fs";\nif (typeof readFileSync) {}';

		expect(builtinRequirements(source)).toEqual(["node:fs"]);
	});
});

describe("comparing a declaration with what the code needs", () => {
	it("says nothing when a browser-only package uses the DOM", () => {
		expect(found(["browser"], [{ file: "a.ts", dom: ["window"], builtins: [] }])).toEqual([]);
	});

	it("names the environments that have no DOM, once", () => {
		const problems = found(
			["browser", "node", "native"],
			[{ file: "a.ts", dom: ["document"], builtins: [] }],
		);

		expect(problems).toHaveLength(1);
		expect(problems[0].tag).toBe("runtime-not-kept");
		expect(problems[0].message).toContain("node");
		expect(problems[0].message).toContain("native");
	});

	it("names a node builtin in a package that does not claim node", () => {
		const problems = found(["browser"], [{ file: "a.ts", dom: [], builtins: ["node:fs"] }]);

		expect(problems).toHaveLength(1);
		expect(problems[0].where).toContain("node:fs");
	});

	it("refuses a package that declares nothing", () => {
		const problems = divergences([{ kind: "module", slug: "thing" }], new Map(), () => [ENTRY]);

		expect(problems[0].tag).toBe("runtime-undeclared");
	});

	it("refuses an environment that is not one", () => {
		const problems = found(["deno"], []);

		expect(problems[0].tag).toBe("runtime-unknown-environment");
	});

	it("lets an entry declare an environment of its own", () => {
		// A package can honestly be two halves: browser code a client component
		// calls, and a subpath that imports a node builtin. What a consumer picks is
		// a subpath, so a subpath is what has to be true.
		const problems = found(
			["browser", "node", "native"],
			[{ file: "a.ts", dom: [], builtins: ["node:async_hooks"] }],
			[{ name: "index", file: "index.ts", runtime: ["node"] }],
		);

		expect(problems).toEqual([]);
	});

	it("keeps `native` meaning neither DOM nor builtins", () => {
		// The reason it is a third answer rather than "browser, roughly": a package
		// that runs on a phone has no `document` AND no `node:fs`.
		expect(ENVIRONMENTS.native).toEqual({ dom: false, builtins: false });
	});
});

describe("the client boundary", () => {
	const files = (entries) => (path) => entries[path];
	const boundary = (entries, entry = "pkg/src/index.ts") => clientBoundary(entry, files(entries));

	it("follows imports rather than folders", () => {
		// core's root barrel sits ABOVE viewmodel/ and does not re-export it. A
		// folder scan would call the whole framework client-only on that basis.
		const found = boundary({
			"pkg/src/index.ts": 'export { a } from "./a/aThing";',
			"pkg/src/a/aThing.ts": "export const a = 1;",
			"pkg/src/hooks/index.ts": 'import { useRef } from "react";',
		});

		expect(found.needs).toBe(false);
	});

	it("sees React reached through two local hops", () => {
		const found = boundary({
			"pkg/src/index.ts": 'export { a } from "./a/aThing";',
			"pkg/src/a/aThing.ts": 'export { b } from "../b/bThing";',
			"pkg/src/b/bThing.ts": 'import { useRef } from "react";\nexport const b = useRef;',
		});

		expect(found.needs).toBe(true);
	});

	it("does not count a type-only import of React", () => {
		// A type disappears at compile time, and a server component importing it
		// runs nothing. Counting it would push the directive onto entries that
		// only DESCRIBE a component.
		const found = boundary({
			"pkg/src/index.ts":
				'import type { ReactNode } from "react";\nexport type T = ReactNode;',
		});

		expect(found.needs).toBe(false);
	});

	it("does not count zustand's React-free subpaths", () => {
		const found = boundary({
			"pkg/src/index.ts": 'import { createStore } from "zustand/vanilla";',
		});

		expect(found.needs).toBe(false);
	});

	it("counts zustand itself, which is the React binding", () => {
		const found = boundary({ "pkg/src/index.ts": 'import { create } from "zustand";' });

		expect(found.needs).toBe(true);
	});

	it("reads the directive only on the first line of the entry", () => {
		const found = boundary({
			"pkg/src/index.ts": 'import { create } from "zustand";\n"use client";',
		});

		expect(found.declares).toBe(false);
	});

	it("names an entry that reaches React without saying so", () => {
		const problems = clientDivergences(
			[{ kind: "core", slug: "core" }],
			() => ["pkg/src/index.ts"],
			files({ "pkg/src/index.ts": 'import { create } from "zustand";' }),
		);

		expect(problems[0].tag).toBe("client-boundary-missing");
	});

	it("names an entry that says so for nothing", () => {
		// The direction that costs a consumer silently: a directive on a React-free
		// entry makes the subpath client-only in every server build.
		const problems = clientDivergences(
			[{ kind: "core", slug: "core" }],
			() => ["pkg/src/index.ts"],
			files({ "pkg/src/index.ts": '"use client";\nexport const a = 1;' }),
		);

		expect(problems[0].tag).toBe("client-boundary-spurious");
	});
});
