/**
 * Checks that every package runs where it says it runs.
 *
 * The canon is `skills/hosts/SKILL.md` §1 and §2; this is its executable half.
 *
 * ## The defect that produced the rule
 *
 * "Which of these packages work in a Next server component, or on a phone?" had
 * no answer but reading the sources of eighteen packages. Consumers guessed, and
 * a guess that goes the wrong way is a `ReferenceError` from inside the framework
 * on somebody's production render — three layers from the import that decided it.
 *
 * ## Why a guard changes the answer
 *
 * `typeof EventSource === "function"` is a package ASKING whether it can do
 * something. An unguarded `document.title` is a package REQUIRING it. Only the
 * second narrows where the package runs, so only the second is measured — and
 * guards are read per file, because a guard three files away guards nothing.
 *
 * Run: node scripts/check-runtime.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PACKAGES, pkgDir, pkgName } from "./registry.mjs";

/**
 * The three environments, and what each one has.
 *
 * `native` provides neither: React Native has no DOM and no node builtins, which
 * is why it is a separate answer rather than "browser, roughly".
 */
export const ENVIRONMENTS = Object.freeze({
	browser: Object.freeze({ dom: true, builtins: false }),
	node: Object.freeze({ dom: false, builtins: true }),
	native: Object.freeze({ dom: false, builtins: false }),
});

/**
 * Globals that exist in a browser and nowhere else.
 *
 * Curated rather than exhaustive: a name on this list must be unambiguous, since
 * a false positive here forces somebody to weaken a declaration that was true.
 */
export const DOM_GLOBALS = Object.freeze([
	"window",
	"document",
	"localStorage",
	"sessionStorage",
	"indexedDB",
	"IDBDatabase",
	"IDBFactory",
	"caches",
	"CacheStorage",
	"EventSource",
	"XMLHttpRequest",
	"HTMLElement",
	"matchMedia",
	"requestAnimationFrame",
	"requestIdleCallback",
]);

/** Comments, where prose mentions `window` without using it. */
export const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

/**
 * Comments and string bodies both.
 *
 * Two strippers rather than one, because the evidence lives in different text: an
 * identifier is code, while `"node:fs"` and `"indexedDB" in globalThis` ARE
 * strings and disappear from a reader that removes them.
 */
