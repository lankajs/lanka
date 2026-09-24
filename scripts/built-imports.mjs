/**
 * What a built file imports, and what it reaches.
 *
 * Read by `verify-build.mjs` §1b over `dist`: an entry a consumer's own class
 * imports may reach no module that reads a `@lanka_di/*` barrel, or the entry is
 * inside a cycle whose evaluation order the build decides.
 *
 * Both forms a static import takes are counted. esbuild pulls a chunk in for its
 * side effects as a BARE import — `import "./chunk-X.js";` — with no `from`, and
 * that is the form a barrel reader arrives in: the entry names none of the
 * reader's bindings, so nothing is imported FROM it. A reader that counted only
 * `from "…"` passed `lanka/locator` while it reached the Singletons reader, and a
 * consumer whose first lanka import was `lanka/locator` met an undefined
 * `ALankaSingleton`.
 *
 * Canon: skills/gates/SKILL.md — a check that cannot fail reports success.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const readBuilt = (file) => (existsSync(file) ? readFileSync(file, "utf8") : undefined);

/**
 * The relative specifiers a built module evaluates, in order of appearance:
 * `import … from "./x"`, `export … from "./x"` and the bare `import "./x"`.
 *
 * A dynamic `import("./x")` is deliberately absent: it evaluates when called, not
 * when the module does, so it cannot put the module inside an evaluation cycle.
 */
export const relativeImports = (source) => {
	const found = [];
	for (const match of source.matchAll(/\bfrom\s+"(\.[^"]+)"/g)) {
		found.push({ at: match.index, specifier: match[1] });
	}
	for (const match of source.matchAll(/(?:^|[;\n])\s*import\s+"(\.[^"]+)"/g)) {
		found.push({ at: match.index, specifier: match[1] });
	}
	return [...new Set(found.sort((a, b) => a.at - b.at).map(({ specifier }) => specifier))];
};

/**
 * Whether the module statically imports a consumer barrel.
 *
 * The specifier must follow `from` or a bare `import`: an error message that
 * names the barrel in prose is not a read.
 */
export const readsBarrel = (source) =>
	/(?:\bfrom|(?:^|[;\n])\s*import)\s+"@lanka_di\//.test(source);

/**
 * Every file an entry evaluates, transitively, the entry included. `read` is
 * injected so a spec can hand the reader a graph without a disk; a file it
 * answers `undefined` for is outside the graph and is not followed.
 */
export const reachableFrom = (entry, read = readBuilt) => {
	const seen = new Set();
	const stack = [entry];

	while (stack.length > 0) {
		const file = stack.pop();
		if (seen.has(file)) continue;
		const source = read(file);
		if (source === undefined) continue;
		seen.add(file);

		for (const specifier of relativeImports(source)) {
			stack.push(resolve(dirname(file), specifier));
		}
	}

	return seen;
};

/** The files an entry reaches that read a consumer barrel. */
export const barrelReadersReachedFrom = (entry, read = readBuilt) =>
	[...reachableFrom(entry, read)].filter((file) => readsBarrel(read(file)));
