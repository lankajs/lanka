import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The four entries a consumer's class imports reach no module that reads a
 * `@lanka_di/*` barrel — `SKILL.md` invariant 11, asserted where somebody adding
 * an import meets it in the same run as their change.
 *
 * A gateway extends `ALankaGateway` from `lanka/gateway`, a scenario
 * `ALankaScenario` from `lanka/scenario`, a shared store `ALankaSharedStore`
 * from `lanka/viewmodel`, a singleton `ALankaSingleton` from `lanka/locator` —
 * and each is published in the barrel the framework reads. An entry that reaches
 * the reader is inside a cycle: the barrel evaluates before the entry's body,
 * and the consumer's class extends `undefined`.
 *
 * `scripts/verify-build.mjs` §1b proves it over the BUILT graph, which is the
 * one a consumer loads and the one in which the 2.2.0 defect showed. This reads
 * the source graph instead, so it sees the edge at the moment it is written —
 * a facade re-exporting its locator class was that edge — and does not wait for
 * the build. The walk follows what evaluates: value imports and re-exports, not
 * `import type`, `export type` or an inline `type` specifier, which the compiler
 * erases.
 */

const ENTRIES: Record<string, string> = {
	"lanka/gateway": "src/gateway/index.ts",
	"lanka/scenario": "src/scenario/index.ts",
	"lanka/viewmodel": "src/viewmodel/index.ts",
	"lanka/locator": "src/locator/index.ts",
};

/** One reader per barrel, all in `locator/` — `barrelReaders` in the registry. */
const READERS = [
	"src/locator/gateway/lanka-gateway-locator/LankaGatewayLocator.ts",
	"src/locator/scenario/lanka-scenario-locator/LankaScenarioLocator.ts",
	"src/locator/shared-store/lanka-shared-store-locator/LankaSharedStoreLocator.ts",
	"src/locator/singleton/lanka-singleton-locator/LankaSingletonLocator.ts",
];

/** Imports a barrel for `typeof` alone; erased by the compiler, and not a reader. */
const TYPE_DERIVATIONS = [
	"src/locator/_types/TLankaSingletons.ts",
	"src/locator/gateway/_types/TLankaGateways.ts",
	"src/locator/scenario/_types/TLankaScenarios.ts",
	"src/locator/shared-store/_types/TLankaSharedStores.ts",
];

const BARREL = /^@lanka_di\//;

const at = (path: string): string => resolve(path);
const relativeToPackage = (file: string): string =>
	file.slice(at(".").length + 1).replaceAll("\\", "/");

const sourcesOf = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return sourcesOf(path);
		return /\.tsx?$/.test(entry.name) && !/\.(test|bench)\.tsx?$/.test(entry.name)
			? [at(path)]
			: [];
	});

const codeOf = (file: string): string =>
	readFileSync(file, "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\/\/.*$/gm, "");

interface IEdge {
	specifier: string;
	/** The names the statement binds — what a value use of the module looks like. */
	bindings: string[];
}

const STATEMENT =
	/(?:^|[;\n])\s*(import|export)\s+(type\s+)?(\*\s*(?:as\s+[\w$]+)?|\{[^}]*\}|[\w$]+(?:\s*,\s*\{[^}]*\})?)\s*from\s*["']([^"']+)["']/g;
const BARE_IMPORT = /(?:^|[;\n])\s*import\s+["']([^"']+)["']/g;

/**
 * The modules a source file puts in the graph at evaluation time.
 *
 * `import type`, `export type` and a clause of inline `type` specifiers are
 * erased and evaluate nothing, so they are not edges. A bare `import "./x"` is.
 */
const valueEdges = (code: string): IEdge[] => {
	const edges: IEdge[] = [];

	for (const [, , typeOnly, clause, specifier] of code.matchAll(STATEMENT)) {
		if (typeOnly) continue;
		const names = clause
			.replace(/^\*\s*as\s+/, "")
			.replace(/[{}]/g, "")
			.split(",")
			.map((name) => name.trim())
			.filter((name) => name.length > 0 && name !== "*");
		if (clause.startsWith("{") && names.every((name) => /^type\s/.test(name))) continue;

		edges.push({
			specifier,
			bindings: names
				.filter((name) => !/^type\s/.test(name))
				.map((name) => name.replace(/^.*\s+as\s+/, "")),
		});
	}
	for (const [, specifier] of code.matchAll(BARE_IMPORT)) {
		edges.push({ specifier, bindings: [] });
	}

	return edges;
};

