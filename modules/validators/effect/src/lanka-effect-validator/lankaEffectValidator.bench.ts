import { bench, describe } from "vitest";
import { Schema } from "effect";
import { lankaStandardValidator } from "lanka/validation";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { lankaEffectValidator } from "./lankaEffectValidator";

/**
 * The same three rows every validator in the family measures, plus the one row
 * only this package has.
 *
 * The fourth row builds the Standard Schema wrapper per call, which is what the
 * package exists to avoid. Read against the first row it is the price of not
 * caching it — and the number is why `standardEffectSchema` is a cache rather
 * than a one-line delegation.
 */
describe("lankaEffectValidator", () => {
	lankaBenchCalibration();

	const todo = Schema.Struct({
		id: Schema.Number,
		title: Schema.String,
		done: Schema.Boolean,
	});

	const list = Schema.Array(todo);

	const one = { id: 1, title: "write the canon", done: false };
	const hundred = Array.from({ length: 100 }, (_, index) => ({ ...one, id: index }));

	bench(
		"one object, validated",
		() => {
			lankaEffectValidator.validate(todo, one, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a hundred of them, which is a list screen",
		() => {
			lankaEffectValidator.validate(list, hundred, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a refusal, which a screen renders rather than throws away",
		() => {
			lankaEffectValidator.validateSafe(todo, { id: "not a number" });
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"the wrapper rebuilt per call, which is the cache never hitting",
		() => {
			// The same code path as the first row with the cache taken out: core's
			// port over a wrapper built here instead of looked up. Anything else
			// would be measuring a different function and calling it a comparison.
			lankaStandardValidator.validate(Schema.standardSchemaV1(todo), one, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);
});
