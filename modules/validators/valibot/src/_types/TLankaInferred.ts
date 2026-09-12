import type * as v from "valibot";

/** The type a schema infers. */
export type TLankaInferred<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>> =
	v.InferOutput<TSchema>;
