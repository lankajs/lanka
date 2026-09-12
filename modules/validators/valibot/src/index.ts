/**
 * @lankajs/valibot — conveniences for an application that chose valibot.
 *
 * ## Why a package when core accepts valibot anyway
 *
 * For the same reason `@lankajs/zod` exists: **the choice is made once and
 * explicitly.** An application installs one validation package, and its
 * dependency list shows which library it uses. Installing neither is a legal
 * choice too: core's `lankaStandardValidator` accepts schemas directly.
 *
 * The package is shaped exactly like `@lankajs/zod` on purpose: two libraries, two
 * identically built modules, so the difference between them is the difference
 * between the libraries rather than between wrapper depths.
 *
 * ## Why there is less code here than in the zod package
 *
 * valibot has no version that lacks Standard Schema: it implements the
 * specification from its first major. The bridge `@lankajs/zod` needs for zod 3 is
 * simply not needed, and inventing work for it in the name of symmetry would be
 * worse than leaving the difference visible.
 */

export { lankaValibotValidator } from "./lanka-valibot-validator/lankaValibotValidator";
export type { TLankaInferred } from "./_types/TLankaInferred";
