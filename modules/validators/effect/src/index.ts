/**
 * @lankajs/effect — conveniences for an application whose schemas are Effect's.
 *
 * ## Why a package when Effect implements Standard Schema
 *
 * It implements it through a FUNCTION. An Effect schema carries no `~standard`;
 * `Schema.standardSchemaV1(schema)` builds one, and builds a different one on
 * every call. Handed straight to core's port, each validation would allocate a
 * wrapper and throw it away.
 *
 * `lankaEffectValidator` caches that wrapper per schema and hands the rest to
 * core. That is the whole package: one thing held still, so the choice of
 * library is visible in the dependency list and costs nothing at runtime.
 *
 * ## What is deliberately absent
 *
 * No Effect runtime, no `Effect.runSync`, no error channel. An application using
 * Effect has its own runtime, and a second one started inside a validator is a
 * second one to reason about.
 */

export { lankaEffectValidator } from "./lanka-effect-validator/lankaEffectValidator";
export type { TLankaInferred } from "./_types/TLankaInferred";
