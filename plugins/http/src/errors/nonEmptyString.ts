/** A trimmed string, or `undefined` when there is nothing to show. */
export const nonEmptyString = (value: unknown): string | undefined => {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};
