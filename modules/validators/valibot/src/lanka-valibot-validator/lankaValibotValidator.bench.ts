import { bench, describe } from "vitest";
import * as v from "valibot";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { lankaValibotValidator } from "./lankaValibotValidator";

/**
 * The twin of the zod bench, and it exists to be compared with it.
 *
 * The two packages promise interchangeability: an application swaps one for the
 * other by changing which is installed. Price is part of what it swaps, and a
 * number for one of them alone would leave the more expensive half of that
 * decision unmeasured.
 *
 * This package adds nothing to measure — valibot implements Standard Schema, so
 * the validator IS `lankaStandardValidator` — which makes the comparison a fair
 * one: what differs between these rows and zod's is the library, not the wrapper.
 */
describe("lankaValibotValidator", () => {
	lankaBenchCalibration();

	const todo = v.object({
		id: v.number(),
		title: v.string(),
		done: v.boolean(),
	});

	const list = v.array(todo);

	const one = { id: 1, title: "write the canon", done: false };
	const hundred = Array.from({ length: 100 }, (_, index) => ({ ...one, id: index }));

	bench(
		"one object, validated",
		() => {
			lankaValibotValidator.validate(todo, one, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a hundred of them, which is a list screen",
		() => {
			lankaValibotValidator.validate(list, hundred, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a refusal, which a screen renders rather than throws away",
		() => {
			lankaValibotValidator.validateSafe(todo, { id: "not a number" });
		},
		LANKA_BENCH_OPTIONS,
	);
});
