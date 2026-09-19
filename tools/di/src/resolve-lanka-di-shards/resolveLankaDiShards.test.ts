import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { lankaDiBridge } from "../lanka-di-bridge/lankaDiBridge";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { resolveLankaDiShards } from "./resolveLankaDiShards";

const roots: string[] = [];

const makeRoot = (): string => {
	const root = mkdtempSync(join(tmpdir(), "lanka-di-shard-"));
	roots.push(root);
	mkdirSync(join(root, ".lanka"));
	mkdirSync(join(root, ".lanka_di"));
	return root;
};

const write = (root: string, path: string, source: string): void =>
	writeFileSync(join(root, path), source, "utf8");

/** One barrel's answer, by file name, because the order is the contract's. */
const shardFor = (root: string, file: string) =>
	resolveLankaDiShards(root, ".lanka").find((one) => one.barrel.file === file);

afterEach(() => {
	while (roots.length > 0) rmSync(roots.pop() as string, { recursive: true, force: true });
});

describe("resolveLankaDiShards", () => {
	it("answers for every barrel the contract declares, present or not", () => {
		const root = makeRoot();

		expect(resolveLankaDiShards(root, ".lanka").map((one) => one.barrel.file)).toEqual(
			lankaDiContract.barrels.map((one) => one.file),
		);
	});

	it("reports no holders for a barrel neither directory has", () => {
		const root = makeRoot();

		expect(shardFor(root, "Gateways.ts")?.holders).toEqual([]);
	});

	it("puts the primary first, whichever directory that is", () => {
		const root = makeRoot();
		write(root, ".lanka/Gateways.ts", `export {};`);
		write(root, ".lanka_di/Gateways.ts", `export {};`);

		expect(shardFor(root, "Gateways.ts")?.holders).toEqual([".lanka", ".lanka_di"]);
		expect(
			resolveLankaDiShards(root, ".lanka_di").find((one) => one.barrel.file === "Gateways.ts")
				?.holders,
		).toEqual([".lanka_di", ".lanka"]);
	});

	it("sees the bridge when the primary carries it", () => {
		const root = makeRoot();
		write(root, ".lanka_di/Gateways.ts", `export {};`);
		write(root, ".lanka/Gateways.ts", lankaDiBridge(".lanka_di", "Gateways.ts"));

		expect(shardFor(root, "Gateways.ts")?.bridged).toBe(true);
	});

	// Matched on the SPECIFIER and not on the whole line: the line is the
	// consumer's to format, and prettier, a trailing comment or a wrap must not
	// turn a live bridge into a missing one.
	it("sees a bridge a formatter has moved or commented at the end", () => {
		const root = makeRoot();
		write(root, ".lanka_di/Scenarios.ts", `export {};`);
		write(
			root,
			".lanka/Scenarios.ts",
			`\nexport * from "../.lanka_di/Scenarios"; // the other half\n`,
		);

		expect(shardFor(root, "Scenarios.ts")?.bridged).toBe(true);
	});

	it("does not see a bridge that is commented out", () => {
		const root = makeRoot();
		write(root, ".lanka_di/Gateways.ts", `export {};`);
		write(root, ".lanka/Gateways.ts", `// ${lankaDiBridge(".lanka_di", "Gateways.ts")}`);

		expect(shardFor(root, "Gateways.ts")?.bridged).toBe(false);
	});

	// A bridge to the WRONG barrel is not a bridge to this one. Without the file
	// name in the specifier, one re-export would answer for all six.
	it("does not accept a bridge pointing at another barrel", () => {
		const root = makeRoot();
		write(root, ".lanka_di/Gateways.ts", `export {};`);
		write(root, ".lanka/Gateways.ts", lankaDiBridge(".lanka_di", "Scenarios.ts"));

		expect(shardFor(root, "Gateways.ts")?.bridged).toBe(false);
	});

	// `bridged` is about the primary's file, and there is no primary file here.
	// A caller reading `true` would conclude the shard is joined to nothing.
	it("reports no bridge when the primary has no file at all", () => {
		const root = makeRoot();
		write(root, ".lanka_di/Gateways.ts", `export {};`);

		expect(shardFor(root, "Gateways.ts")).toMatchObject({
			holders: [".lanka_di"],
			bridged: false,
		});
	});
});

/**
 * The forms a bridge a CONSUMER wrote may legally take.
 *
 * This reads a file in somebody else's repository, so it accepts a set where
 * `lankaDiBridge` emits one. A form once accepted is one a project is relying
 * on: this list only ever grows.
 */
describe("resolveLankaDiShards — recognising a bridge somebody else typed", () => {
	const shardedBy = (line: string) => {
		const root = makeRoot();
		write(root, ".lanka_di/Gateways.ts", `export {};`);
		write(root, ".lanka/Gateways.ts", line);
		return shardFor(root, "Gateways.ts")?.bridged;
	};

	it.each([
		["double quotes", `export * from "../.lanka_di/Gateways";`],
		["single quotes", `export * from '../.lanka_di/Gateways';`],
		// `"moduleResolution": "NodeNext"` REQUIRES the extension, and it is `.js`
		// for a TypeScript source. A consumer on it cannot write the form this
		// package prefers — their own compiler rejects it.
		["a NodeNext .js extension", `export * from "../.lanka_di/Gateways.js";`],
		["an explicit .ts extension", `export * from "../.lanka_di/Gateways.ts";`],
		["a wrapped line with a comment", `export * from\n\t"../.lanka_di/Gateways"; // the rest`],
		[
			"a re-export that also names things",
			`export * from "../.lanka_di/Gateways";\nexport { A } from "./a";`,
		],
	])("accepts %s", (_form, line) => {
		expect(shardedBy(line)).toBe(true);
	});

	it.each([
		["a bridge to another barrel", `export * from "../.lanka_di/Scenarios";`],
		["a path that merely contains the name", `export * from "../.lanka_di/GatewaysExtra";`],
		["a commented-out bridge", `// export * from "../.lanka_di/Gateways";`],
		[
			"a bridge into a directory that is not the other one",
			`export * from "../elsewhere/Gateways";`,
		],
		// A module specifier must be a STRING literal, so `export * from` with a
		// backtick is a syntax error and no such occurrence can ever be a working
		// bridge. What a backtick around this path really is, is somebody
		// lazy-loading their own barrel — and reading that as a bridge would tell
		// them the split is healthy while the locator is empty.
		[
			"a template literal, which is not a legal module specifier",
			"export * from `../.lanka_di/Gateways`;",
		],
		[
			"a dynamic import of the shard",
			"export const load = () => import(`../.lanka_di/Gateways`);",
		],
	])("rejects %s", (_form, line) => {
		expect(shardedBy(line)).toBe(false);
	});
});
