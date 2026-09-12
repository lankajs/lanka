import { describe, expect, it } from "vitest";
import { lankaValidatorConformance } from "@lankajs/tool-testing/lankaValidatorConformance";
import { lankaEffectValidator } from "../src/index";
import {
	playgroundApiShapeSchema,
	playgroundConfigSchema,
	playgroundSignUpSchema,
	playgroundToApiSchema,
	readPlaygroundConfig,
} from "./app";

/**
 * The package, used as an application uses it.
 *
 * What matters is not that Effect validates — Effect's own tests cover that —
 * but that an Effect schema passes through the framework's validator port
 * intact, and that a failure arrives as something a form can put next to an
 * input.
 *
 * Those assertions are the family's, so they are imported rather than written
 * here: six packages promising the same thing in six copies of one test file is
 * six chances for one of them to quietly stop promising it.
 */
lankaValidatorConformance({
	vendor: "Effect",
	validator: lankaEffectValidator,
	signUp: playgroundSignUpSchema,
	apiShape: playgroundApiShapeSchema,
	toApi: playgroundToApiSchema,
});

describe("the Effect playground's start-up read", () => {
	const raw = { apiBase: "https://example.test", retries: 2 };

	it("returns a plain value, with no Effect runtime started", () => {
		const config = readPlaygroundConfig(raw);

		expect(config).toEqual(raw);
		// A plain object, not an Effect, not an Either. The family returns one
		// shape, and this package does not add a second.
		expect(Object.getPrototypeOf(config)).toBe(Object.prototype);
	});

	it("refuses a broken configuration loudly, naming the stage", () => {
		// Nothing later in the start-up sequence can do anything useful with half a
		// configuration, so there is no safe path here on purpose.
		expect(() => readPlaygroundConfig({ apiBase: 1, retries: 2 })).toThrow(/config\.startup/);
	});

	it("refuses a missing configuration rather than defaulting it", () => {
		expect(() => readPlaygroundConfig(undefined)).toThrow();
		expect(() => readPlaygroundConfig({})).toThrow();
	});

	it("reads the same schema object every time, which is what the cache is keyed by", () => {
		// The invariant the package'd lose to a schema built per call: the wrapper
		// is cached by identity, and a module-level schema has exactly one.
		readPlaygroundConfig(raw);
		readPlaygroundConfig(raw);

		expect(playgroundConfigSchema).toBe(playgroundConfigSchema);
	});
});
