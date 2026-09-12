import { LankaValidationError } from "lanka/validation";
import type { TLankaValidationResult } from "lanka/validation";
import { lankaSchemaDialect } from "../../lanka-schema-dialect/lankaSchemaDialect";
import type { ILankaCustomDialect } from "../../_interfaces/ILankaCustomDialect";
import type { ILankaDialectValidator } from "../../_interfaces/ILankaDialectValidator";
import type { ILankaSchemaDialects } from "../../_interfaces/ILankaSchemaDialects";
import type { TLankaSchemaDialect } from "../../_types/TLankaSchemaDialect";

/** What the hub is: the port's two methods, over a schema of any dialect. */
export interface ILankaAnySchemaValidator {
	/** Validates and returns the parsed value, or throws. */
	validate<TOutput = unknown>(schema: unknown, data: unknown, context: string): TOutput;
	/** Validates and returns an outcome, throwing nothing the data caused. */
	validateSafe<TOutput = unknown>(
		schema: unknown,
		data: unknown,
	): TLankaValidationResult<TOutput>;
}

/**
 * One validator over the several an application ended up with.
 *
 * ## Read this before using it
 *
 * **One application, one schema library.** Two means two ways to spell the same
 * rule, two sets of error messages, and a reviewer who has to know both. Every
 * other package in `modules/validators/` says to install exactly one, and that
 * advice does not change because this exists.
 *
 * It happens anyway — a merger, a team that standardised elsewhere, a vendored
 * SDK exporting zod schemas into an application written in Effect — so it is
 * supported deliberately and with tests, rather than left to fail in a way
 * nobody predicted.
 *
 * ## Why routing, and not a `try`/`catch` ladder
 *
 * Every vendor validator now refuses a schema from another library loudly. The
 * obvious workaround is to try each in turn and keep the first that does not
 * throw — and that turns a wiring mistake into a value that passed on the third
 * attempt, with a validator nobody chose. Worse, it cannot tell "your schema is
 * from a library you did not register" from "your data is wrong".
 *
 * Routing by dialect keeps the two apart: the dialect is decided by the schema's
 * shape, exactly once, before anything is validated.
 *
 * ## What it costs
 *
 * Inference. `validate` cannot infer an output type across four dialects, so it
 * returns `unknown` unless the caller names one. That is one more reason not to
 * mix — and the reason the type parameter is explicit rather than hidden.
 *
 * ```ts
 * export const appValidator = createLankaAnySchemaValidator({
 * 	standard: lankaZodValidator, // and every other Standard Schema library
 * 	typebox: lankaTypeBoxValidator,
 * });
 *
 * const todo = appValidator.validate<ITodo>(anySchema, body, "todos.byId");
 * ```
 */
export const createLankaAnySchemaValidator = (
	dialects: ILankaSchemaDialects,
): ILankaAnySchemaValidator =>
	Object.freeze<ILankaAnySchemaValidator>({
		validate<TOutput = unknown>(schema: unknown, data: unknown, context: string): TOutput {
			return routeTo(dialects, schema).validate(schema as never, data, context) as TOutput;
		},

		validateSafe<TOutput = unknown>(
			schema: unknown,
			data: unknown,
		): TLankaValidationResult<TOutput> {
			return routeTo(dialects, schema).validateSafe(
				schema as never,
				data,
			) as TLankaValidationResult<TOutput>;
		},
	});

/**
 * The validator for this schema's dialect, or a refusal naming what is missing.
 *
 * It throws rather than returning an outcome, and from `validateSafe` too. A
 * refused VALUE is something a form renders; a schema nothing was registered for
 * is a wiring mistake, and putting it in `errors` would show a programmer's
 * error to a user beside an input. Core and all six vendor packages refuse an
 * unusable schema the same way, for the same reason.
 */
function routeTo(dialects: ILankaSchemaDialects, schema: unknown): ILankaDialectValidator {
	// The application's own dialects first, and in the order it gave them. That
	// order is the whole extension point: a custom dialect recognising TypeBox
	// wins over the built-in one, which is how a team wraps a vendor validator
	// without forking anything.
	const custom = (dialects.custom ?? []).find((entry) => accepts(entry, schema));
	if (custom) return custom.validator;

	const dialect = lankaSchemaDialect(schema);

	if (dialect === "unknown") {
		const registered = (dialects.custom ?? []).map((entry) => entry.name);

		throw new LankaValidationError(
			"This value is not a schema of any dialect lanka knows. It carries no " +
				"`~standard`, no `validateSync`, no TypeBox `Kind` and no Effect marker" +
				(registered.length > 0 ? `, and none of ${registered.join(", ")} claimed it` : "") +
				". So it is either not a schema, or from a library with no package in " +
				"`modules/validators/` — register it as a custom dialect, or write it " +
				"with `createLankaSchema`.",
			[],
		);
	}

	const validator = dialects[dialect];

	if (!validator) {
		throw new LankaValidationError(
			`This is a ${dialect} schema, and no validator was registered for the ` +
				`"${dialect}" dialect. Install ${packageFor(dialect)} and pass it to ` +
				"`createLankaAnySchemaValidator`.",
			[],
		);
	}

	return validator;
}

/** Which package supplies a dialect's validator, so the refusal ends in an install. */
function packageFor(dialect: Exclude<TLankaSchemaDialect, "unknown">): string {
	if (dialect === "standard") {
		return "one of `@lankajs/zod`, `@lankajs/valibot` or `@lankajs/arktype`";
	}

	return `\`@lankajs/${dialect}\``;
}

/**
 * Whether a custom dialect claims the schema, with its predicate held to the
 * contract the interface states.
 *
 * A predicate is the application's code and is asked about ANY value — `null`, a
 * number, an object with a null prototype — before anything has decided the
 * value is a schema. One that throws would turn a wrong argument into a crash
 * inside the router, where the message would name neither the dialect nor the
 * call. It is reported as what it is instead.
 */
function accepts(entry: ILankaCustomDialect, schema: unknown): boolean {
	try {
		return entry.accepts(schema);
	} catch (error) {
		throw new LankaValidationError(
			`The custom dialect "${entry.name}" threw while deciding whether it owns a ` +
				"schema. `accepts` is asked about any value at all and must answer rather " +
				`than throw. It said: ${error instanceof Error ? error.message : String(error)}`,
			[],
		);
	}
}
