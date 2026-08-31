/**
 * @lankajs/zod — conveniences for an application that chose zod.
 *
 * ## What this package does NOT do
 *
 * It does not adapt zod to the framework: there is nothing to adapt. zod 4
 * implements Standard Schema and core's `lankaStandardValidator` accepts its
 * schemas directly.
 *
 * ## Why the package exists
 *
 * To make the choice explicit. An application installs ONE validation package —
 * this or `@lankajs/valibot` — or none and works with schemas directly. What lives
 * here is zod-specific and therefore cannot live in core: typed helpers and
 * parsing for schemas that do not expose Standard Schema (zod 3).
 *
 * The valibot package is shaped identically on purpose: two libraries, two
 * identically shaped modules, so the difference between them is the difference
 * between the libraries.
 */

export { lankaZodValidator } from "./lanka-zod-validator/lankaZodValidator";
export type { TLankaInferred } from "./_types/TLankaInferred";
