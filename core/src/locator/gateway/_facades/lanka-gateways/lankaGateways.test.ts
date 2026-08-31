import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lanka_di/Gateways", () => {
	class GlobalGateway {
		static instances = 0;
		readonly name = "GlobalGateway";
		constructor() {
			GlobalGateway.instances += 1;
		}
	}

	return { GlobalGateway };
});

const setup = async () => {
	// `vi.resetModules()` in beforeEach also resets the module holding the active
	// instance pointer: the one the setup file created stays in the PREVIOUS module
	// graph. So the instance is created here, after the reset — otherwise the
	// locator asks for a pointer nobody set in this graph.
	const { createLanka } =
		await import("../../../../bootstrap/_factories/create-lanka/createLanka");
	const { lankaTestHost } = await import("@lankajs/tool-testing/lankaTestHost");
	createLanka({ host: lankaTestHost });
	const module = await import("./lankaGateways");
	const gatewaysModule = await import("@lanka_di/Gateways");
	return {
		lankaGateways: module.lankaGateways,
		gatewaysModule: gatewaysModule as unknown as {
			GlobalGateway: { instances: number };
		},
	};
};

describe("lankaGateways", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("resolves gateways via proxy and caches the instance", async () => {
		const { lankaGateways, gatewaysModule } = await setup();
		const gateways = lankaGateways as unknown as Record<string, unknown>;
		gatewaysModule.GlobalGateway.instances = 0;

		const first = gateways.globalGateway;
		const second = gateways.globalGateway;

		expect(first).toBe(second);
		expect(gatewaysModule.GlobalGateway.instances).toBe(1);
	});

	it("throws with the gateway-specific error prefix for protected properties", async () => {
		const { lankaGateways } = await setup();
		const gateways = lankaGateways as unknown as Record<string, unknown>;

		expect(() => gateways.clearCache).toThrow(
			"Cannot access gateway with property: clearCache",
		);
	});
});
