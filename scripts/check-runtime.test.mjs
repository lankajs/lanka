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
	frameworkDivergences,
	frameworkInstalledBy,
	frameworkOf,
	frameworksReached,
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

	it("does not see one that is somebody else's member", () => {
		// `document` is what every GraphQL client calls the thing it sends. Read as
		// the DOM global it forces a package to declare a browser it does not need.
		expect(domRequirements("export const x = (op) => op.document;")).toEqual([]);
	});

	it("does not see one that is a key", () => {
		expect(domRequirements("export const x = { document: 1 };")).toEqual([]);
		expect(domRequirements("export interface I { document?: unknown }")).toEqual([]);
	});

	it("still sees an optional read of the real one", () => {
		// `?.` is a member ACCESS: the character after the name is a dot, not a
		// colon, and the global is genuinely required.
		expect(domRequirements("export const x = () => document?.title;")).toEqual(["document"]);
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

describe("the framework axis", () => {
	const files = (entries) => (path) => entries[path];
	const ENTRY = "modules/thing/src/index.ts";
	const bound = (pkg, entries) =>
		frameworkDivergences(
			[{ kind: "module", slug: "thing", ...pkg }],
			() => [ENTRY],
			files(entries),
		);
	const tags = (problems) => problems.map((one) => one.tag);

	describe("recognising a framework from an import", () => {
		it.each([
			["react", "react"],
			["react-dom/client", "react"],
			["@testing-library/react", "react"],
			["vue", "vue"],
			["@vue/reactivity", "vue"],
			["svelte", "svelte"],
			["svelte/reactivity", "svelte"],
			["solid-js", "solid"],
			["@solidjs/testing-library", "solid"],
			["@angular/core", "angular"],
		])("reads %s as %s", (specifier, framework) => {
			expect(frameworkOf(specifier)).toBe(framework);
		});

		it("reads nothing into a package that merely starts with the letters", () => {
			// `@vue` matches by prefix, and the separator is what keeps it from
			// catching a package whose name only begins the same way.
			expect(frameworkOf("@vuelidate/core")).toBeUndefined();
			expect(frameworkOf("solid-js-router-lookalike")).toBeUndefined();
		});

		it("reads bare zustand as React and its React-free subpaths as nothing", () => {
			// `create` calls hooks; `createStore` and the persistence middleware do
			// not, and the framework's own shared store reaches for exactly those.
			expect(frameworkOf("zustand")).toBe("react");
			expect(frameworkOf("zustand/vanilla")).toBeUndefined();
			expect(frameworkOf("zustand/middleware")).toBeUndefined();
		});

		it("does not count a type-only import", () => {
			// A type disappears at compile time. A package that merely DESCRIBES a
			// component requires nothing at runtime.
			const reached = frameworksReached(
				ENTRY,
				files({ [ENTRY]: 'import type { ReactNode } from "react";' }),
			);

			expect([...reached]).toEqual([]);
		});

		it("follows imports across local hops", () => {
			const reached = frameworksReached(
				ENTRY,
				files({
					[ENTRY]: 'export { a } from "./a/aThing";',
					"modules/thing/src/a/aThing.ts":
						'import { ref } from "vue";\nexport const a = ref;',
				}),
			);

			expect([...reached]).toEqual(["vue"]);
		});
	});

	describe("what a dependency INSTALLS, which is a narrower question", () => {
		it("counts the framework itself and its testing library", () => {
			expect(frameworkInstalledBy("react")).toBe("react");
			expect(frameworkInstalledBy("@testing-library/vue")).toBe("vue");
			expect(frameworkInstalledBy("@angular/core")).toBe("angular");
		});

		it("does NOT count zustand, which installs nothing", () => {
			// Measured, not assumed: zustand 5.0.15 has no `dependencies` and
			// declares `react` as an OPTIONAL peer. Depending on it puts React in
			// nobody's install graph — importing its bare entry is the separate
			// question above.
			expect(frameworkInstalledBy("zustand")).toBeUndefined();
		});
	});

	describe("comparing the declaration with the code", () => {
		it("says nothing when a package imports the framework it declares", () => {
			const problems = bound(
				{ framework: "vue", peer: { vue: "^3.5" } },
				{ [ENTRY]: 'import { ref } from "vue";' },
			);

			expect(problems).toEqual([]);
		});

		it("names a package that imports a framework it never declared", () => {
			const problems = bound({}, { [ENTRY]: 'import { useRef } from "react";' });

			expect(tags(problems)).toEqual(["framework-undeclared"]);
			expect(problems[0].message).toContain("no framework");
		});

		it("names a package that imports a DIFFERENT framework than it declared", () => {
			const problems = bound(
				{ framework: "vue", peer: { vue: "^3.5" } },
				{ [ENTRY]: 'import { ref } from "vue";\nimport { useRef } from "react";' },
			);

			expect(tags(problems)).toEqual(["framework-undeclared"]);
			expect(problems[0].where).toContain("react");
		});

		it("names a package that declares one nothing imports", () => {
			// The direction that costs a consumer an install they never needed —
			// and the one that proves phase 14.2 of _plans/14 actually landed,
			// because core's declaration only becomes removable when this fires.
			const problems = bound({ framework: "react" }, { [ENTRY]: "export const a = 1;" });

			expect(tags(problems)).toEqual(["framework-unused"]);
		});

		it("refuses a framework that is not one", () => {
			const problems = bound({ framework: "ember" }, { [ENTRY]: "export const a = 1;" });

			expect(tags(problems)).toEqual(["framework-unknown"]);
		});

		it("stops at an unknown name rather than reporting it twice", () => {
			// An unrecognised declaration cannot be compared with anything, so
			// every later question about it would be noise about the same line.
			const problems = bound(
				{ framework: "ember" },
				{ [ENTRY]: 'import { useRef } from "react";' },
			);

			expect(tags(problems)).toEqual(["framework-unknown"]);
		});
	});

	describe("what the manifest ships, which the code cannot take back", () => {
		it("names a framework shipped by a package that declares none", () => {
			// An import can be deleted while the dependency stays, and the
			// dependency is what an application actually installs.
			const problems = bound(
				{ peer: { react: "^19.2.0" } },
				{ [ENTRY]: "export const a = 1;" },
			);

			expect(tags(problems)).toEqual(["framework-in-manifest"]);
			expect(problems[0].message).toContain("installs react");
		});

		it("allows zustand in a package that declares no framework", () => {
			// The whole reason the two lists are separate. `@lankajs/storage` and
			// `@lankajs/host` peer-depend on zustand for `zustand/middleware` and
			// its types, and neither puts React in a Vue application.
			const problems = bound(
				{ peer: { zustand: "^5.0.10" } },
				{ [ENTRY]: 'import type { StateStorage } from "zustand/middleware";' },
			);

			expect(problems).toEqual([]);
		});

		it("allows the framework a package does declare", () => {
			const problems = bound(
				{ framework: "svelte", peer: { svelte: "^5.7" } },
				{ [ENTRY]: 'import { createSubscriber } from "svelte/reactivity";' },
			);

			expect(problems).toEqual([]);
		});
	});

	describe("the client boundary is React's alone", () => {
		it("does not ask a Vue entry for a directive", () => {
			// RSC is one framework's mechanism. Vue, Svelte, Solid and Angular have
			// no equivalent, and a directive there would be cargo.
			const found = clientBoundary(ENTRY, files({ [ENTRY]: 'import { ref } from "vue";' }));

			expect(found.needs).toBe(false);
		});

		it("still asks a React entry", () => {
			const found = clientBoundary(
				ENTRY,
				files({ [ENTRY]: 'import { render } from "@testing-library/react";' }),
			);

			expect(found.needs).toBe(true);
		});

		it("does not ask a TOOL at all", () => {
			// A tool runs before runtime — build, lint, test — so no server
			// component can import one. The gate asked `@lankajs/tool-testing` for a
			// directive the day the testing library joined the import list, which is
			// how this exemption was found.
			const problems = clientDivergences(
				[{ kind: "tool", slug: "testing" }],
				() => [ENTRY],
				files({ [ENTRY]: 'import { render } from "@testing-library/react";' }),
			);

			expect(problems).toEqual([]);
		});

		it("still asks a module", () => {
			const problems = clientDivergences(
				[{ kind: "module", slug: "thing" }],
				() => [ENTRY],
				files({ [ENTRY]: 'import { render } from "@testing-library/react";' }),
			);

			expect(tags(problems)).toEqual(["client-boundary-missing"]);
		});
	});
});
