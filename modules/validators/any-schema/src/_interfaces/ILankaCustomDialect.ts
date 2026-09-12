import type { ILankaDialectValidator } from "./ILankaDialectValidator";

/**
 * A dialect the application taught the hub about.
 *
 * Four dialects ship with this package, and they are the four with a lanka
 * package behind them. An application using superstruct, io-ts, a company's own
 * schema type or a library that did not exist when this was written has a fifth,
 * and nothing in the framework should have to be changed for it.
 *
 * So a custom dialect is a pair: how to RECOGNISE a schema, and what to do with
 * it. The hub asks the custom dialects FIRST, in the order given, which also
 * makes this the way to override a built-in one — a team wrapping their
 * TypeBox validator with logging registers a custom dialect that recognises
 * TypeBox and wins.
 *
 * ```ts
 * const superstruct: ILankaCustomDialect = {
 * 	name: "superstruct",
 * 	accepts: (schema) => schema instanceof Struct,
 * 	validator: superstructValidator,
 * };
 * ```
 */
export interface ILankaCustomDialect {
	/**
	 * What this dialect is called, in the error when nothing else matches.
	 *
	 * A name a reader recognises — the library's own — rather than a description.
	 * It appears in messages and nowhere else, so it costs nothing to be plain.
	 */
	readonly name: string;

	/**
	 * Whether this dialect owns the schema.
	 *
	 * It must answer for ANY value, including `null`, a number and an object with
	 * a null prototype: the hub hands it whatever the caller passed, before
	 * anything has decided the value is a schema at all. A predicate that throws
	 * here turns a wrong argument into a crash.
	 *
	 * Recognise by a MARKER the library puts on every schema rather than by
	 * `instanceof` where there is a choice: a duplicate copy of a library in a
	 * dependency tree produces schemas that fail `instanceof` and work perfectly.
	 */
	accepts(schema: unknown): boolean;

	/** What validates a schema of this dialect. */
	readonly validator: ILankaDialectValidator;
}
