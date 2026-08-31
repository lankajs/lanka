/**
 * Reads `key` from a record and returns it only if the value is a string.
 * Returns `undefined` for missing or non-string values.
 *
 * Use when narrowing `Record<string, unknown>` payloads (SSE events,
 * error response bodies, etc.) without `as` casts. Does NOT filter
 * empty strings — callers that need non-empty values should check
 * `.trim().length > 0` explicitly.
 *
 * Absorbed with {@link isRecord}, for the same reason.
 */
export const getStringField = (data: Record<string, unknown>, key: string): string | undefined => {
	const value = data[key];
	return typeof value === "string" ? value : undefined;
};
