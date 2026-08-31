import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lankaDiContract } from "./lankaDiContract";

const FIXTURE = join(__dirname, "..", "..", "..", "testing", "_fixtures", lankaDiContract.dirname);

describe("the scaffold stubs", () => {
	/**
	 * These stubs are written into a stranger's repository on the first build. A
	 * stub with a type error, a bad import or a missing export is a broken first
	 * impression no test of this package would otherwise catch: nothing here
	 * imports the stub text.
	 *
	 * So the fixture the whole suite type-checks and resolves `@lanka_di` against
	 * IS the scaffold output, byte for byte. Editing a stub without regenerating
	 * the fixture fails here, and regenerating puts the new text under `tsc` and
	 * under every spec importing through the alias.
	 */
	it.each(lankaDiContract.barrels.map((b) => [b.file, b] as const))(
		"%s matches the committed fixture, so it is type-checked like real consumer code",
		(file, barrel) => {
			expect(readFileSync(join(FIXTURE, file), "utf8")).toBe(barrel.stub);
		},
	);

	it("declares by-name barrels explicitly — Contract and Host, and nothing else", () => {
		// Namespace barrels are legal while empty, which is what lets a scaffolded
		// app boot before it has a single gateway. If a third barrel ever grows a
		// required export, this is the line that makes someone say so out loud.
		const named = lankaDiContract.barrels.filter((b) => b.requiredExport !== null);

		expect(named.map((b) => [b.file, b.requiredExport])).toEqual([
			["Contract.ts", "lankaDiContractVersion"],
			["Host.ts", "lankaHost"],
		]);
	});
});
