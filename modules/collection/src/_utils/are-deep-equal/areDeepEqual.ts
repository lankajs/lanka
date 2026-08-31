/**
 * Whether two values hold the same data.
 *
 * Needed by stabilisation and nowhere else: a refetch that returned identical
 * rows must be recognised as identical, and identity cannot answer that because
 * the rows came out of a fresh `JSON.parse`.
 */
export const areDeepEqual = (a: unknown, b: unknown): boolean => {
	if (Object.is(a, b)) return true;
	if (a == null || b == null) return false;
	if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();

	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		return a.every((item, index) => areDeepEqual(item, b[index]));
	}

	if (typeof a !== "object" || typeof b !== "object") return false;

	const left = a as Record<string, unknown>;
	const right = b as Record<string, unknown>;
	const keys = Object.keys(left);

	if (keys.length !== Object.keys(right).length) return false;

	// A loop rather than `every`: stabilisation calls this once per row of every
	// refetched list, and both the closure and the call per key are costs that
	// only show up when the list is a thousand rows long.
	for (let index = 0; index < keys.length; index += 1) {
		const key = keys[index];
		if (!Object.hasOwn(right, key)) return false;

		const leftValue = left[key];
		const rightValue = right[key];

		// The common answer, reached without a call: most fields of a refetched row
		// came back as identical primitives.
		if (leftValue === rightValue) continue;
		if (!areDeepEqual(leftValue, rightValue)) return false;
	}

	return true;
};
