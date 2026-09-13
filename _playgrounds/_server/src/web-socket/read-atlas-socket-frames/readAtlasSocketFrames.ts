/** One frame off the wire: what kind it is, and what it carried. */
export interface IAtlasSocketFrame {
	/** `1` text, `8` close, `9` ping, `10` pong. Binary frames are not used here. */
	opcode: number;
	payload: Buffer;
}

/** Whole frames read so far, and the bytes that are not a whole frame yet. */
export interface IAtlasSocketRead {
	frames: readonly IAtlasSocketFrame[];
	rest: Buffer;
}

const SHORT_LENGTH = 126;
const LONG_LENGTH = 127;
const MASK_BIT = 0x80;
const MASK_BYTES = 4;

/** Where the payload starts, and how long it is — or `null` if not all here yet. */
const measure = (buffer: Buffer, at: number): { start: number; length: number } | null => {
	if (buffer.length - at < 2) return null;

	const marker = buffer[at + 1] & 0x7f;
	const masked = (buffer[at + 1] & MASK_BIT) !== 0;
	let cursor = at + 2;
	let length = marker;

	if (marker === SHORT_LENGTH) {
		if (buffer.length - cursor < 2) return null;
		length = buffer.readUInt16BE(cursor);
		cursor += 2;
	} else if (marker === LONG_LENGTH) {
		if (buffer.length - cursor < 8) return null;
		// A frame longer than 4 GB is not something this server will ever be sent,
		// and `readBigUInt64BE` would make every length a bigint for that case.
		length = Number(buffer.readBigUInt64BE(cursor));
		cursor += 8;
	}

	const start = cursor + (masked ? MASK_BYTES : 0);

	return buffer.length - start < length ? null : { start, length };
};

/** Undoes the client's mask, which every browser applies and none may skip. */
const unmask = (buffer: Buffer, keyAt: number, start: number, length: number): Buffer => {
	const payload = Buffer.allocUnsafe(length);
	for (let index = 0; index < length; index += 1) {
		payload[index] = buffer[start + index] ^ buffer[keyAt + (index % MASK_BYTES)];
	}

	return payload;
};

/**
 * Reads whole WebSocket frames out of a buffer, and answers what is left over.
 *
 * The leftover is the whole point, and it is the same lesson the gRPC reader in
 * `@lankajs/plugin-grpc` carries: bytes arrive in chunks the network chose, not
 * in message-shaped pieces. A two-byte header can be split across two reads and
 * a payload across ten, so a reader that assumed each chunk held whole frames
 * would work in every test and lose messages under load — the failure that never
 * reproduces.
 */
export const readAtlasSocketFrames = (buffer: Buffer): IAtlasSocketRead => {
	const frames: IAtlasSocketFrame[] = [];
	let at = 0;

	for (;;) {
		const measured = measure(buffer, at);
		if (!measured) break;

		const masked = (buffer[at + 1] & MASK_BIT) !== 0;
		const payload = masked
			? unmask(buffer, measured.start - MASK_BYTES, measured.start, measured.length)
			: buffer.subarray(measured.start, measured.start + measured.length);

		frames.push({ opcode: buffer[at] & 0x0f, payload });
		at = measured.start + measured.length;
	}

	return { frames, rest: buffer.subarray(at) };
};
