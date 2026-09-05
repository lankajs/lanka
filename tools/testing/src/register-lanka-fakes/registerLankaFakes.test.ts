import { beforeEach, describe, expect, it } from "vitest";
import { resetLanka } from "../resetLanka";
import { registerLankaFakes } from "./registerLankaFakes";
import type { ILankaInstance } from "lanka/bootstrap";

/**
 * What a test says with this: WHICH double stands for WHICH name. Everything
 * below is one way that sentence could quietly not be true.
 */
let lanka: ILankaInstance;

beforeEach(() => {
	lanka = resetLanka();
});

describe("registerLankaFakes", () => {
	it("puts a gateway double where the application looks for one", () => {
		const profileGateway = { load: () => Promise.resolve({ name: "Ada" }) };

		registerLankaFakes(lanka, { gateways: { PlaygroundProfileGateway: profileGateway } });

		// Resolved by PROPERTY name, which is what a ViewModel's `gateways` map
		// asks with — the locator converts it to the class name itself.
		expect(lanka.locators.gateways.get("playgroundProfileGateway")).toBe(profileGateway);
	});

	it("fills all four locators from one call", () => {
		const fake = { id: 1 };

		registerLankaFakes(lanka, {
			gateways: { AGateway: fake },
			singletons: { ASingleton: fake },
			sharedStores: { AStore: fake },
			scenarios: { AScenario: fake },
		});

		expect(lanka.locators.gateways.isRegistered("AGateway")).toBe(true);
		expect(lanka.locators.singletons.isRegistered("ASingleton")).toBe(true);
		expect(lanka.locators.sharedStores.isRegistered("AStore")).toBe(true);
		expect(lanka.locators.scenarios.isRegistered("AScenario")).toBe(true);
	});

	it("registers nothing for a family the test did not mention", () => {
		registerLankaFakes(lanka, { gateways: { AGateway: {} } });

		expect(lanka.locators.singletons.isRegistered("AGateway")).toBe(false);
	});

	it("takes an empty map without complaining", () => {
		// A test that builds its fakes conditionally hands `{}` on the path where it
		// built none; throwing there would make the helper harder to use than the
		// four lines it replaces.
		expect(() => {
			registerLankaFakes(lanka, {});
		}).not.toThrow();
	});
});
