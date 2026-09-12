import { bench, describe } from "vitest";
import { Type } from "@sinclair/typebox";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { lankaTypeBoxValidator } from "./lankaTypeBoxValidator";

/**
 * The same three rows every validator in the family measures, plus the one row
 * only this package has.
 *
 * The fourth row is the reason `compiledTypeBoxSchema` exists: it builds a NEW
 * schema object per iteration, so the cache never hits and `TypeCompiler.Compile`
 * runs every time. Read against the first row it is the price of getting the
 * cache wrong — and a package advertising the fastest validator in JavaScript
 * while paying that price would be advertising the opposite of what it does.
 *
 * A schema built inside a component body is exactly that row.
 */
describe("lankaTypeBoxValidator", () => {
	lankaBenchCalibration();

	const todo = Type.Object({
		id: Type.Number(),
		title: Type.String(),
		done: Type.Boolean(),
	});

	const list = Type.Array(todo);

	const one = { id: 1, title: "write the canon", done: false };
	const hundred = Array.from({ length: 100 }, (_, index) => ({ ...one, id: index }));

	bench(
		"one object, validated",
		() => {
			lankaTypeBoxValidator.validate(todo, one, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a hundred of them, which is a list screen",
		() => {
			lankaTypeBoxValidator.validate(list, hundred, "bench");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a refusal, which a screen renders rather than throws away",
		() => {
			lankaTypeBoxValidator.validateSafe(todo, { id: "not a number" });
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"a schema rebuilt per call, which is the cache never hitting",
		() => {
			lankaTypeBoxValidator.validate(
				Type.Object({ id: Type.Number(), title: Type.String(), done: Type.Boolean() }),
				one,
				"bench",
			);
		},
		LANKA_BENCH_OPTIONS,
	);
});
