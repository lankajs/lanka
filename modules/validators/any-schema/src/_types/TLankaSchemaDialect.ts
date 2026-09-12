/**
 * The four schema dialects lanka can validate, and the answer for anything else.
 *
 * A DIALECT is not a library: `standard` covers zod 4, valibot, arktype and
 * every other synchronous Standard Schema implementation, present and future.
 * The other three are named for their libraries because each is a shape only
 * that library produces.
 *
 * `unknown` is a real answer rather than a failure. A value that is not a schema
 * at all reaches the validator the same way a schema from an unsupported library
 * does, and both deserve to be told apart from "a schema whose validator you did
 * not register".
 */
export type TLankaSchemaDialect = "standard" | "yup" | "typebox" | "effect" | "unknown";