const resolveRelative = (from: string, specifier: string): string | undefined => {
	const base = resolve(dirname(from), specifier);
	return [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((candidate) =>
		existsSync(candidate),
	);
};

/**
 * Whether the file reads a barrel — imports it and uses the binding as a value.
 *
 * `typeof SingletonsModule` is a type position: the compiler erases the import
 * with it, so the four `_types/` files derive from a barrel without reading one.
 */
const readsBarrel = (file: string): boolean => {
	const code = codeOf(file);
	const body = code.replace(STATEMENT, "").replace(BARE_IMPORT, "");

	return valueEdges(code).some(
		({ specifier, bindings }) =>
			BARREL.test(specifier) &&
			(bindings.length === 0 ||
				bindings.some((name) => new RegExp(`(?<!typeof\\s+)\\b${name}\\b`).test(body))),
	);
};

/** Every source file the entry evaluates, transitively, by relative specifier. */
const reachableFrom = (entry: string): Set<string> => {
	const seen = new Set<string>();
	const stack = [at(entry)];

	while (stack.length > 0) {
		const file = stack.pop() as string;
		if (seen.has(file)) continue;
		seen.add(file);

		for (const { specifier } of valueEdges(codeOf(file))) {
			if (!specifier.startsWith(".")) continue;
			const target = resolveRelative(file, specifier);
			if (target) stack.push(target);
		}
	}

	return seen;
};

const readersReachedFrom = (entry: string): string[] =>
	[...reachableFrom(entry)].filter(readsBarrel).map(relativeToPackage).sort();

describe("the entries a consumer's class imports", () => {
	it.each(Object.entries(ENTRIES))("%s reaches no barrel reader", (_entry, file) => {
		// The 2.2.0 edge: `lankaSingletons.ts` re-exported `LankaSingletonLocator`
		// for `lanka/extend`, and `lanka/locator` reached `@lanka_di/Singletons`.
		expect(readersReachedFrom(file)).toEqual([]);
	});

	it("are reached by nothing a reader imports — the cycle has no entry", () => {
		const entries = new Set(Object.values(ENTRIES).map(at));
		const reachedByReaders = READERS.flatMap((reader) =>
			[...reachableFrom(reader)].filter((file) => entries.has(file)).map(relativeToPackage),
		);

		expect(reachedByReaders).toEqual([]);
	});
});

describe("the walk itself", () => {
	it("sees a reader: the root entry constructs every locator, so it reaches all four", () => {
		// The positive control. A walk that skipped every edge, or a reader test
		// that never matched, would pass the four assertions above by seeing nothing.
		expect(readersReachedFrom("src/index.ts")).toEqual([...READERS].sort());
	});

	it("follows a bare import and a re-export, and skips what the compiler erases", () => {
		const code = [
			'import "./polyfill";',
			'import { a, type B } from "./a";',
			'import { type C, type D } from "./types-only";',
			'import type { E } from "./e";',
			'export { f } from "./f";',
			'export type { G } from "./g";',
			'export * from "./h";',
			'import * as Barrel from "@lanka_di/Gateways";',
		].join("\n");

		expect(valueEdges(code).map(({ specifier }) => specifier)).toEqual([
			"./a",
			"./f",
			"./h",
			"@lanka_di/Gateways",
			"./polyfill",
		]);
	});
});

describe("one reader per barrel", () => {
	it("every source file that reads a barrel is one of the four, in `locator/`", () => {
		expect(sourcesOf("src").filter(readsBarrel).map(relativeToPackage).sort()).toEqual(
			[...READERS].sort(),
		);
	});

	it("the four read four different barrels", () => {
		const barrels = READERS.flatMap((reader) =>
			valueEdges(codeOf(at(reader)))
				.map(({ specifier }) => specifier)
				.filter((specifier) => BARREL.test(specifier)),
		);

		expect(barrels.sort()).toEqual([
			"@lanka_di/Gateways",
			"@lanka_di/Scenarios",
			"@lanka_di/SharedStores",
			"@lanka_di/Singletons",
		]);
	});

	it("a type derived from a barrel is not a read — and the exemption is consulted", () => {
		// The files that import a barrel and are NOT readers must be exactly the
		// four type derivations. Were the `typeof` exemption too wide, a real
		// reader could hide in it; too narrow, and the derivations would fail the
		// assertion above.
		const importing = sourcesOf("src").filter((file) =>
			valueEdges(codeOf(file)).some(({ specifier }) => BARREL.test(specifier)),
		);
		const erased = importing.filter((file) => !readsBarrel(file)).map(relativeToPackage);

		expect(erased.sort()).toEqual([...TYPE_DERIVATIONS].sort());
	});
});
