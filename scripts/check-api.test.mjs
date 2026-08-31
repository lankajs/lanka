/**
 * Pins `check-api.mjs`: what it reads out of a barrel, and what it refuses.
 *
 * A guard nothing exercises is a guard that reports success — and this one
 * guards a promise, so its failure mode is a contract change nobody reviewed.
 *
 * The pure halves are driven directly rather than through a temporary
 * repository: the script's subject is the CONTENT of a barrel and the report
 * rendered from it, and a fixture tree would test the registry instead.
 */
import { describe, expect, it } from "vitest";
import {
	extractExports,
	renderReport,
	reportPath,
	staleExceptions,
	undemonstrated,
	UNDEMONSTRATED,
} from "./check-api.mjs";

describe("reading a barrel", () => {
	it("separates a value from a type", () => {
		const names = extractExports(
			'export { createLanka } from "./a";\nexport type { ILankaHost } from "./b";\n',
		);

		// Sorted the way a reader scans, not the way ASCII does: `createLanka`
		// before `ILankaHost`, so a report diff stays readable.
		expect(names).toEqual([
			{ name: "createLanka", kind: "value" },
			{ name: "ILankaHost", kind: "type" },
		]);
	});

	it("reads a type clause inside a value block", () => {
		const names = extractExports('export { LankaError, type TLankaErrorKind } from "./a";');

		expect(names).toEqual([
			{ name: "LankaError", kind: "value" },
			{ name: "TLankaErrorKind", kind: "type" },
		]);
	});

	// Five published entries point straight at a unit rather than at a barrel —
	// `@lankajs/plugin-prefetch/router` and four subpaths of the test kit. Reading
	// only re-export blocks reported every one of them as publishing NOTHING.
	it("reads an entry that IS the unit, not a barrel over it", () => {
		const names = extractExports(
			"export interface ILankaRouteManifestEntry {\n\tid: string;\n}\n" +
				"export const lankaRouterChunkSource = () => undefined;\n",
		);

		expect(names).toEqual([
			{ name: "ILankaRouteManifestEntry", kind: "type" },
			{ name: "lankaRouterChunkSource", kind: "value" },
		]);
	});

	it("separates a declared type from a declared value", () => {
		const names = extractExports(
			"export type TLankaClock = () => number;\n" +
				"export class LankaThing {}\n" +
				"export function lankaDo() {}\n" +
				"export enum LankaKind {}\n",
		);

		expect(names).toEqual([
			{ name: "lankaDo", kind: "value" },
			{ name: "LankaKind", kind: "value" },
			{ name: "LankaThing", kind: "value" },
			{ name: "TLankaClock", kind: "type" },
		]);
	});

	it("does not read a declaration that is not exported", () => {
		// The distinction the record exists for: reachable is not the same as
		// promised, and a module-private helper is neither.
		expect(extractExports("const lankaPrivate = 1;\nexport const lankaPublic = 2;\n")).toEqual([
			{ name: "lankaPublic", kind: "value" },
		]);
	});

	it("reads an abstract class, which is how a base is published", () => {
		expect(extractExports("export abstract class ALankaGateway {}")).toEqual([
			{ name: "ALankaGateway", kind: "value" },
		]);
	});

	it("reads the name a consumer types, not the one behind an alias", () => {
		const names = extractExports('export { internalName as LankaThing } from "./a";');

		expect(names).toEqual([{ name: "LankaThing", kind: "value" }]);
	});

	it("reads a block spread over several lines", () => {
		const names = extractExports(
			'export {\n\tLankaSingletons,\n\tALankaSingleton,\n} from "./a";\n',
		);

		expect(names.map((n) => n.name)).toEqual(["ALankaSingleton", "LankaSingletons"]);
	});
});

describe("the report", () => {
	const surface = [
		{
			subpath: "lanka",
			tier: "facade",
			exports: [{ name: "createLanka", kind: "value" }],
		},
	];

	it("names the tier beside every subpath", () => {
		expect(renderReport("lanka", surface)).toContain("Tier: facade");
	});

	it("changes when a name is added, which is the whole point of the file", () => {
		const before = renderReport("lanka", surface);
		const after = renderReport("lanka", [
			{
				...surface[0],
				exports: [...surface[0].exports, { name: "createOther", kind: "value" }],
			},
		]);

		// If a promise could be added without moving this file, the review it
		// exists for would never happen.
		expect(after).not.toBe(before);
		expect(after).toContain("createOther");
	});

	it("says a subpath promises nothing rather than leaving a blank", () => {
		expect(
			renderReport("lanka", [{ subpath: "lanka/x", tier: "extend", exports: [] }]),
		).toContain("_Nothing._");
	});

	it("lives under a name npm can hold", () => {
		expect(reportPath("@lankajs/plugin-http")).toBe("api/plugin-http.api.md");
	});
});

describe("the demonstration rule", () => {
	const surface = [
		{
			subpath: "lanka",
			tier: "facade",
			exports: [
				{ name: "createLanka", kind: "value" },
				{ name: "ILankaHost", kind: "type" },
			],
		},
	];

	it("names a facade value no scene uses", () => {
		expect(undemonstrated(surface, "a scene that uses nothing")).toEqual([
			{ subpath: "lanka", name: "createLanka" },
		]);
	});

	it("accepts one a scene does use", () => {
		expect(undemonstrated(surface, "const lanka = createLanka({ host });")).toEqual([]);
	});

	it("asks nothing of a type", () => {
		const types = [
			{ subpath: "lanka", tier: "facade", exports: [{ name: "ILankaHost", kind: "type" }] },
		];

		// A type is used by using the value it describes; demanding it be named
		// would push scenes toward annotations nobody writes in real code.
		expect(undemonstrated(types, "")).toEqual([]);
	});

	it("asks nothing of a tier that promises less", () => {
		const extend = [
			{
				subpath: "lanka/extend",
				tier: "extend",
				exports: [{ name: "LankaThing", kind: "value" }],
			},
		];

		expect(undemonstrated(extend, "")).toEqual([]);
	});

	it("does not match a name that merely appears inside a longer one", () => {
		const one = [
			{ subpath: "lanka", tier: "facade", exports: [{ name: "createLanka", kind: "value" }] },
		];

		expect(undemonstrated(one, "createLankaVM({ name: 'x' })")).toEqual([
			{ subpath: "lanka", name: "createLanka" },
		]);
	});

	it("every entry of the allowlist carries a reason", () => {
		for (const [entry, why] of UNDEMONSTRATED) {
			expect(typeof why, entry).toBe("string");
			expect(why.length, entry).toBeGreaterThan(30);
		}
	});
});

describe("an exemption that outlived its reason", () => {
	it("is reported once a scene drives the name", () => {
		const key = [...UNDEMONSTRATED.keys()][0];
		const name = key.split(":").pop();

		// The quietest way a rule stops applying: the name is demonstrated, the
		// list still says it cannot be, and the next entry added beside it inherits
		// the assumption that nobody checks.
		expect(staleExceptions(`const thing = new ${name}();`)).toEqual([key]);
	});

	it("says nothing while the exemptions are still true", () => {
		expect(staleExceptions("")).toEqual([]);
	});

	it("does not fire on a name that merely contains an exempt one", () => {
		expect(staleExceptions("const x = LankaFetchTransportFactory;")).toEqual([]);
	});
});
