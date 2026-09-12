/**
 * `lanka/internal` — primitives, with no promise attached.
 *
 * **This tier may change in any release, including a patch.** It is published
 * rather than sealed for two reasons: a sibling package needs these and must not
 * reach into another package's `src/`, and a consumer who genuinely needs one
 * should not have to fork a framework to get twelve lines.
 *
 * The word `internal` in the import path is the whole mechanism, and it is
 * enough: nobody arrives here by accident, and nobody can claim surprise.
 *
 * Canon: `skills/surface/SKILL.md`.
 */

// ── Values ───────────────────────────────────────────────────────────────────
export { generateUuid } from "./generate-uuid/generateUuid";

// ── Which instance is active, and how that is decided ────────────────────────
export { setLankaRuntimeResolver } from "./active-runtime/activeRuntime";
export type { ILankaRuntime, TLankaRuntimeResolver } from "./active-runtime/activeRuntime";

// ── What every binding of the validation port needs ──────────────────────────
export { lankaForeignSchemaMessage } from "./lanka-foreign-schema-message/lankaForeignSchemaMessage";
export { lankaValueOrThrow } from "./lanka-value-or-throw/lankaValueOrThrow";

// ── Narrowing an unknown value ───────────────────────────────────────────────
export { getStringField } from "./_guards/getStringField";
export { isRecord } from "./_guards/isRecord";
