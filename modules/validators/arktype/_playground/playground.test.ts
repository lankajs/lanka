import { describe, expect, it } from "vitest";
import { lankaValidatorConformance } from "@lankajs/tool-testing/lankaValidatorConformance";
import { lankaArkTypeValidator } from "../src/index";
import {
	createPlaygroundFeatureGateway,
	playgroundApiShapeSchema,
	playgroundSignUpSchema,
	playgroundToApiSchema,
} from "./app";

/**
 * The package, used as an application uses it.
 *
 * What matters is not that arktype validates — arktype's own tests cover that —
 * but that an arktype schema passes through the framework's validator port
 * intact, and that a failure arrives as something a form can put next to an
 * input.
 *
 * Those assertions are the family's, so they are imported rather than written
 * here: six packages promising the same thing in six copies of one test file is
 * six chances for one of them to quietly stop promising it.
 */
lankaValidatorConformance({
	vendor: "arktype",
	validator: lankaArkTypeValidator,
	signUp: playgroundSignUpSchema,
	apiShape: playgroundApiShapeSchema,
	toApi: playgroundToApiSchema,
});

describe("the arktype playground's gateway", () => {
	it("returns the parsed body on the strict path", () => {
		const gateway = createPlaygroundFeatureGateway();

		expect(gateway.read({ key: "new-checkout", enabled: true })).toEqual({
			key: "new-checkout",
			enabled: true,
		});
	});

	it("throws on a broken contract, naming the call", () => {
		// A gateway is where a body stops being `unknown`. A response that fails is
		// a bug in the contract, and the label says which call to go and look at.
		const gateway = createPlaygroundFeatureGateway();

		expect(() => gateway.read({ key: "new-checkout", enabled: "yes" })).toThrow(/flags\.byKey/);
	});

	it("answers null for a flag the backend may legitimately not know", () => {
		const gateway = createPlaygroundFeatureGateway();

		expect(gateway.readOptional(null)).toBeNull();
		expect(gateway.readOptional({ key: "k", enabled: false })).toEqual({
			key: "k",
			enabled: false,
		});
	});

	it("keeps the two paths apart, which a try/catch around `read` would not", () => {
		// The distinction the gateway exists to hold: an unset flag and a payload
		// that changed shape are different events, and only one of them is a bug.
		const gateway = createPlaygroundFeatureGateway();

		expect(gateway.readOptional({ key: "k" })).toBeNull();
		expect(() => gateway.read({ key: "k" })).toThrow();
	});
});
