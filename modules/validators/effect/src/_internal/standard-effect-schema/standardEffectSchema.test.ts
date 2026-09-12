import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { standardEffectSchema } from "./standardEffectSchema";

/**
 * The cache, driven directly — and the measurement it rests on.
 *
 * The first assertion is the reason the file exists. If Effect ever puts
 * `~standard` on the schema itself, or returns the same wrapper twice, it fails
 * and the cache becomes dead weight to be removed.
 */
describe("standardEffectSchema", () => {
	const user = Schema.Struct({ id: Schema.Number });

	it("Effect builds a NEW wrapper on every call, which is what there is to cache", () => {
		expect(Schema.standardSchemaV1(user)).not.toBe(Schema.standardSchemaV1(user));
	});

	it("hands back the same wrapper for the same schema", () => {
		expect(standardEffectSchema(user)).toBe(standardEffectSchema(user));
	});

	it("wraps a different schema separately", () => {
		expect(standardEffectSchema(user)).not.toBe(
			standardEffectSchema(Schema.Struct({ id: Schema.String })),
		);
	});

	it("produces a wrapper the port can actually read", () => {
		const standard = standardEffectSchema(user);

		expect(standard["~standard"].validate({ id: 1 })).toEqual({ value: { id: 1 } });
	});
});

describe("a schema from another library", () => {
	/**
	 * An application whose schemas come from two libraries eventually hands one to
	 * the wrong validator. These are the messages it gets, and they are the
	 * package's contract as much as the happy path is.
	 */
	const standardLike = {
		"~standard": {
			version: 1 as const,
			vendor: "somebody-else",
			validate: (data: unknown) => ({ value: data }),
		},
	};

	it("is refused by name, rather than dying inside Effect", () => {
		// Before the guard this read `_tag` off a zod schema and produced
		// "Cannot read properties of undefined" — an error naming neither library.
		expect(() => standardEffectSchema(standardLike as never)).toThrowError(
			/not an Effect schema/i,
		);
	});

	it("is told that its own dialect has a package, when it carries `~standard`", () => {
		expect(() => standardEffectSchema(standardLike as never)).toThrowError(/~standard/);
	});

	it("reads a CALLABLE schema too, which is what arktype hands it", () => {
		// arktype's schema is a function, not an object. A hint that only inspects
		// objects would tell an arktype user "not a schema at all" and send them
		// looking for a bug that is not there.
		const callable = Object.assign((value: unknown) => value, standardLike);

		expect(() => standardEffectSchema(callable as never)).toThrowError(/~standard/);
	});

	it("is told something else when it is not a schema at all", () => {
		// Two different mistakes: a schema from the wrong library is a routing
		// error, and a plain object is a bug in the calling code.
		expect(() => standardEffectSchema({ nope: true } as never)).toThrowError(
			/not a schema at all/i,
		);
		expect(() => standardEffectSchema(null as never)).toThrowError(/not an Effect schema/i);
	});
});
