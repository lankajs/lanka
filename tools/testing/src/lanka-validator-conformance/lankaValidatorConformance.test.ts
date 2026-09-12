import { describe, expect, it } from "vitest";
import { lankaStandardValidator, LankaValidationError } from "lanka/validation";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
	LANKA_CONFORMANCE_VALID,
	LANKA_CONFORMANCE_WIRE,
	lankaValidatorConformance,
} from "./lankaValidatorConformance";

/**
 * The family's shared suite, run against a correct implementation.
 *
 * ## Why the kit tests its own suite
 *
 * Six packages depend on this file for the proof that they keep their promise.
 * A suite that passes anything is the second way a check reports success — it
 * never asked the question — and nothing else in the repository would notice,
 * because every caller would still be green.
 *
 * So the schemas here are built BY HAND, out of nothing but the Standard Schema
 * protocol. The kit has no schema library and must not grow one: a suite that
 * needed zod to test itself would be a suite that cannot be trusted to judge
 * valibot.
 *
 * ## What proves it can FAIL
 *
 * Not a synthetic case — a real one. Run against `@lankajs/arktype` the first
 * time, this suite refused the package: arktype reports `issue.path` as its own
 * `ReadonlyPath`, an Array subclass carrying a cache, and `Array.prototype.map`
 * preserved the subclass all the way out through core's port. It printed
 * identically to a plain array and compared unequal. The fix is in
 * `lankaStandardValidator` and is pinned by a test there.
 */

/** A hand-built Standard Schema: a check, and the value it produces. */
const schemaOf = <TOutput>(
	run: (data: unknown) => StandardSchemaV1.Result<TOutput>,
): StandardSchemaV1<unknown, TOutput> => ({
	"~standard": { version: 1, vendor: "conformance-test", validate: run },
});

const isRecord = (data: unknown): data is Record<string, unknown> =>
	typeof data === "object" && data !== null;

const signUp = schemaOf((data) => {
	if (!isRecord(data)) return { issues: [{ message: "expected an object" }] };

	const issues: StandardSchemaV1.Issue[] = [];

	if (typeof data.email !== "string" || !data.email.includes("@")) {
		issues.push({ message: "must be an email", path: ["email"] });
	}
	if (typeof data.age !== "number" || !Number.isInteger(data.age) || data.age < 18) {
		issues.push({ message: "must be at least 18", path: ["age"] });
	}

	const tags: unknown[] = Array.isArray(data.tags) ? data.tags : [];
	tags.forEach((tag, index) => {
		if (isRecord(tag) && typeof tag.id === "number") return;
		issues.push({ message: "must be a number", path: ["tags", index, "id"] });
	});

	return issues.length > 0 ? { issues } : { value: data };
});

const apiShape = schemaOf((data) => {
	if (!isRecord(data)) return { issues: [{ message: "expected an object" }] };

	const issues: StandardSchemaV1.Issue[] = [];
	if (typeof data.user_email !== "string") {
		issues.push({ message: "must be a string", path: ["user_email"] });
	}
	if (typeof data.user_age !== "number") {
		issues.push({ message: "must be a number", path: ["user_age"] });
	}
	if (data.is_active !== 0 && data.is_active !== 1) {
		issues.push({ message: "must be 0 or 1", path: ["is_active"] });
	}
	if (issues.length > 0) return { issues };

	return {
		value: {
			email: data.user_email as string,
			age: data.user_age as number,
			isActive: data.is_active === 1,
		},
	};
});

const toApi = schemaOf((data) => {
	if (!isRecord(data)) return { issues: [{ message: "expected an object" }] };

	return {
		value: {
			user_email: data.email as string,
			user_age: data.age as number,
			is_active: data.isActive === true ? 1 : 0,
		},
	};
});

lankaValidatorConformance({
	vendor: "a hand-built Standard Schema",
	validator: lankaStandardValidator,
	signUp,
	apiShape,
	toApi,
});

/**
 * The same suite over a DEFENSIVE validator, and the reason is not coverage.
 *
 * The six packages differ in one visible way at the edges: handed a value whose
 * getter throws, some let the exception out and some catch it and refuse. The
 * suite tolerates both, and a suite that tolerates two behaviours while only
 * ever being run against one has never been shown to tolerate the other.
 *
 * So the second registration wraps the port in the guard a careful validator
 * would have, and every scene runs again.
 */
const defensive = {
	validate: (schema: StandardSchemaV1<unknown, unknown>, data: unknown, context: string) =>
		lankaStandardValidator.validate(schema, data, context),
	validateSafe: (schema: StandardSchemaV1<unknown, unknown>, data: unknown) => {
		try {
			return lankaStandardValidator.validateSafe(schema, data);
		} catch (error) {
			// Only a failure the DATA caused is turned into an outcome. A schema the
			// port cannot read still throws, as every package in the family does.
			if (error instanceof LankaValidationError && error.message.includes("not a Standard")) {
				throw error;
			}

			return { success: false as const, errors: [String(error)] };
		}
	},
};

lankaValidatorConformance({
	vendor: "a validator that refuses rather than throws",
	validator: defensive,
	signUp,
	apiShape,
	toApi,
});

describe("the fixtures the suite drives every package with", () => {
	it("holds a submission the agreed shape accepts", () => {
		expect(lankaStandardValidator.validateSafe(signUp, LANKA_CONFORMANCE_VALID).success).toBe(
			true,
		);
	});

	it("holds a wire the agreed mapping reads", () => {
		expect(lankaStandardValidator.validate(apiShape, LANKA_CONFORMANCE_WIRE, "wire")).toEqual({
			email: "ada@example.test",
			age: 36,
			isActive: true,
		});
	});

	it("keeps both frozen, since six packages share them", () => {
		// A package mutating a fixture would change what the other five are tested
		// with, and the failure would land anywhere but here.
		expect(Object.isFrozen(LANKA_CONFORMANCE_VALID)).toBe(true);
		expect(Object.isFrozen(LANKA_CONFORMANCE_WIRE)).toBe(true);
	});
});
