/**
 * Pins `built-imports.mjs`: which imports a built module is read to make, and
 * what an entry therefore reaches.
 *
 * The readers are driven with source text and an in-memory graph, because the
 * subject is the reading. Run against the real `dist` the spec could only prove
 * today's layout — the one state in which the gate passes.
 */
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	barrelReadersReachedFrom,
	reachableFrom,
	readsBarrel,
	relativeImports,
} from "./built-imports.mjs";

const at = (name) => resolve("/dist", name);
const graph = (files) => (file) => files[file];

describe("reading what a built module imports", () => {
	it("sees a named import and a re-export", () => {
		const source =
			'import {\n  proxy\n} from "../chunk-A.js";\nexport { thing } from "./thing.js";\n';
		expect(relativeImports(source)).toEqual(["../chunk-A.js", "./thing.js"]);
	});

	it("sees a BARE import — the form esbuild gives a chunk pulled in for its side effects", () => {
		// This is the form a barrel reader arrives in: the entry names none of its
		// bindings, so nothing is imported FROM it, and a reader that counted only
		// `from "…"` walked past it.
		const source = 'import { x } from "../chunk-A.js";\nimport "../chunk-B.js";\nvar y = 1;\n';
		expect(relativeImports(source)).toEqual(["../chunk-A.js", "../chunk-B.js"]);
	});

	it("does NOT see a package import or a dynamic import", () => {
		const source =
			'import { createLanka } from "lanka";\nconst lazy = () => import("./lazy.js");\n';
		expect(relativeImports(source)).toEqual([]);
	});

	it("names each specifier once, in order of first appearance", () => {
		const source =
			'import "./b.js";\nimport { a } from "./a.js";\nexport { b } from "./b.js";\n';
		expect(relativeImports(source)).toEqual(["./b.js", "./a.js"]);
	});
});

describe("recognising a barrel reader", () => {
	it("is a module that imports a consumer barrel, whole or by name", () => {
		expect(readsBarrel('import * as SingletonsModule from "@lanka_di/Singletons";')).toBe(true);
		expect(readsBarrel('import "@lanka_di/Contract";')).toBe(true);
	});

	it("is NOT a module whose message names the barrel", () => {
		const source =
			'throw new Error("Make sure the class is exported from @lanka_di/Singletons.ts");';
		expect(readsBarrel(source)).toBe(false);
	});
});

describe("what an entry reaches", () => {
	it("names a reader reached only through a bare import", () => {
		// The 2.2.0 layout of `lanka/locator`: the reader chunk is imported for its
		// side effects, and the base class the consumer extends is defined in the
		// entry's own body, below every hoisted import.
		const files = {
			[at("locator/index.js")]:
				'import {\n  proxy\n} from "../chunk-A.js";\nimport "../chunk-B.js";\nvar ALankaSingleton = class {};\n',
			[at("chunk-A.js")]: "function proxy() {}\nexport { proxy };\n",
			[at("chunk-B.js")]: 'import * as SingletonsModule from "@lanka_di/Singletons";\n',
		};

		expect(barrelReadersReachedFrom(at("locator/index.js"), graph(files))).toEqual([
			at("chunk-B.js"),
		]);
	});

	it("follows a chunk's own imports, and a cycle ends the walk rather than the process", () => {
		const files = {
			[at("index.js")]: 'import { a } from "./chunk-A.js";\n',
			[at("chunk-A.js")]: 'import { b } from "./chunk-B.js";\nexport { b as a };\n',
			[at("chunk-B.js")]:
				'import "./chunk-A.js";\nimport * as Gateways from "@lanka_di/Gateways";\n',
		};

		expect([...reachableFrom(at("index.js"), graph(files))].sort()).toEqual(
			[at("index.js"), at("chunk-A.js"), at("chunk-B.js")].sort(),
		);
		expect(barrelReadersReachedFrom(at("index.js"), graph(files))).toEqual([at("chunk-B.js")]);
	});

	it("is empty when nothing reached reads a barrel", () => {
		const files = {
			[at("gateway/index.js")]:
				'import { LankaError } from "../chunk-A.js";\nvar ALankaGateway = class {};\n',
			[at("chunk-A.js")]:
				"var LankaError = class extends Error {};\nexport { LankaError };\n",
		};

		expect(barrelReadersReachedFrom(at("gateway/index.js"), graph(files))).toEqual([]);
	});

	it("does not follow a specifier the graph cannot answer", () => {
		const files = { [at("index.js")]: 'import "./gone.js";\n' };

		expect([...reachableFrom(at("index.js"), graph(files))]).toEqual([at("index.js")]);
	});
});
