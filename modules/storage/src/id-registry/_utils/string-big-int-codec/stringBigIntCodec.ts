/**
 * Reversible encoding of a string into a `bigint` and back.
 *
 * ## Not a hash
 *
 * A hash is one-way and can collide. Neither applies here: the string's bytes are
 * packed into a number and the length is written as the high field, which is how
 * the decoder knows how many bytes to read. Hence both reversibility and the
 * absence of collisions.
 *
 * ## Boundaries
 *
 * Suitable for short strings — keys, names, identifiers. The number grows
 * linearly with input length: eight bits per byte plus the length field.
 */

/** Packs a string into a number. The same input always yields the same output. */
export function stringToBigInt(text: string): bigint {
	const bytes = new TextEncoder().encode(text);
	let payload = 0n;
	for (const byte of bytes) {
		payload = (payload << 8n) | BigInt(byte);
	}
	const length = BigInt(bytes.length);
	return (length << (length * 8n)) | payload;
}

/**
 * Reads the string back. Returns an empty string for zero and for a value
 * `stringToBigInt` did not produce — inventing content from an unrecognised
 * number is worse than admitting there is nothing to read.
 */
export function bigIntToString(value: bigint): string {
	if (value === 0n) return "";

	let length = -1n;
	for (let candidate = 0; candidate < MAX_ENCODED_BYTES; candidate += 1) {
		if (value >> (BigInt(candidate) * 8n) === BigInt(candidate)) {
			length = BigInt(candidate);
			break;
		}
	}
	if (length < 0n) return "";

	const payload = value & ((1n << (length * 8n)) - 1n);
	const bytes: number[] = [];
	for (let index = Number(length) - 1; index >= 0; index -= 1) {
		bytes.push(Number((payload >> (BigInt(index) * 8n)) & 0xffn));
	}
	return new TextDecoder().decode(new Uint8Array(bytes));
}

/** A bound on the length search: without it a corrupt value would loop forever. */
const MAX_ENCODED_BYTES = 4096;