export const withoutInert = (source) =>
	withoutComments(source)
		.replace(/`(?:\\.|[^`\\])*`/g, "``")
		.replace(/"(?:\\.|[^"\\\n])*"/g, '""')
		.replace(/'(?:\\.|[^'\\\n])*'/g, "''");

/** Names this file feature-detects, and therefore does not require. */
export const guardedNames = (source) => {
	const guarded = new Set();

	for (const [, name] of withoutInert(source).matchAll(/typeof\s+([A-Za-z_$][\w$]*)/g))
		guarded.add(name);
	for (const [, name] of withoutComments(source).matchAll(
		/["']([A-Za-z_$][\w$]*)["']\s+in\s+globalThis/g,
	))
		guarded.add(name);

	return guarded;
};

/**
 * Browser globals this file cannot run without.
 *
 * A global is READ, and two shapes that spell the same letters are not reads:
 * a member (`operation.document`) and a key (`{ document: … }`, or a field in an
 * interface). Both were false positives, and the cost of one is stated at the
 * top of `DOM_GLOBALS` — it forces somebody to weaken a declaration that was
 * true. `document` is the case that found it: it is the word every GraphQL
 * client uses for the thing it sends, and a package naming its own field that
 * was told it needs a DOM.
 *
 * `document?.title` is still a read: `?.` is a member ACCESS, and the character
 * after the name is a dot rather than a colon.
 */
export const domRequirements = (source) => {
	const code = withoutInert(source);
	const guarded = guardedNames(source);

	return DOM_GLOBALS.filter(
		(name) =>
			!guarded.has(name) && new RegExp(`(?<![.?\\w$])${name}\\b(?!\\s*\\??:)`).test(code),
	);
};

/**
 * Node builtins this file imports.
 *
 * A static import cannot be guarded — it resolves before a line of the module
 * runs — so every one of these is a requirement.
 */
export const builtinRequirements = (source) => {
	const code = withoutComments(source);
	const specifiers = new Set();
	for (const [, name] of code.matchAll(/["']node:([a-z_/]+)["']/g))
		specifiers.add(`node:${name}`);
	return [...specifiers];
};

/**
 * What importing each UI framework looks like, by the name a package declares.
 *
 * The second axis of `skills/hosts/SKILL.md` §1: `runtime` says WHERE a package
 * can run, `framework` says what must already be installed for it to run at all.
 * A package may import only the framework it declares, and must import the one
 * it declares — so this table is what both halves of that sentence are read
 * against.
 *
 * `zustand` bare is React's binding — `create` calls hooks — and it sits under
 * `react` for that reason alone. `zustand/vanilla` and `zustand/middleware` are
 * NOT here: they are `createStore` and persistence, no hook in either, and a
 * list that guessed by prefix would make the framework's own shared store
 * React-only.
 *
 * Scoped entries match by prefix: `@vue` catches `@vue/reactivity` without
 * catching a package merely starting with those letters, because the comparison
 * below appends the separator.
 *
 * ## `installs`, and the one entry that does not
 *
 * Two different questions are asked of this table, and conflating them produced
 * a false positive on the day it was written:
 *
 * - **importing this means the framework must be RUNNING** — every entry;
 * - **depending on this means the framework is INSTALLED** — `installs`.
 *
 * `zustand` is the entry where they differ, and the difference was measured
 * rather than assumed: zustand 5.0.15 has NO `dependencies` at all and declares
 * `react` as an OPTIONAL peer, and its `vanilla` and `middleware` builds contain
 * zero import statements and zero occurrences of the word. So a package may
 * depend on zustand without putting React in anybody's install graph — while
 * importing its BARE entry still means React is running, because that entry is
 * the hook binding.
 *
 * A testing library installs: `@testing-library/react` cannot render without
 * React, and its own peer declaration says so.
 */
export const FRAMEWORK_PACKAGES = Object.freeze({
	react: Object.freeze([
		Object.freeze({ name: "react", subpaths: true, installs: true }),
		Object.freeze({ name: "react-dom", subpaths: true, installs: true }),
		Object.freeze({ name: "@testing-library/react", subpaths: true, installs: true }),
		// Bare only, and it installs nothing — see above. `zustand/vanilla` is
		// `createStore` with no hook in sight and `zustand/middleware` is
		// persistence; core's shared store and the storage module reach for exactly
		// those, and calling either React would make the framework's own barrel
		// client-only for nothing.
		Object.freeze({ name: "zustand", subpaths: false, installs: false }),
	]),
	vue: Object.freeze([
		Object.freeze({ name: "vue", subpaths: true, installs: true }),
		Object.freeze({ name: "@vue", subpaths: true, installs: true }),
		Object.freeze({ name: "@testing-library/vue", subpaths: true, installs: true }),
	]),
	svelte: Object.freeze([
		Object.freeze({ name: "svelte", subpaths: true, installs: true }),
		Object.freeze({ name: "@testing-library/svelte", subpaths: true, installs: true }),
	]),
	solid: Object.freeze([
		Object.freeze({ name: "solid-js", subpaths: true, installs: true }),
		Object.freeze({ name: "@solidjs/testing-library", subpaths: true, installs: true }),
	]),
	angular: Object.freeze([
		Object.freeze({ name: "@angular", subpaths: true, installs: true }),
		Object.freeze({ name: "@testing-library/angular", subpaths: true, installs: true }),
	]),
});

/** Every framework this repository knows how to recognise. */
export const FRAMEWORKS = Object.freeze(Object.keys(FRAMEWORK_PACKAGES));

const matches = (specifier) => (entry) =>
	specifier === entry.name || (entry.subpaths && specifier.startsWith(`${entry.name}/`));

/** Whether one import specifier is a reach for the named framework. */
export const isFrameworkImport = (specifier, framework) =>
	(FRAMEWORK_PACKAGES[framework] ?? []).some(matches(specifier));

/** The framework one import specifier belongs to, or `undefined`. */
export const frameworkOf = (specifier) =>
	FRAMEWORKS.find((framework) => isFrameworkImport(specifier, framework));

/**
 * The framework a DEPENDENCY name puts in a consumer's install graph.
 *
 * Narrower than `frameworkOf` by exactly one entry, and the reason is in the
 * table above: importing `zustand` means React is running, depending on it does
 * not mean React is installed.
 */
export const frameworkInstalledBy = (name) =>
	FRAMEWORKS.find((framework) =>
		FRAMEWORK_PACKAGES[framework].some((entry) => entry.installs && matches(name)(entry)),
	);

/**
 * Whether one import specifier is a reach for React.
 *
 * Kept as its own name because the client boundary below is a REACT question,
 * not a framework question — see `CLIENT_DIRECTIVE`.
 */
export const isClientImport = (specifier) => isFrameworkImport(specifier, "react");

/**
 * The directive React Server Components read, exactly as it must be written.
 *
 * RSC is one framework's mechanism, not a general client boundary. Vue, Svelte,
 * Solid and Angular have no equivalent and no use for the directive, so the
 * check below is keyed on React's import list alone — an entry reaching `vue` is
 * not a client entry, it is a Vue entry.
 */
export const CLIENT_DIRECTIVE = '"use client";';

/** A file's text, or `undefined` when it is not there. */
export const readIfPresent = (path) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);

/** Value imports of one file, local and bare, with `import type` left out. */
export const valueImports = (source) => {
	const code = withoutComments(source);
	const specifiers = [];

	for (const [, specifier] of code.matchAll(
		/^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm,
	))
		specifiers.push(specifier);
	for (const [, specifier] of code.matchAll(/^\s*import\s+["']([^"']+)["']/gm))
		specifiers.push(specifier);

	return specifiers;
};

/**
 * Every local file an entry pulls in, the entry included.
 *
 * A real graph rather than "everything under the entry's folder": core's root
 * barrel sits above `viewmodel/` and does not re-export it, and a folder scan
 * would call the whole framework client-only on that basis alone.
 */
export const localGraph = (entry, read = readIfPresent) => {
	const seen = new Set();
	const queue = [entry];

	while (queue.length > 0) {
		const file = queue.shift();
		if (seen.has(file)) continue;
		const source = read(file);
		if (source === undefined) continue;
		seen.add(file);

		const dir = file.slice(0, file.lastIndexOf("/"));
		for (const specifier of valueImports(source).filter((s) => s.startsWith("."))) {
			// Three candidates because a specifier carries no extension: the file,
			// the component file, or the folder's barrel. The reader answers which
			// of them is there, so this stays testable without a filesystem.
			const base = new URL(specifier, `file:///${dir}/`).pathname.slice(1);
			queue.push(`${base}.ts`, `${base}.tsx`, `${base}/index.ts`);
		}
	}

	return [...seen];
};

