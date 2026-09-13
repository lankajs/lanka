import { deflateSync } from "node:zlib";
import { crc32 } from "../crc32/crc32";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SIDE = 16;

/** One PNG chunk: length, type, data, and the checksum over the last two. */
const chunk = (type: string, data: Buffer): Buffer => {
	const head = Buffer.alloc(4);
	head.writeUInt32BE(data.length, 0);

	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const tail = Buffer.alloc(4);
	tail.writeUInt32BE(crc32(body), 0);

	return Buffer.concat([head, body, tail]);
};

/** `IHDR`: a truecolour, non-interlaced, 8-bit image of one size. */
const header = (): Buffer => {
	const data = Buffer.alloc(13);
	data.writeUInt32BE(SIDE, 0);
	data.writeUInt32BE(SIDE, 4);
	data.writeUInt8(8, 8);
	data.writeUInt8(2, 9);

	return chunk("IHDR", data);
};

/**
 * A colour that is this crew member's and nobody else's.
 *
 * Derived from the id rather than picked from a list, so adding a fourth member
 * needs no edit here — and so two avatars are never accidentally the same
 * bytes, which would make a cache test pass without the cache working.
 */
const colourOf = (seed: string): [number, number, number] => {
	const hash = crc32(new TextEncoder().encode(seed));

	return [(hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff];
};

/**
 * A small square PNG, the same bytes for the same id, forever.
 *
 * Written by hand rather than read from a file because these bytes have to be
 * IMMUTABLE to be worth caching at all: `@lankajs/blob-cache` never checks
 * freshness, so the thing it is pointed at must be something that cannot change.
 * A generated image whose only input is the id is exactly that, and it needs no
 * binary checked into the repository.
 */
export const createAtlasAvatar = (crewId: string): Buffer => {
	const [red, green, blue] = colourOf(crewId);
	const row = Buffer.concat([
		// The per-scanline filter byte. `0` means "no filter": the row is stored
		// as it is, which is what makes this readable without a decoder.
		Buffer.of(0),
		Buffer.from(Array.from({ length: SIDE }, () => [red, green, blue]).flat()),
	]);

	const pixels = Buffer.concat(Array.from({ length: SIDE }, () => row));

	return Buffer.concat([
		SIGNATURE,
		header(),
		chunk("IDAT", deflateSync(pixels)),
		chunk("IEND", Buffer.alloc(0)),
	]);
};
