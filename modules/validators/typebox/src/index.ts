/**
 * @lankajs/typebox — the bridge for the one library in the family with no
 * Standard Schema.
 *
 * ## Why a bridge and not a name
 *
 * Most packages under `modules/validators/` exist to make a CHOICE visible: core
 * already accepts the library's schemas, and the package is a name. TypeBox
 * publishes no `~standard` at all, so core's port cannot be handed one of its
 * schemas and this package is what makes the library usable here.
 *
 * ## The compiled checker, and why it is cached
 *
 * `TypeCompiler.Compile(schema)` produces the fastest validator in JavaScript,
 * and compiling is the slow part. Compiled per call, this would be the slowest
 * package in the family while claiming to be the fastest — so the checker is
 * cached per schema in a `WeakMap`, keyed by the schema object itself.
 *
 * Declare schemas at module level. One built inside a component body is a new
 * object on every render, and therefore a new cache key.
 */

export { lankaTypeBoxValidator } from "./lanka-type-box-validator/lankaTypeBoxValidator";
export type { TLankaInferred } from "./_types/TLankaInferred";