/** Whether an entry needs `"use client"`, and whether it says so. */
export const clientBoundary = (entry, read = readIfPresent) => {
	const graph = localGraph(entry, read);
	const needs = graph.some((file) => valueImports(read(file) ?? "").some(isClientImport));
	const declares = (read(entry) ?? "").trimStart().startsWith(CLIENT_DIRECTIVE);

	return { needs, declares, files: graph.length };
};

/** Every framework an entry reaches through its local graph. */
export const frameworksReached = (entry, read = readIfPresent) => {
	const found = new Set();

	for (const file of localGraph(entry, read)) {
		for (const specifier of valueImports(read(file) ?? "")) {
			const framework = frameworkOf(specifier);
			if (framework) found.add(framework);
		}
	}

	return found;
};

/**
 * What diverges on the framework axis.
 *
 * Four questions, and the last one is about the MANIFEST rather than the code:
 *
 * 1. does an entry import a framework the package never declared;
 * 2. does the package declare one no entry imports;
 * 3. is the declared name a framework at all;
 * 4. does a package with NO framework ship one to consumers anyway.
 *
 * The fourth is the one a reader will want the reason for. An import can be
 * removed while the dependency stays, and a dependency is what a consumer
 * actually installs: `lanka` peer-depending on `react` puts React in the
 * install graph of a Vue application whether or not a single line imports it.
 * The gate therefore reads both, and the registry is where it reads the second —
 * `package.json` is generated from it, so checking the manifest would be
 * checking the output of the thing being checked.
 *
 * `zustand` is the case that makes this precise and is why it is allowed to
 * stay: its bare entry is React's binding and is listed under `react`, while
 * `zustand/vanilla` and `zustand/middleware` import NOTHING — measured, zero
 * import statements in either file — and the package itself declares `react` as
 * an OPTIONAL peer with no dependencies of its own. So a package may depend on
 * `zustand` without declaring a framework, and the import list above is what
 * keeps that honest: reach for the bare entry and question 1 fires.
 */
