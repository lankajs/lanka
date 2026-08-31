/**
 * Type-guard: narrows `unknown` to `Record<string, unknown>`.
 * Excludes `null`, primitives, and arrays-as-keys (arrays still satisfy
 * `typeof === "object"`, but they're rarely the target — callers that need
 * to exclude arrays should add `!Array.isArray(value)`).
 *
 * ABSORBED into this package when the layer was extracted: it lived in an
 * application, and a package cannot import its consumer. An application
 * re-exports this one rather than keeping a copy — two implementations of a
 * three-line guard is how they end up disagreeing about `null`.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;
