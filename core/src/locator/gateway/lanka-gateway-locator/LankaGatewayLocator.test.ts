import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGateways = vi.hoisted(() => {
	class FooGateway {
		public name = "FooGateway";
		public static instances = 0;
		constructor() {
			FooGateway.instances += 1;
		}
	}
	class OriginalGateway {
		public name = "OriginalGateway";
	}
	class GetterGateway {
		public name = "GetterGateway";
	}
	class SymbolGateway {
		public name = "SymbolGateway";
	}
	const NotAClass = { value: 1 };
	return {
		FooGateway,
		OriginalGateway,
		GetterGateway,
		SymbolGateway,
		NotAClass,
	};
});

vi.mock("@lanka_di/Gateways", () => {
	const module: Record<string, unknown> = {
		FooGateway: mockGateways.FooGateway,
		AliasGateway: mockGateways.OriginalGateway,
		NotAClass: mockGateways.NotAClass,
	};

	Object.defineProperty(module, "GetterGateway", {
		get: () => mockGateways.GetterGateway,
		enumerable: true,
	});

	const symbolKey = Symbol("hidden");
	(module as Record<symbol, unknown>)[symbolKey] = mockGateways.SymbolGateway;

	return module;
});

import { LankaGatewayLocator } from "./LankaGatewayLocator";

describe("LankaGatewayLocator", () => {
	beforeEach(() => {
		mockGateways.FooGateway.instances = 0;
	});

	it("resolves gateway by export key (PascalCase) via camelCase property", () => {
		const locator = new LankaGatewayLocator();
		const instance = locator.get("fooGateway");

		expect(instance).toBeInstanceOf(mockGateways.FooGateway);
	});

	/*
	 * There is no "falls back to the class name when the export key differs" test
	 * here, because there is no such behaviour.
	 *
	 * A fallback over `Class.name` is written for the case where the export name
	 * was lost to minification — but minification loses `Class.name` too, so it
	 * looks for something a built bundle no longer has.
	 *
	 * Lookup goes by EXPORT KEY: what the consumer writes in the barrel and what
	 * `@lankajs/tool-di` verifies at build time. Resolution when the key and the
	 * class name differ is pinned by `locator.contract.test.ts`.
	 */

	it("resolves gateways from getter-based exports", () => {
		const locator = new LankaGatewayLocator();
		const instance = locator.get("getterGateway");

		expect(instance).toBeInstanceOf(mockGateways.GetterGateway);
	});

	it("caches created instances", () => {
		const locator = new LankaGatewayLocator();

		const first = locator.get("fooGateway");
		const second = locator.get("fooGateway");

		expect(first).toBe(second);
		expect(mockGateways.FooGateway.instances).toBe(1);
	});

	it("throws notFoundError when gateway is missing", () => {
		const locator = new LankaGatewayLocator();

		expect(() => locator.get("missingGateway")).toThrow(
			'Gateway "MissingGateway" (accessed as "missingGateway") not found. ' +
				"Make sure the gateway class extends ALankaGateway and is exported from lankaGateways.ts.",
		);
	});
});
