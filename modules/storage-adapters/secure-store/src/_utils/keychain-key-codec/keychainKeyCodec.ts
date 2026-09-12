/**
 * A key the keychain accepts, and the way back.
 *
 * `expo-secure-store` allows letters, digits, `.`, `-` and `_` in a key and
 * refuses the rest. Clause 11 of the port says a key is used AS GIVEN — so the
 * adapter encodes on the way in and decodes on the way out, and a caller never
 * sees a key it did not write.
 *
 * ## The escape is `_`, which is itself legal
 *
 * That is the awkward part and the reason the scheme is written down rather than
 * improvised. `encodeURIComponent` was the obvious choice and is wrong: it
 * produces `%`, which the keychain refuses too.
 *
 * So `_` escapes, and to stay reversible it must escape ITSELF: a key holding a
 * literal underscore would otherwise decode as whatever followed it. Every
 * escape is exactly five characters — `_` and four hex digits of one UTF-16 code
 * unit — so decoding never has to guess where one ends. A surrogate pair becomes
 * two escapes and comes back as the pair it was.
 *
 * The cost is paid by keys nobody writes: `session.token` passes through
 * untouched, `session_token` grows four characters.
 */
const ALLOWED = /[A-Za-z0-9.-]/;
const ESCAPE = "_";
const ESCAPE_LENGTH = 5;

export const toKeychainKey = (key: string): string => {
	let encoded = "";

	// By UTF-16 unit rather than by code point: a surrogate pair becomes two
	// escapes, and `String.fromCharCode` puts it back together on the way out.
	for (const unit of key.split("")) {
		encoded += ALLOWED.test(unit)
			? unit
			: ESCAPE + unit.charCodeAt(0).toString(16).padStart(4, "0");
	}

	return encoded;
};

export const fromKeychainKey = (encoded: string): string => {
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
