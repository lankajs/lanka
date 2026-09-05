/**
 * Pins `check-parity.mjs`: what counts as one style falling behind the other.
 *
 * Driven directly rather than through a run over the repository, because a run
 * proves today's answer. What has to be pinned is that each reader FAILS on the
 * shape it exists to catch — this gate went green on its first run, and a gate
 * nobody has seen fail is a gate nobody has seen.
 */
import { describe, expect, it } from "vitest";
import {
	INTERFACE_ROLES,
	ROLES,
	buildsOnBase,
	contextFields,
	demonstratesBothStyles,
	inheritedProtectedMembers,
	drivesPair,
	protectedMembers,
	publishedNames,
	publishedPairs,
} from "./check-parity.mjs";

describe("the surface a class offers a subclass", () => {
	it("reads every protected member, however it is written", () => {
		const source = `export abstract class ALankaThing {
	protected readonly basePath: string;
	protected abstract run(): void;
	protected async load(): Promise<void> {}
	protected override reset(): void {}
	private hidden(): void {}
	public open(): void {}
}`;

		expect([...protectedMembers(source)]).toEqual(["basePath", "run", "load", "reset"]);
	});
});

describe("the context the functional style receives", () => {
	it("reads every field, optional ones included", () => {
		const source = `export interface ILankaThingContext {
	endpoint: (path?: string) => string;
	request?: <T>(path: string) => Promise<T>;
}`;

		expect([...contextFields(source)]).toEqual(["endpoint", "request"]);
	});

	it("is compared to the base by NAME, which is the whole contract", () => {
		const base = `export abstract class ALankaThing {
	protected endpoint(): string {
		return "";
	}
	protected buildLankaQueryParams(): string {
		return "";
	}
}`;
		const context = `export interface ILankaThingContext {
	endpoint: () => string;
	buildQueryParams: () => string;
}`;

		const declared = protectedMembers(base);
		const missing = [...contextFields(context)].filter((field) => !declared.has(field));

		// The framework's own case, and the reason this check exists: the gateway's
		// context said `buildQueryParams` while the class said
		// `buildLankaQueryParams`, so a consumer switching styles renamed a call.
		expect(missing).toEqual(["buildQueryParams"]);
	});
});

describe("a factory built on its class, rather than beside it", () => {
	it("accepts a bridge subclass in the factory's own module", () => {
		expect(buildsOnBase("class Functional extends ALankaGateway {}", "ALankaGateway")).toBe(
			true,
		);
	});

	it("accepts the published bridge", () => {
		expect(buildsOnBase("export const create = defineLankaRole(open);", "ALankaThing")).toBe(
			true,
		);
	});

	it("accepts a factory that simply constructs the class", () => {
		expect(
			buildsOnBase(
				"export const create = () => new LankaFetchJsonRequest({});",
				"LankaFetchJsonRequest",
			),
		).toBe(true);
	});

	it("refuses a factory that reimplements it", () => {
		// The failure this prevents: two styles of one thing, agreeing on the day
		// they were written and never again.
		expect(
			buildsOnBase(
				"export const create = () => ({ list: () => fetch('/todos') });",
				"ALankaGateway",
			),
		).toBe(false);
	});
});

describe("a role shown in both styles", () => {
	const role = { base: { name: "ALankaVM" }, factory: { name: "createLankaVM" } };

	it("is satisfied when a scene does each", () => {
		expect(
			demonstratesBothStyles(
				["class TodoVM extends ALankaVM {}", "const use = createLankaVM({});"],
				role,
			),
		).toEqual({ asClass: true, byCalling: true });
	});

	it("reports the missing half when only the factory is exercised", () => {
		expect(demonstratesBothStyles(["const use = createLankaVM({});"], role)).toEqual({
			asClass: false,
			byCalling: true,
		});
	});

	it("counts a construction as the class style, for a role with no base", () => {
		const request = {
			base: { name: "LankaFetchJsonRequest" },
			factory: { name: "createLankaFetchJsonRequest" },
		};

		expect(
			demonstratesBothStyles(["new LankaFetchJsonRequest({ transport })"], request).asClass,
		).toBe(true);
	});

	it("is not fooled by a name that merely appears", () => {
		// `createLankaVM` in prose is not a call, and a comment is not a scene.
		expect(
			demonstratesBothStyles(["// createLankaVM is the other style"], role).byCalling,
		).toBe(false);
	});
});

