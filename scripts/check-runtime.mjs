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

/** Browser globals this file cannot run without. */
export const domRequirements = (source) => {
	const code = withoutInert(source);
	const guarded = guardedNames(source);

	return DOM_GLOBALS.filter(
		(name) => !guarded.has(name) && new RegExp(`\\b${name}\\b`).test(code),
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
 * Packages whose import means the module cannot run in a server component.
 *
 * `zustand` bare is React's binding — `create` calls hooks. `zustand/vanilla`
 * and `zustand/middleware` are not on the list because they are not React, and a
 * list that guessed by prefix would make the persistence middleware client-only
 * for nothing.
 */
export const CLIENT_PACKAGES = Object.freeze([
	Object.freeze({ name: "react", subpaths: true }),
	Object.freeze({ name: "react-dom", subpaths: true }),
	// Bare only. `zustand/vanilla` is `createStore` with no hook in sight, and
	// `zustand/middleware` is persistence — core's shared store and the storage
	// module reach for exactly those, and calling either client-only would put the
	// directive on the framework's root barrel for nothing.
	Object.freeze({ name: "zustand", subpaths: false }),
]);

/** Whether one import specifier is a reach for React. */
export const isClientImport = (specifier) =>
	CLIENT_PACKAGES.some(
		({ name, subpaths }) =>
			specifier === name || (subpaths && specifier.startsWith(`${name}/`)),
	);

/** The directive React Server Components read, exactly as it must be written. */
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
 */
export const clientDivergences = (packages, entriesOf = entryFiles, read = readIfPresent) => {
	const problems = [];

	for (const pkg of packages) {
		for (const entry of entriesOf(pkgDir(pkg))) {
			const { needs, declares } = clientBoundary(entry, read);

			if (needs && !declares) {
				problems.push({
					tag: "client-boundary-missing",
					where: entry,
					message:
						`reaches React (${CLIENT_PACKAGES.map(({ name }) => name).join(", ")}), so a server component ` +
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

	console.log(
		`x every package runs where it says: ${PACKAGES.length} packages — ` +
			`${String(tally((r) => r.length === 3))} universal, ` +
			`${String(tally((r) => r.length === 1 && r[0] === "browser"))} browser-only, ` +
			`${String(tally((r) => r.length === 1 && r[0] === "node"))} node-only; ` +
			`${String(entries.length)} entries, ${String(client)} behind ${CLIENT_DIRECTIVE}`,
	);
}