export const frameworkDivergences = (packages, entriesOf = entryFiles, read = readIfPresent) => {
	const problems = [];

	for (const pkg of packages) {
		const dir = pkgDir(pkg);
		const declared = pkg.framework;

		if (declared !== undefined && !FRAMEWORKS.includes(declared)) {
			problems.push({
				tag: "framework-unknown",
				where: `${dir} → ${declared}`,
				message:
					`is not a framework this repository recognises. The list is ` +
					`${FRAMEWORKS.join(", ")} — add it to FRAMEWORK_PACKAGES in ` +
					"scripts/check-runtime.mjs and FRAMEWORKS in scripts/registry.mjs first.",
			});
			continue;
		}

		const reached = new Set();
		for (const entry of entriesOf(dir))
			for (const framework of frameworksReached(entry, read)) reached.add(framework);

		for (const framework of [...reached].filter((one) => one !== declared)) {
			problems.push({
				tag: "framework-undeclared",
				where: `${dir} → ${framework}`,
				message:
					`imports ${framework} and declares ` +
					`${declared === undefined ? "no framework" : `\`${declared}\``}. ` +
					"A package requires the framework it imports — add `framework` to its " +
					"entry in scripts/registry.mjs, or stop importing it.",
			});
		}

		if (declared !== undefined && !reached.has(declared)) {
			problems.push({
				tag: "framework-unused",
				where: `${dir} → ${declared}`,
				message:
					`declares \`${declared}\` and no published entry imports it. A declared ` +
					"framework is a peer a consumer installs, so an unused one is an " +
					"install nobody needed — remove `framework` from its entry in " +
					"scripts/registry.mjs.",
			});
		}

		// The manifest half. A framework left in `deps` or `peer` reaches the
		// consumer's install graph even after the last import of it is gone.
		const shipped = { ...(pkg.deps ?? {}), ...(pkg.peer ?? {}) };

		for (const [name, framework] of Object.entries(shipped)
			.map(([name]) => [name, frameworkInstalledBy(name)])
			.filter(([, framework]) => framework !== undefined && framework !== declared)) {
			problems.push({
				tag: "framework-in-manifest",
				where: `${dir} → ${name}`,
				message:
					`ships \`${name}\` to consumers and declares ` +
					`${declared === undefined ? "no framework" : `\`${declared}\``}. ` +
					`Every application installing this package installs ${framework}, ` +
					"whether or not it uses it — drop the dependency, or declare the " +
					"framework in scripts/registry.mjs.",
			});
		}
	}

	return problems;
};

/**
 * The environments declared for each of a package's entries.
 *
 * Per ENTRY and not per package, because a package can honestly be two halves:
 * `@lankajs/host` is browser code a client component calls, plus `/server`, which
 * imports `node:async_hooks`. What a consumer picks is a subpath, so a subpath is
 * what has to be true.
 *
 * An entry with nothing of its own inherits the package's declaration.
 */
export const entryRuntimes = (pkg, dir = pkgDir(pkg)) =>
	new Map(
		(pkg.entries ?? [])
			.filter((entry) => entry.runtime)
			.map((entry) => [`${dir}/src/${entry.file}`, entry.runtime]),
	);

/**
 * What diverges: a missing declaration, an unknown environment, and an entry
 * whose imports reach for something its declared environments do not have.
 */
export const divergences = (packages, requirementsByEntry, entriesOf = entryFiles) => {
	const problems = [];

	for (const pkg of packages) {
		const dir = pkgDir(pkg);
		const declared = pkg.runtime;

		if (!Array.isArray(declared) || declared.length === 0) {
			problems.push({
				tag: "runtime-undeclared",
				where: dir,
				message:
					"has no `runtime` in scripts/registry.mjs. Say which of browser, node, " +
					"native it runs in — all three when it runs everywhere.",
			});
			continue;
		}

		for (const name of declared.filter((env) => !(env in ENVIRONMENTS))) {
			problems.push({
				tag: "runtime-unknown-environment",
				where: `${dir} → ${name}`,
				message: `is not an environment. The list is ${Object.keys(ENVIRONMENTS).join(", ")}.`,
			});
		}

		const perEntry = entryRuntimes(pkg, dir);

		for (const entry of entriesOf(dir)) {
			const known = (perEntry.get(entry) ?? declared).filter((env) => env in ENVIRONMENTS);

			// One problem per file and per kind of requirement, naming every
			// environment that lacks it: three copies of one defect is three people
			// reading the same line before noticing it is the same line.
			const withoutDom = known.filter((env) => !ENVIRONMENTS[env].dom);
			const withoutBuiltins = known.filter((env) => !ENVIRONMENTS[env].builtins);

			for (const { file, dom, builtins } of requirementsByEntry.get(entry) ?? []) {
				if (dom.length > 0 && withoutDom.length > 0) {
					problems.push({
						tag: "runtime-not-kept",
						where: `${entry} → ${file} → ${dom.join(", ")}`,
						message:
							`${pkgName(pkg)} declares \`${withoutDom.join("`, `")}\` for this entry, ` +
							"which has no DOM. Guard the reference with `typeof`, move it behind an " +
							"entry of its own, or narrow `runtime` in scripts/registry.mjs.",
					});
				}

				if (builtins.length > 0 && withoutBuiltins.length > 0) {
					problems.push({
						tag: "runtime-not-kept",
						where: `${entry} → ${file} → ${builtins.join(", ")}`,
						message:
							`${pkgName(pkg)} declares \`${withoutBuiltins.join("`, `")}\` for this ` +
							"entry, which has no node builtins. A builtin belongs behind its own " +
							"entry point — see skills/hosts/SKILL.md §3.",
					});
				}
			}
		}
	}

	return problems;
};

