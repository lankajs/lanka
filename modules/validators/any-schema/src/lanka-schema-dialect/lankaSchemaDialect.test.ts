import { describe, expect, it } from "vitest";
import { lankaSchemaDialect } from "./lankaSchemaDialect";

/**
 * The dialect table, driven by hand-built markers.
 *
 * Deliberately NOT driven by the six real libraries here: this package has no
 * dependency on any of them, and a unit test that installed all six would make
 * the package look like it needs them. The agreement between this table and the
 * real libraries is asserted in `_playground/`, where the mixed application
 * lives and every library is present for a reason.
 */
describe("lankaSchemaDialect", () => {
	it("calls a synchronous Standard Schema `standard`", () => {
		expect(lankaSchemaDialect({ "~standard": { version: 1, vendor: "x" } })).toBe("standard");
	});

	it("calls a CALLABLE Standard Schema `standard`, which is what arktype is", () => {
		// arktype's schema is a function with `~standard` on its prototype. A table
		// reading only objects would call every arktype schema "unknown".
		const callable = Object.assign((value: unknown) => value, {
			"~standard": { version: 1, vendor: "callable" },
		});

		expect(lankaSchemaDialect(callable)).toBe("standard");
	});

	it("calls a schema with `validateSync` yup — even though it also carries `~standard`", () => {
		// The order that matters. yup implements Standard Schema with an `async`
		// validate, so a table asking for `~standard` first would route every yup
		// schema to a validator that cannot run it.
		const yupLike = { validateSync: () => null, "~standard": { version: 1, vendor: "yup" } };

		expect(lankaSchemaDialect(yupLike)).toBe("yup");
	});

	it("calls a schema carrying TypeBox's Kind `typebox`", () => {
		expect(lankaSchemaDialect({ [Symbol.for("TypeBox.Kind")]: "Object" })).toBe("typebox");
	});

	it("calls a schema carrying Effect's marker `effect`", () => {
		expect(lankaSchemaDialect({ [Symbol.for("effect/Schema")]: true, ast: {} })).toBe("effect");
	});

	it("calls everything else unknown rather than guessing", () => {
		for (const value of [null, undefined, 42, "schema", true, {}, [], Symbol("x")]) {
			expect(lankaSchemaDialect(value), String(value?.toString())).toBe("unknown");
		}
	});

	it("survives an object with a null prototype", () => {
		// `Object.create(null)` has no `hasOwnProperty` and no prototype chain. A
		// table reaching for either crashes on a body parsed with a reviver.
		const bare = Object.create(null) as Record<string, unknown>;
		expect(lankaSchemaDialect(bare)).toBe("unknown");

		bare["~standard"] = { version: 1, vendor: "bare" };
		expect(lankaSchemaDialect(bare)).toBe("standard");
	});

	it("does not mistake a plain object that merely has a `validateSync` PROPERTY", () => {
		// A configuration object with a boolean of that name is not a yup schema.
		expect(lankaSchemaDialect({ validateSync: true })).toBe("unknown");
	});
});
