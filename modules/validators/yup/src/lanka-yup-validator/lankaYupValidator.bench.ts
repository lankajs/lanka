import { bench, describe } from "vitest";
import * as yup from "yup";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { lankaYupValidator } from "./lankaYupValidator";

/**
 * The same three rows every validator in the family measures, so the numbers can
 * be read against each other.
 *
 * This one is worth reading beside the others for a reason the others do not
 * have: it is the only package here whose rows include a `try`/`catch` on the
 * failure path, because yup reports a refusal by throwing. A refusal is not the
 * rare case in a form — it is what every keystroke before the last one produces —
 * so the third row is the one to watch when this file changes.
 */
describe("lankaYupValidator", () => {
	lankaBenchCalibration();

	const todo = yup.object({
		id: yup.number().required(),
		title: yup.string().required(),
		done: yup.boolean().required(),
	});

	const list = yup.array(todo).required();

	const one = { id: 1, title: "write the canon", done: false };
	const hundred = Array.from({ length: 100 }, (_, index) => ({ ...one, id: index }));

	bench(
		"one object, validated",
		() => {
			lankaYupValidator.validate(todo, one, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a hundred of them, which is a list screen",
		() => {
			lankaYupValidator.validate(list, hundred, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a refusal, which a screen renders rather than throws away",
		() => {
			lankaYupValidator.validateSafe(todo, { id: "not a number" });
		},
		LANKA_BENCH_OPTIONS,
	);
});
