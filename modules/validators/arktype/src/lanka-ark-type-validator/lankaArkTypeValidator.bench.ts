import { bench, describe } from "vitest";
import { type } from "arktype";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { lankaArkTypeValidator } from "./lankaArkTypeValidator";

/**
 * The same three rows every validator in the family measures, so the numbers can
 * be read against each other.
 *
 * The packages promise interchangeability, and price is part of what an
 * application swaps. A number for one library alone would leave the more
 * expensive half of that decision unmeasured.
 *
 * This package adds nothing to measure — arktype implements Standard Schema, so
 * the validator IS `lankaStandardValidator` — which makes the comparison a fair
 * one: what differs between these rows and zod's is the library, not the wrapper.
 */
describe("lankaArkTypeValidator", () => {
	lankaBenchCalibration();

	const todo = type({ id: "number", title: "string", done: "boolean" });
	const list = todo.array();

	const one = { id: 1, title: "write the canon", done: false };
	const hundred = Array.from({ length: 100 }, (_, index) => ({ ...one, id: index }));

	bench(
		"one object, validated",
		() => {
			lankaArkTypeValidator.validate(todo, one, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a hundred of them, which is a list screen",
		() => {
			lankaArkTypeValidator.validate(list, hundred, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a refusal, which a screen renders rather than throws away",
		() => {
			lankaArkTypeValidator.validateSafe(todo, { id: "not a number" });
		},
		LANKA_BENCH_OPTIONS,
	);
});
