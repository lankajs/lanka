import { describe, expect, it, vi } from "vitest";
import { createLankaAnySchemaValidator } from "./createLankaAnySchemaValidator";
import type { ILankaDialectValidator } from "../../_interfaces/ILankaDialectValidator";

/**
 * The router, driven by doubles.
 *
 * The question here is WHICH validator was called and what happens when none
 * was registered — not whether any library validates, which is the vendor
 * packages' own business and the playground's.
 */
const recording = (answer: unknown = { id: 1 }): ILankaDialectValidator & { calls: number } => {
	const double = {
		calls: 0,
		validate: vi.fn(() => {
			double.calls += 1;
			return answer;
		}),
		validateSafe: vi.fn(() => {
			double.calls += 1;
			return { success: true as const, data: answer };
		}),
	};

	return double;
};

const standardSchema = { "~standard": { version: 1, vendor: "x" } };
const yupSchema = { validateSync: () => null, "~standard": { version: 1, vendor: "yup" } };
const typeBoxSchema = { [Symbol.for("TypeBox.Kind")]: "Object" };
const effectSchema = { [Symbol.for("effect/Schema")]: true, ast: {} };

describe("createLankaAnySchemaValidator", () => {
	it("sends each dialect to its own validator and nowhere else", () => {
		const standard = recording();
		const yup = recording();
		const typebox = recording();
		const effect = recording();

		const validator = createLankaAnySchemaValidator({ standard, yup, typebox, effect });

		validator.validate(standardSchema, {}, "a");
		validator.validate(yupSchema, {}, "b");
		validator.validate(typeBoxSchema, {}, "c");
		validator.validate(effectSchema, {}, "d");

		expect([standard.calls, yup.calls, typebox.calls, effect.calls]).toEqual([1, 1, 1, 1]);
	});

	it("passes the label through, because it is what names the failing call", () => {
		const standard = recording();

		createLankaAnySchemaValidator({ standard }).validate(
			standardSchema,
			{ a: 1 },
			"todos.byId",
		);

		expect(standard.validate).toHaveBeenCalledWith(standardSchema, { a: 1 }, "todos.byId");
	});

	it("returns what the vendor validator returned, untouched", () => {
		const standard = recording({ mapped: true });

		expect(
			createLankaAnySchemaValidator({ standard }).validate(standardSchema, {}, "x"),
		).toEqual({ mapped: true });
	});

	it("refuses a dialect nothing was registered for, naming the package to install", () => {
		const validator = createLankaAnySchemaValidator({ standard: recording() });

		expect(() => validator.validate(typeBoxSchema, {}, "x")).toThrowError(/@lankajs\/typebox/);
		expect(() => validator.validate(yupSchema, {}, "x")).toThrowError(/@lankajs\/yup/);
		expect(() => validator.validate(effectSchema, {}, "x")).toThrowError(/@lankajs\/effect/);
	});

	it("names all three Standard Schema packages, since any of them would do", () => {
		const validator = createLankaAnySchemaValidator({ typebox: recording() });

		expect(() => validator.validate(standardSchema, {}, "x")).toThrowError(
			/@lankajs\/zod.*@lankajs\/valibot.*@lankajs\/arktype/s,
		);
	});

	it("refuses a value that is not a schema at all, differently", () => {
		const validator = createLankaAnySchemaValidator({ standard: recording() });

		// Told apart from "no validator registered": one is an install, the other is
		// a bug in the calling code, and a single message would send half the
		// readers the wrong way.
		expect(() => validator.validate({ nope: true }, {}, "x")).toThrowError(
			/not a schema of any dialect/i,
		);
	});

	it("refuses from `validateSafe` too, because an unusable schema is not an outcome", () => {
		// A refused VALUE is something a form renders. A schema nothing was
		// registered for is a wiring mistake, and returning it as `errors` would put
		// a programmer's error beside a user's input.
		const validator = createLankaAnySchemaValidator({ standard: recording() });

		expect(() => validator.validateSafe(typeBoxSchema, {})).toThrowError(/@lankajs\/typebox/);
		expect(() => validator.validateSafe(42, {})).toThrowError(/not a schema/i);
	});

	it("is frozen, and empty registration is legal until a schema arrives", () => {
		const validator = createLankaAnySchemaValidator({});

		expect(Object.isFrozen(validator)).toBe(true);
		// An application wiring the hub before it has chosen anything should fail at
		// the first validation, not at start-up: the failure then names the schema.
		expect(() => validator.validate(standardSchema, {}, "x")).toThrowError(/standard/);
	});

	it("decides the dialect per CALL, so one hub serves every schema an app holds", () => {
		const standard = recording();
		const typebox = recording();
		const validator = createLankaAnySchemaValidator({ standard, typebox });

		validator.validateSafe(standardSchema, {});
		validator.validateSafe(typeBoxSchema, {});
		validator.validateSafe(standardSchema, {});

		expect([standard.calls, typebox.calls]).toEqual([2, 1]);
	});
});