describe("the roles this gate is declared over", () => {
	it("covers the eleven the canon names", () => {
		expect(ROLES.length + INTERFACE_ROLES.length).toBe(11);
	});

	it("gives every role both forms and a playground to show them in", () => {
		for (const role of ROLES) {
			expect(role.base.file, role.name).toMatch(/\.ts$/);
			expect(role.factory.file, role.name).toMatch(/\.ts$/);
			expect(role.demonstrate, role.name).toMatch(/_playground$/);
		}
	});

	it("keeps the interface-only roles to the two whose functional style IS the contract", () => {
		expect(INTERFACE_ROLES.map((role) => role.name)).toEqual(["plugin", "bootstrap-step"]);
	});
});

describe("the pairs nobody declared", () => {
	it("finds a class beside its factory", () => {
		const names = new Set(["LankaPolling", "createLankaPolling", "safeFireAndForget"]);

		expect(publishedPairs(names)).toEqual([
			{ class: "LankaPolling", other: "createLankaPolling", kind: "factory" },
		]);
	});

	it("finds a class beside its ready-made instance", () => {
		const names = new Set(["LankaStorage", "lankaStorage"]);

		expect(publishedPairs(names)).toEqual([
			{ class: "LankaStorage", other: "lankaStorage", kind: "instance" },
		]);
	});

	it("finds one behind an `A` prefix, where the bare name is the factory's", () => {
		const names = new Set(["ALankaGateway", "createLankaGateway"]);

		expect(publishedPairs(names)[0].other).toBe("createLankaGateway");
	});

	it("is not a pair when only one of the two is published", () => {
		// The cookies module publishes the instance alone, deliberately: there is
		// one document, so there is nothing to build a second of.
		expect(publishedPairs(new Set(["lankaCookies"]))).toEqual([]);
		expect(publishedPairs(new Set(["LankaRingBuffer"]))).toEqual([]);
	});

	it("ignores a name that is not the framework's", () => {
		expect(publishedPairs(new Set(["Storage", "createStorage"]))).toEqual([]);
	});
});

describe("a pair driven from a scene", () => {
	const pair = { class: "LankaPolling", other: "createLankaPolling", kind: "factory" };

	it("counts a construction and a call", () => {
		expect(
			drivesPair("const a = new LankaPolling(); const b = createLankaPolling();", pair),
		).toEqual({ asClass: true, other: true });
	});

	it("does not count an import for either side", () => {
		// The failure this prevents: a scene that imports both names, uses one, and
		// looks like a demonstration of two.
		expect(
			drivesPair(`import { createLankaPolling, LankaPolling } from "../src/index";`, pair),
		).toEqual({ asClass: false, other: false });
	});

	it("counts a member access as the instance side, since an instance is not called", () => {
		const instance = { class: "LankaStorage", other: "lankaStorage", kind: "instance" };

		expect(drivesPair("await lankaStorage.setLocal('a', 'b');", instance).other).toBe(true);
	});
});

describe("what a package publishes", () => {
	it("reads a barrel's values and skips its types", () => {
		// A real barrel: what this reader must survive is the shapes the repository
		// actually writes, not the two a fixture would remember.
		const names = publishedNames(["modules/async/src/index.ts"], "modules/async");

		expect(names.has("LankaPolling")).toBe(true);
		expect(names.has("createLankaPolling")).toBe(true);
		expect([...names].some((name) => name.startsWith("I") || name.startsWith("T"))).toBe(false);
	});
});

describe("a base that extends another base", () => {
	it("offers what its own base declared", () => {
		// The three ViewModel bases share the four hooks every ViewModel is given.
		// Reading one file alone would report a surface the language does not, and
		// the gate would call the shared half a divergence.
		const declared = inheritedProtectedMembers(
			"core/src/viewmodel/_abstractions/lanka-vm/ALankaVM.ts",
		);

		expect(declared.has("set")).toBe(true);
		expect(declared.has("gateways")).toBe(true);
		expect(declared.has("onReset")).toBe(true);
	});
});
