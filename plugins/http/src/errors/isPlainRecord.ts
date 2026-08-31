/**
 * A record that is NOT an array.
 *
 * Core's `isRecord` admits arrays — `typeof [] === "object"` — and that is
 * correct for its callers. Here it is not: `{ errors: ["…"] }` and
 * `{ errors: { email: ["…"] } }` are two different backend shapes, and an
 * extractor that accepts an array where it expects a field map answers for a
 * shape it does not know.
 */
export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
