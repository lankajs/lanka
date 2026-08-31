import { bench, describe } from "vitest";
import { z } from "zod";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { lankaZodValidator } from "./lankaZodValidator";

/**
 * What checking a server's answer costs per response.
 *
 * Every gateway that validates pays this once per request, over a body whose
 * size the server chooses. What belongs to this package is the DISPATCH — is
 * this a Standard Schema or a zod 3 one, does the failure become a
 * `LankaValidationError` — and the rest belongs to zod, so the two are measured
 * apart: one row of a list, and a hundred of them.
 */
describe("lankaZodValidator", () => {
	lankaBenchCalibration();

	const todo = z.object({
		id: z.number(),
		title: z.string(),
		done: z.boolean(),
	});

	const list = z.array(todo);

	const one = { id: 1, title: "write the canon", done: false };
	const hundred = Array.from({ length: 100 }, (_, index) => ({ ...one, id: index }));

	bench(
		"one object, validated",
		() => {
			lankaZodValidator.validate(todo, one, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a hundred of them, which is a list screen",
		() => {
			lankaZodValidator.validate(list, hundred, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a refusal, which a screen renders rather than throws away",
		() => {
			lankaZodValidator.validateSafe(todo, { id: "not a number" });
		},
		LANKA_BENCH_OPTIONS,
	);
});