/** The source file behind every subpath a package publishes. */
export const entryFiles = (dir) => {
	const manifest = JSON.parse(readFileSync(`${dir}/package.json`, "utf8"));
	return Object.values(manifest.exports ?? {}).map((rel) => `${dir}/${rel.replace(/^\.\//, "")}`);
};

/**
 * What diverges at the client boundary: an entry that needs the directive and
 * does not carry it, and one that carries it for nothing.
 *
 * The second direction matters as much as the first. A directive on an entry that
 * touches no React makes the whole subtree client-only in every consumer's Next
 * build — a silent loss of exactly what the subpaths were split to keep.
 *
 * ## Tools are not asked
 *
 * `kind: "tool"` is defined by its own rule in the registry — "runs before
 * runtime: build, lint, test" — and the client boundary is a RUNTIME question:
 * it exists because a React Server Component may not import a hook. Nothing
 * renders a bundler plugin, an eslint rule or a test kit, so there is no server
 * component for the directive to protect.
 *
 * Found by the gate itself, the day `@testing-library/react` joined the import
 * list: it asked `@lankajs/tool-testing` to declare a client boundary, which
 * would have put `"use client"` on a package `runtime: ["node"]` that no
 * application bundles. An exemption written to silence a gate is how a gate
 * stops meaning anything; this one is written because the question does not
 * apply, and the registry already says why.
 */
