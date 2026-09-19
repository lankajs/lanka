import { describe, expect, it } from "vitest";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { lankaDiBridge } from "./lankaDiBridge";

describe("lankaDiBridge", () => {
	it("re-exports the same barrel from the sibling directory", () => {
		expect(lankaDiBridge(".lanka_di", "Gateways.ts")).toBe(
			`export * from "../.lanka_di/Gateways";`,
		);
	});

	it("goes the other way too, because either directory may be the primary", () => {
		expect(lankaDiBridge(".lanka", "Scenarios.ts")).toBe(
			`export * from "../.lanka/Scenarios";`,
		);
	});

	// Extensionless, like every other import a consumer writes here. A `.ts`
	// specifier is a different module to several resolvers and an error to some.
	it("drops the extension", () => {
		expect(lankaDiBridge(".lanka_di", "Host.ts")).not.toContain('.ts"');
	});

	// A star export and not a named list: the namespace barrels are read for
	// everything they export, so a list here would be a second place to add a
	// gateway — and the one that is forgotten.
	it("is a star export, so a shard needs no second registration", () => {
		expect(lankaDiBridge(".lanka_di", "Singletons.ts")).toContain("export *");
	});

	it("writes a usable line for every barrel the contract declares", () => {
		for (const barrel of lankaDiContract.barrels) {
			const line = lankaDiBridge(".lanka_di", barrel.file);

			expect(line).toMatch(/^export \* from "\.\.\/\.lanka_di\/[A-Za-z]+";$/);
		}
	});
});