describe("a dialect the application registered itself", () => {
	/**
	 * The extension point. Four dialects ship here, and an application using a
	 * fifth library — or its own schema type — must not have to wait for a release.
	 */
	const brandedSchema = { __acme: true };
	const acme = (validator = recording()) => ({
		name: "acme",
		accepts: (schema: unknown) =>
			typeof schema === "object" && schema !== null && "__acme" in schema,
		validator,
	});

	it("routes a schema no built-in dialect recognises", () => {
		const validator = recording();

		createLankaAnySchemaValidator({ custom: [acme(validator)] }).validate(
			brandedSchema,
			{},
			"acme",
		);

		expect(validator.calls).toBe(1);
	});

	it("is asked BEFORE the built-in dialects, so a built-in can be overridden", () => {
		// The scene: a team wraps their TypeBox validator with logging and registers
		// it as a custom dialect. Nothing is forked, and the built-in stays behind it.
		const wrapper = recording();
		const builtIn = recording();

		createLankaAnySchemaValidator({
			typebox: builtIn,
			custom: [
				{
					name: "typebox-with-logging",
					accepts: (schema) =>
						typeof schema === "object" &&
						schema !== null &&
						Symbol.for("TypeBox.Kind") in schema,
					validator: wrapper,
				},
			],
		}).validate(typeBoxSchema, {}, "x");

		expect([wrapper.calls, builtIn.calls]).toEqual([1, 0]);
	});

	it("asks them in the order given, and the first claim wins", () => {
		const first = recording();
		const second = recording();

		createLankaAnySchemaValidator({
			custom: [
				{ name: "first", accepts: () => true, validator: first },
				{ name: "second", accepts: () => true, validator: second },
			],
		}).validate(brandedSchema, {}, "x");

		expect([first.calls, second.calls]).toEqual([1, 0]);
	});

	it("falls through to the built-in dialects when nothing claims the schema", () => {
		const standard = recording();

		createLankaAnySchemaValidator({
			standard,
			custom: [{ name: "acme", accepts: () => false, validator: recording() }],
		}).validate(standardSchema, {}, "x");

		expect(standard.calls).toBe(1);
	});

	it("names the registered dialects when nothing recognises the value", () => {
		// So the reader can see that their own predicate was asked and said no,
		// rather than wondering whether the registration took effect at all.
		const validator = createLankaAnySchemaValidator({ custom: [acme()] });

		expect(() => validator.validate({ nope: true }, {}, "x")).toThrowError(/acme/);
	});

	it("reports a predicate that throws as what it is, rather than crashing the router", () => {
		// `accepts` is the application's code and is asked about ANY value — `null`,
		// a number — before anything has decided the value is a schema. One that
		// reaches into the value without a guard throws here.
		const validator = createLankaAnySchemaValidator({
			custom: [
				{
					name: "careless",
					accepts: (schema) => (schema as { deep: { key: string } }).deep.key === "x",
					validator: recording(),
				},
			],
		});

		expect(() => validator.validate(standardSchema, {}, "x")).toThrowError(
			/custom dialect "careless" threw/i,
		);
	});

	it("says what a predicate threw, even when it was not an Error", () => {
		// Application code may throw anything. Reading `.message` off a string
		// yields `undefined`, and a refusal that ends in "It said: undefined" is a
		// refusal nobody can act on.
		const validator = createLankaAnySchemaValidator({
			custom: [
				{
					name: "rude",
					accepts: () => {
						// non-Error is exactly what is under test: application code may do it.
						// eslint-disable-next-line @typescript-eslint/only-throw-error -- the point of the test
						throw "a bare string";
					},
					validator: recording(),
				},
			],
		});

		expect(() => validator.validate(standardSchema, {}, "x")).toThrowError(/a bare string/);
	});

	it("holds a predicate to answering about null and a number", () => {
		const validator = createLankaAnySchemaValidator({
			standard: recording(),
			custom: [acme()],
		});

		// The built-in refusal, not a crash from inside `accepts`.
		expect(() => validator.validate(null, {}, "x")).toThrowError(
			/not a schema of any dialect/i,
		);
		expect(() => validator.validate(42, {}, "x")).toThrowError(/not a schema of any dialect/i);
	});
});
