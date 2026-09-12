/**
 * A yup path as segments: `tags[0].id` → `["tags", 0, "id"]`.
 *
 * yup addresses a field the way JavaScript does — dots for keys, brackets for
 * indexes and for keys that cannot be written as a dot. `ILankaFieldError.path`
 * is segments, on purpose: the two form libraries the shape was designed against
 * spell the same address differently, and neither can be parsed back out of a
 * joined string safely — a message may contain a colon, a key may contain a dot.
 *
 * Which is exactly why this is a parser rather than `path.split(".")`. A key with
 * a dot in it arrives from yup as `["a.b"]`, and splitting would turn one field
 * into two that address nothing.
 *
 * An index stays a NUMBER. A form distinguishes the second element of a list
 * from a key spelled `"1"`, and a string here would flatten the two.
 *
 * An empty or absent path is the form's ROOT — `yup.number().min(18)` refusing a
 * bare `3` reports no path at all — and an empty array is what the port's
 * consumers already read as "the value as a whole".
 */
const SEGMENT = /\[(\d+)\]|\["((?:[^"\\]|\\.)*)"\]|\['((?:[^'\\]|\\.)*)'\]|([^.[\]]+)/g;

export const yupPathSegments = (path: string | undefined): (string | number)[] => {
	if (!path) return [];

	const segments: (string | number)[] = [];

	for (const [, index, doubleQuoted, singleQuoted, plain] of path.matchAll(SEGMENT)) {
		if (index !== undefined) {
			segments.push(Number(index));
			continue;
		}

		// The alternation has four arms and a match fills exactly one, so with the
		// index arm taken above one of these three IS the key. The assertion says so
		// instead of a `?? ""` fallback, which would be an arm nothing can reach and
		// a line the coverage ratchet could never account for.
		segments.push(doubleQuoted ?? singleQuoted ?? plain);
	}

	return segments;
};
