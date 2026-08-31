import { describe, expect, it, vi } from "vitest";

/**
 * The locator finds a class by export name, and only that way.
 *
 * ## What this fixes
 *
 * A module's ES namespace is an ordinary object and `module[name]` is enough.
 * A fallback pass over `Class.name` is also WRONG exactly where it is needed:
 * class names are lost to minification, so in built code it looks for something
 * that no longer exists.
 *
 * The test below also pins what such a fallback was written for: resolution
 * works when the export name and the class name differ.
 */

describe("resolution by export name", () => {
	it("finds a class whose export name differs from its class name", async () => {
		vi.resetModules();
		vi.doMock("@lanka_di/Gateways", () => {
			class Internal {
				readonly marker = "found";
			}
			// The export name differs from the class name — what a rename on re-export
			// looks like, and what minified code looks like.
			return { RenamedGateway: Internal };
		});

		const { createLanka } = await import("../bootstrap/_factories/create-lanka/createLanka");
		const { lankaTestHost } = await import("@lankajs/tool-testing/lankaTestHost");
		const { lankaGateways } = await import("./gateway/_facades/lanka-gateways/lankaGateways");

		createLanka({ host: lankaTestHost });
		const resolved = (lankaGateways as unknown as Record<string, { marker: string }>)
			.renamedGateway;

		expect(resolved.marker).toBe("found");
	});

	it("caches the resolved object: a second call returns the same instance", async () => {
		vi.resetModules();
		vi.doMock("@lanka_di/Gateways", () => {
			class Counted {
				static instances = 0;
				constructor() {
					Counted.instances += 1;
				}
			}
			return { CountedGateway: Counted };
		});

		const { createLanka } = await import("../bootstrap/_factories/create-lanka/createLanka");
		const { lankaTestHost } = await import("@lankajs/tool-testing/lankaTestHost");
		const { lankaGateways } = await import("./gateway/_facades/lanka-gateways/lankaGateways");
		const module = (await import("@lanka_di/Gateways")) as unknown as {
			CountedGateway: { instances: number };
		};

		createLanka({ host: lankaTestHost });
		const proxy = lankaGateways as unknown as Record<string, object>;
		const first = proxy.countedGateway;
		const second = proxy.countedGateway;

		expect(first).toBe(second);
		expect(module.CountedGateway.instances).toBe(1);
	});

	it("an unknown name fails loudly instead of returning `undefined`", async () => {
		vi.resetModules();
		vi.doMock("@lanka_di/Gateways", () => ({}));

		const { createLanka } = await import("../bootstrap/_factories/create-lanka/createLanka");
		const { lankaTestHost } = await import("@lankajs/tool-testing/lankaTestHost");
		const { lankaGateways } = await import("./gateway/_facades/lanka-gateways/lankaGateways");

		createLanka({ host: lankaTestHost });
		const proxy = lankaGateways as unknown as Record<string, unknown>;

		// An `undefined` instead of a gateway would surface three layers from the
		// cause, on the first call of a method `undefined` does not have.
		expect(() => proxy.missingGateway).toThrowError(/not found/i);
	});
});
