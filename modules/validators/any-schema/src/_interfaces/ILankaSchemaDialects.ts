import type { ILankaCustomDialect } from "./ILankaCustomDialect";
import type { ILankaDialectValidator } from "./ILankaDialectValidator";

/**
 * The validators an application installed, one per dialect it uses.
 *
 * Every field is optional, and a missing one is not a gap to fill later: an
 * application that never writes a TypeBox schema should not be asked for a
 * TypeBox validator. A schema whose dialect has no entry is refused by name, so
 * the omission is reported where it happens rather than guessed around.
 */
export interface ILankaSchemaDialects {
	/**
	 * Any SYNCHRONOUS Standard Schema: zod 4, valibot, arktype, and whatever
	 * implements the specification next. One entry for all of them, because the
	 * port cannot tell them apart and has no reason to.
	 */
	standard?: ILankaDialectValidator;
	/** `@lankajs/yup` — required for yup, whose own Standard Schema is async. */
	yup?: ILankaDialectValidator;
	/** `@lankajs/typebox` — required for TypeBox, which publishes no Standard Schema. */
	typebox?: ILankaDialectValidator;
	/** `@lankajs/effect` — required for Effect, whose Standard Schema is a function. */
	effect?: ILankaDialectValidator;

	/**
	 * Dialects this application taught the hub about, asked BEFORE the four above.
	 *
	 * The four built-in dialects are the four with a lanka package behind them. A
	 * library without one — superstruct, io-ts, a company's own schema type,
	 * something published next year — is registered here, and nothing in the
	 * framework has to change for it.
	 *
	 * Asked first, and in order, so this is also how a built-in dialect is
	 * overridden: a team wrapping their TypeBox validator with logging registers a
	 * custom dialect that recognises TypeBox, and it wins.
	 */
	custom?: readonly ILankaCustomDialect[];
}
