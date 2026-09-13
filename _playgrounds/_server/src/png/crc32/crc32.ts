/**
 * The lookup the polynomial produces, built once.
 *
 * Built rather than written out: 256 constants in a source file are 256 chances
 * to mistype one, and a wrong entry shows up as a checksum that fails for some
 * inputs and not others.
 */
const TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
	let value = index;
	for (let bit = 0; bit < 8; bit += 1)
		value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;

	return value >>> 0;
});

/**
 * CRC-32, as PNG specifies it for every chunk.
 *
 * A pure function over bytes, so it carries no brand: nothing about it belongs
 * to this application, and a name claiming otherwise would say the opposite of
 * the truth.
 */
export const crc32 = (bytes: Uint8Array): number => {
	let crc = 0xffffffff;
	for (const byte of bytes) crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);

	return (crc ^ 0xffffffff) >>> 0;
};
