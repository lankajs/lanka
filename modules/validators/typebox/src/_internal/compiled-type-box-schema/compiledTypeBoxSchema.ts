import { Compile } from "typebox/compile";
import { HasCodec } from "typebox/value";
import type { TSchema } from "typebox";
import type { Validator } from "typebox/compile";

/** What is known about one schema once, and re-read on every call after that. */
export interface ICompiledTypeBoxSchema {
	/** The compiled checker: a function TypeBox generated for this schema. */
	check: Validator;
	/**
	 * Whether anything in the schema has a codec.
	 *
	 * Asked once because the answer cannot change — a schema is a value — and
	 * because it decides whether a second pass is needed at all. Most schemas have
	 * no codec, and those must not pay for a copy and a decode.
	 */
	codecs: boolean;
}

/**
 * The compiled checker for a schema, compiled at most once.
 *
 * ## Why this exists
 *
 * `Compile` turns a schema into a generated function, and that
 * function is the fastest validator in JavaScript. Compiling is not fast.
 * Compiling per call would make this the SLOWEST package in the family while the
 * README advertised the opposite — the exact shape of a claim that wins a
 * microbenchmark and loses in an application.
 *
 * ## Why a WeakMap
 *
 * The key is the CONSUMER'S schema object. A strong map would keep every schema
 * any screen ever built alive for the life of the tab, which is a leak the
 * consumer cannot see, cannot measure and cannot clear. Weak, the entry goes when
 * the schema does.
 *
 * A schema rebuilt on every render defeats the cache — it is a new key each
 * time — and that is a fact worth knowing rather than a case to work around:
 * declare schemas at module level, which is where they belong anyway.
 */
const compiled = new WeakMap<TSchema, ICompiledTypeBoxSchema>();

export const compiledTypeBoxSchema = (schema: TSchema): ICompiledTypeBoxSchema => {
	const known = compiled.get(schema);
	if (known) return known;

	const fresh: ICompiledTypeBoxSchema = {
		check: Compile(schema),
		codecs: HasCodec(schema),
	};

	compiled.set(schema, fresh);

	return fresh;
};
