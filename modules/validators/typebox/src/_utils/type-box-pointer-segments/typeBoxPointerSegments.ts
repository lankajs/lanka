/**
 * A TypeBox error pointer as segments: `/tags/0/id` → `["tags", 0, "id"]`.
 *
 * TypeBox addresses a field with a JSON Pointer (RFC 6901). `ILankaFieldError.path`
 * is segments, on purpose: the two form libraries the shape was designed against
 * spell the same address differently, and neither can be parsed back out of a
 * joined string safely.
 *
 * The pointer's two escapes are not decoration. `~1` is a literal `/` in a key
 * and `~0` a literal `~`; unescaped, a key containing a slash would split into
 * two segments addressing nothing. **In this order** — `~1` first, then `~0` —
 * because the reverse turns `~01` into `/` instead of the literal `~1` it is.
 *
 * A segment of digits becomes a NUMBER. A form distinguishes the second element
 * of a list from a key spelled `"1"`, and JSON Pointer does not carry the
 * difference itself — it is recovered from the shape of the segment, which is
 * what every JSON Pointer implementation does.
 *
 * The root pointer is the empty string, and an empty array is what the port's
 * consumers already read as "the value as a whole".
 */
export const typeBoxPointerSegments = (pointer: string | undefined): (string | number)[] => {
	if (!pointer) return [];

	return pointer
		.split("/")
		.slice(1)
		.map((segment) => {
			const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");

			return /^\d+$/.test(key) ? Number(key) : key;
		});
};
