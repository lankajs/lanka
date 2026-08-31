/**
 * Pins `check-forms.mjs`: what counts as the wrong form.
 *
 * The readers are driven directly rather than through a run over the repository,
 * because a run proves today's answer. What has to be pinned is that each reader
 * FAILS on the shape it exists to catch — a gate nobody has seen fail is a gate
 * nobody has seen.
 */
import { describe, expect, it } from "vitest";
import {
	AMBIENT_OBJECTS,
	isFacadeBarrel,
	SUBCLASSABLE,
	barrelExports,
	invites,
	pascalCaseInstances,
	staticOnlyClasses,
	unfrozenTables,
} from "./check-forms.mjs";

describe("a class whose every member is static", () => {
	it("is caught", () => {
		expect(
			staticOnlyClasses(`export class LankaDates {
	static parse(value) {}
	static format(value) {}
}`),
		).toEqual(["LankaDates"]);
	});

	it("leaves a class with one instance member alone", () => {
		expect(
			staticOnlyClasses(`export class LankaClock {
	static now() {}
	tick() {}
}`),
		).toEqual([]);
	});

	it("leaves an abstract class alone, static helper and all", () => {
		// `ALankaSingleton.is` is the framework's own case: a marker exists to be
		// extended, so it is a contract even with nothing but a static on it.
		expect(
			staticOnlyClasses(`export abstract class ALankaSingleton {
	static is(candidate) {}
}`),
		).toEqual([]);
	});

	it("ignores a static member mentioned in a comment", () => {
		expect(
			staticOnlyClasses(`export class LankaClock {
	// static now() {}
	tick() {}
}`),
		).toEqual([]);
	});
});

describe("an object published as a value", () => {
	it("is caught when it is not frozen", () => {
		expect(unfrozenTables(`export const lankaMatchers = {\n\tequal: () => true,\n};`)).toEqual([
			"lankaMatchers",
		]);
	});

	it("passes once it is", () => {
		expect(
			unfrozenTables(
				`export const lankaMatchers = Object.freeze({\n\tequal: () => true,\n});`,
			),
		).toEqual([]);
	});

	it("passes with a type annotation between the name and the freeze", () => {
		expect(
			unfrozenTables(`export const lankaMatchers: TMatchers = Object.freeze({ equal: 1 });`),
		).toEqual([]);
	});
});

describe("a thing named like a class without being one", () => {
	it("catches an instance", () => {
		expect(pascalCaseInstances(`export const LankaLogger = new Logger();`)).toEqual([
			"LankaLogger",
		]);
	});

	it("catches a namespace object", () => {
		expect(pascalCaseInstances(`export const LankaLogger = {\n\tprint() {},\n};`)).toEqual([
			"LankaLogger",
		]);
	});

	it("leaves the ready-made instance alone", () => {
		expect(pascalCaseInstances(`export const lankaLogger = new LankaLogger();`)).toEqual([]);
	});

	it("leaves a constant alone", () => {
		// SCREAMING_SNAKE is a constant, and nobody reads one as a class.
		expect(pascalCaseInstances(`export const BLOB_CACHE_URLS = { small: "a" };`)).toEqual([]);
	});
});

describe("the invitation a published class must carry", () => {
	const declaration = `export class LankaPolling {}`;

	it("is missing when the class has no header", () => {
		expect(invites(`import { x } from "y";\n\n${declaration}`, "LankaPolling")).toBe(false);
	});

	it("is missing when the header is one line", () => {
		expect(invites(`/** Polls. */\n${declaration}`, "LankaPolling")).toBe(false);
	});

	it("is there when the header explains what to do with it", () => {
		const header = `/**\n * Repeating work, held for as long as the screen that wants it.\n *\n * One per screen: subscribe returns an id, and the screen clears it.\n */\n`;

		expect(invites(header + declaration, "LankaPolling")).toBe(true);
	});

	it("does not accept a header belonging to something else", () => {
		const header = `/**\n * A helper, explained at length.\n *\n * Three lines of it.\n */\nconst helper = () => {};\n\n`;

		expect(invites(header + declaration, "LankaPolling")).toBe(false);
	});
});

describe("what a barrel says it publishes", () => {
	it("reads a name and where it comes from", () => {
		expect(barrelExports(`export { LankaPolling } from "./polling/LankaPolling";`)).toEqual([
			{ name: "LankaPolling", from: "./polling/LankaPolling" },
		]);
	});

	it("takes the name a consumer writes, not the one behind the alias", () => {
		expect(barrelExports(`export { internalName as lankaThing } from "./thing";`)).toEqual([
			{ name: "lankaThing", from: "./thing" },
		]);
	});

	it("ignores a type: a type has no form to get wrong", () => {
		expect(barrelExports(`export type { ILankaThing } from "./thing";`)).toEqual([]);
	});
});

describe("the two lists this gate is steered by", () => {
	it("gives every admitted class a file and a reason", () => {
		for (const [name, entry] of SUBCLASSABLE) {
			expect(entry.file, name).toMatch(/\.ts$/);
			expect(entry.why.length, name).toBeGreaterThan(20);
		}
	});

	it("keeps the ambient exceptions to the ones that hold state", () => {
		// An exception list is where a gate goes to die. These two are objects with
		// methods and their own state; freezing either would stop the framework
		// configuring it.
		expect([...AMBIENT_OBJECTS]).toEqual(["lankaLogger", "lankaHttpInFlight"]);
	});
});

describe("which barrel counts as the facade", () => {
	it("takes core's, which sits one level higher than every other package", () => {
		// The bug this pins: a pattern written for `<kind>/<pkg>/src/index.ts`
		// silently skipped `core/src/**`, so the largest package in the repository
		// was never checked and the gate reported success.
		expect(isFacadeBarrel("core/src/index.ts")).toBe(true);
		expect(isFacadeBarrel("core/src/gateway/index.ts")).toBe(true);
		expect(isFacadeBarrel("modules/storage/src/index.ts")).toBe(true);
	});

	it("leaves the other two tiers alone", () => {
		// `extend` may change in a minor and `internal` in any release, so the
		// questions this gate asks of a promise do not apply to them.
		expect(isFacadeBarrel("core/src/_extend/index.ts")).toBe(false);
		expect(isFacadeBarrel("core/src/_internal/index.ts")).toBe(false);
	});

	it("is not fooled by a file that merely ends in index.ts", () => {
		expect(isFacadeBarrel("core/_playground/index.ts")).toBe(false);
		expect(isFacadeBarrel("scripts/index.ts")).toBe(false);
	});
});

describe("an admission nothing can consult", () => {
	it("every admitted class is one a facade barrel actually publishes", () => {
		// An entry for a class the facade does not export exempts nothing, and the
		// next one written beside it inherits the assumption that this list is read.
		// Three were sitting here: two already covered by the Error rule, and one
		// for a class the framework publishes as an instance alone.
		expect(SUBCLASSABLE.has("LankaScenarioBootstrap")).toBe(false);
		expect(SUBCLASSABLE.has("LankaError")).toBe(false);
		expect(SUBCLASSABLE.has("LankaValidationError")).toBe(false);
	});
});
