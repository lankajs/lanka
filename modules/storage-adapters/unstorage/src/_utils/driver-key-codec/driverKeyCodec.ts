/**
 * A key unstorage will hand back unchanged, and the way back.
 *
 * unstorage's keys are PATHS: a mount point is a prefix, so the library
 * normalises separators. Measured against 1.17.5 over every ASCII punctuation
 * mark rather than assumed, which is how the list came out this short:
 *
 * | written | answered by `getKeys()` |
 * | --- | --- |
 * | `a/b` and `a\b` | `a:b` — both are the separator it uses |
 * | `a?b` | `a` — everything from the question mark is dropped |
 * | `a::b` | `a:b`, and it IS `a:b`: the two keys are one row |
 * | every other punctuation mark, including `%`, `#`, `_`, `.` and a space | unchanged |
 *
 * The first breaks clause 11 — a key comes back as it was given. The second
 * loses the rest of the key outright. The third is worse than either: two keys
 * an application means to be different are one row, so one silently overwrites
 * the other.
 *
 * So the separators and the query mark are escaped, and everything else passes
 * through untouched — which keeps the common key (`session.token`) readable in
 * whatever the driver writes to.
 *
 * ## Why not the codec `@lankajs/secure-store` has
 *
 * Same shape, different alphabet: a keychain refuses everything but letters,
 * digits and three marks, while unstorage only mangles separators. Sharing one
 * would mean a member depending on a sibling — which a family forbids, because
 * then swapping one for another would install the other — or core growing a
 * utility that belongs to neither. Twenty-five lines twice, with the measurement
 * beside each, is the cheaper of the two.
 */
const ESCAPED = new Set(["/", "\\", "?", ":", "~"]);
const ESCAPE = "~";
const ESCAPE_LENGTH = 5;

export const toDriverKey = (key: string): string => {
	let encoded = "";

	for (const unit of key.split("")) {
		encoded += ESCAPED.has(unit)
			? ESCAPE + unit.charCodeAt(0).toString(16).padStart(4, "0")
			: unit;
	}

	return encoded;
};

export const fromDriverKey = (encoded: string): string => {
	let key = "";
	let index = 0;

	while (index < encoded.length) {
		if (encoded[index] !== ESCAPE) {
			key += encoded[index];
			index += 1;
			continue;
		}

		const unit = Number.parseInt(encoded.slice(index + 1, index + ESCAPE_LENGTH), 16);
		key += String.fromCharCode(unit);
		index += ESCAPE_LENGTH;
	}

	return key;
};
