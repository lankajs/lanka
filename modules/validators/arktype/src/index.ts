/**
 * @lankajs/arktype — conveniences for an application that chose arktype.
 *
 * ## Why a package when core accepts arktype anyway
 *
 * For the same reason `@lankajs/zod` and `@lankajs/valibot` exist: **the choice is
 * made once and explicitly.** An application installs one validation package, and
 * its dependency list shows which library its schemas are. Installing none is a
 * legal choice too — core's `lankaStandardValidator` accepts the schemas
 * directly.
 *
 * ## Why there is so little code here
 *
 * arktype implements Standard Schema from its second major, synchronously, so
 * `lankaArkTypeValidator` _is_ core's validator under a name that says which
 * library the application chose. There is nothing to adapt, and inventing work in
 * the name of matching a thicker package in the family would be worse than
 * leaving the difference visible.
 *
 * Thickness in this family is a fact about the LIBRARY, not about the package:
 * `@lankajs/yup` carries a bridge because yup's Standard Schema implementation is
 * asynchronous, and `@lankajs/typebox` carries one because TypeBox has none.
 */

export { lankaArkTypeValidator } from "./lanka-ark-type-validator/lankaArkTypeValidator";
export type { TLankaInferred } from "./_types/TLankaInferred";