export const clientDivergences = (packages, entriesOf = entryFiles, read = readIfPresent) => {
	const problems = [];

	for (const pkg of packages.filter((one) => one.kind !== "tool")) {
		for (const entry of entriesOf(pkgDir(pkg))) {
			const { needs, declares } = clientBoundary(entry, read);

			if (needs && !declares) {
				problems.push({
					tag: "client-boundary-missing",
					where: entry,
					message:
						`reaches React (${FRAMEWORK_PACKAGES.react.map(({ name }) => name).join(", ")}), so a server component ` +
						`importing it is a build error. Put ${CLIENT_DIRECTIVE} on the first line ` +
						"of this barrel — the build carries it through to `dist`.",
				});
			}

			if (!needs && declares) {
				problems.push({
					tag: "client-boundary-spurious",
					where: entry,
					message:
						`carries ${CLIENT_DIRECTIVE} and imports no React. It makes this subpath ` +
						"client-only in every consumer's server build for nothing — remove it.",
				});
			}
		}
	}

	return problems;
};

/**
 * What every published entry requires, by entry file.
 *
 * Reached through the import graph rather than by listing a folder: what a
 * consumer imports is a subpath, and a file no subpath reaches cannot break
 * anybody's build.
 */
export const requirementsByEntry = (packages, entriesOf = entryFiles, read = readIfPresent) => {
	const byEntry = new Map();

	for (const pkg of packages) {
		for (const entry of entriesOf(pkgDir(pkg))) {
			const found = [];

			for (const file of localGraph(entry, read)) {
				const source = read(file) ?? "";
				const dom = domRequirements(source);
				const builtins = builtinRequirements(source);
				if (dom.length > 0 || builtins.length > 0) found.push({ file, dom, builtins });
			}

			byEntry.set(entry, found);
		}
	}

	return byEntry;
};

const problems = [];

export const run = () => {
	problems.length = 0;
	problems.push(...divergences(PACKAGES, requirementsByEntry(PACKAGES)));
	problems.push(...clientDivergences(PACKAGES));
	problems.push(...frameworkDivergences(PACKAGES));
	return problems;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	run();

	if (problems.length > 0) {
		console.error(
			`X DIVERGES FROM THE CANON (${problems.length})\n\n` +
				problems.map((p) => `[${p.tag}] ${p.where}\n    ${p.message}`).join("\n\n") +
				"\n\nCanon: skills/hosts/SKILL.md",
		);
		process.exit(1);
	}

	const tally = (predicate) => PACKAGES.filter((p) => predicate(p.runtime ?? [])).length;
	const entries = PACKAGES.flatMap((p) => entryFiles(pkgDir(p)));
	const client = entries.filter((entry) => clientBoundary(entry).declares).length;
	const bound = PACKAGES.filter((p) => p.framework !== undefined);

	console.log(
		`x every package runs where it says: ${PACKAGES.length} packages — ` +
			`${String(tally((r) => r.length === 3))} universal, ` +
			`${String(tally((r) => r.length === 1 && r[0] === "browser"))} browser-only, ` +
			`${String(tally((r) => r.length === 1 && r[0] === "node"))} node-only; ` +
			`${String(entries.length)} entries, ${String(client)} behind ${CLIENT_DIRECTIVE}; ` +
			`${String(PACKAGES.length - bound.length)} need no UI framework` +
			(bound.length > 0
				? `, ${bound.map((p) => `${pkgName(p)} needs ${p.framework}`).join(", ")}`
				: ""),
	);
}
