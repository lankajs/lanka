import { describe, expect, it } from "vitest";
import { lankaDiExportedNames } from "./lankaDiExportedNames";

/**
 * Pins the reader behind the one failure sharding adds.
 *
 * A name exported by both halves of a sharded barrel is DROPPED by the star
 * re-export that joins them — no build error, no type error, and a gateway that
 * is simply not in the locator. This is what notices, so it has to be wrong in
 * neither direction: a name it misses is a collision nobody is told about, and a
 * name it invents is a project refused for a clash it does not have.
 */
describe("lankaDiExportedNames — the forms a barrel is written in", () => {
	it("reads a re-export list", () => {
		expect(
			lankaDiExportedNames(`export { UserGateway, OrderGateway } from "../src/x";`),
		).toEqual(["UserGateway", "OrderGateway"]);
	});

	// The name after `as` is the one an importer writes, so it is the one that
	// collides. Reporting the local name would name a symbol nobody can import.
	it("reads the name a rename arrives under, not the one it left", () => {
		expect(lankaDiExportedNames(`export { Local as Published } from "./x";`)).toEqual([
			"Published",
		]);
	});

	it("reads a plain list with no source", () => {
		expect(lankaDiExportedNames(`const A = 1;\nexport { A };`)).toEqual(["A"]);
	});

	it.each([
		["const", `export const clock = 1;`, "clock"],
		["function", `export function make() {}`, "make"],
		["class", `export class UserGateway {}`, "UserGateway"],
		["type", `export type TThing = string;`, "TThing"],
		["interface", `export interface IThing { a: 1 }`, "IThing"],
	])("reads an exported %s", (_kind, source, name) => {
		expect(lankaDiExportedNames(source)).toContain(name);
	});

	// A type collision is dropped by the star export the same way a value's is,
	// and it surfaces as "that type is not exported" — which reads as a missing
	// export rather than as a duplicate one.
	it("reads a type-only list", () => {
		expect(lankaDiExportedNames(`export type { IThing } from "./x";`)).toEqual(["IThing"]);
	});

	it("finds nothing in an empty barrel", () => {
		expect(lankaDiExportedNames(`export {};`)).toEqual([]);
	});
});

describe("lankaDiExportedNames — what it must not read", () => {
	// The scaffolded namespace stub carries `@example export { UserGateway } from
	// "../src/...";` inside its doc comment. Counted, every untouched project
	// collides with every other one on `UserGateway`.
	it("ignores an example inside a doc comment", () => {
		const stub = `/**\n * The gateways.\n *\n * @example export { UserGateway } from "../src/...";\n */\nexport {};\n`;

		expect(lankaDiExportedNames(stub)).toEqual([]);
	});

	it("ignores a commented-out export", () => {
		expect(
			lankaDiExportedNames(`// export { Old } from "./x";\nexport { New } from "./y";`),
		).toEqual(["New"]);
	});

	// A star re-export contributes names that cannot be known from this file, and
	// the bridge itself is one. Guessing at them would make every bridged barrel
	// collide with the shard it is bridging to.
	it("contributes nothing for a star re-export", () => {
		expect(lankaDiExportedNames(`export * from "../.lanka_di/Gateways";`)).toEqual([]);
	});

	it("reads a barrel that both bridges and exports as exporting only its own", () => {
		const source = `export * from "../.lanka_di/Gateways";\nexport { MissionGateway } from "./y";\n`;

		expect(lankaDiExportedNames(source)).toEqual(["MissionGateway"]);
	});
});
