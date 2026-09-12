/**
 * @lankajs/any-schema — for the application that ended up with two schema
 * libraries.
 *
 * ## Read this first: it is not the recommended way to use lanka
 *
 * One application, one schema library. Two means two ways to spell the same
 * rule, two sets of error messages, and a reviewer who has to know both. Every
 * other package in `modules/validators/` says to install exactly one, and that
 * advice does not change because this exists.
 *
 * It happens anyway — a merger, a team that standardised elsewhere, a vendored
 * SDK exporting zod schemas into an application written in Effect — so mixing is
 * supported deliberately and with tests, rather than left to fail in a way
 * nobody predicted.
 *
 * ## What it does
 *
 * Routes a schema to the validator for its DIALECT, decided by shape: a
 * synchronous Standard Schema, a yup schema, a TypeBox schema, an Effect schema.
 * A schema whose dialect has no registered validator is refused by name, and so
 * is a value that is not a schema at all.
 *
 * ## What it does not do
 *
 * Depend on a single schema library. The dialects are told apart by the markers
 * their libraries put on every schema, so an application pays only for the ones
 * it installed.
 *
 * ## Two ways out for a library lanka has never heard of
 *
 * **Register it.** A `custom` dialect is a name, a predicate and a validator, and
 * the hub asks those before the four built-in ones — which is also how a
 * built-in dialect is overridden.
 *
 * **Or write the schema here.** `createLankaSchema` builds a Standard Schema out
 * of a function, so a shape with no library behind it is still validated by
 * everything in the family. It is not a schema library and will not become one:
 * wanting composition is the signal to install one of the six packages.
 */

export { createLankaAnySchemaValidator } from "./_factories/create-lanka-any-schema-validator/createLankaAnySchemaValidator";
export type { ILankaAnySchemaValidator } from "./_factories/create-lanka-any-schema-validator/createLankaAnySchemaValidator";
export { createLankaSchema } from "./_factories/create-lanka-schema/createLankaSchema";
export { lankaSchemaDialect } from "./lanka-schema-dialect/lankaSchemaDialect";
export type { TLankaSchemaDialect } from "./_types/TLankaSchemaDialect";
export type { ILankaSchemaDialects } from "./_interfaces/ILankaSchemaDialects";
export type { ILankaDialectValidator } from "./_interfaces/ILankaDialectValidator";
export type { ILankaCustomDialect } from "./_interfaces/ILankaCustomDialect";
export type { ILankaSchemaIssue } from "./_interfaces/ILankaSchemaIssue";
export type { TLankaSchemaReader } from "./_types/TLankaSchemaReader";
