const SHORT_LENGTH = 126;
const LONG_LENGTH = 127;
const SHORT_CEILING = 65_535;

/**
 * Writes one unmasked frame, which is what a server sends and a client may not.
 *
 * Unmasked is not a shortcut: the specification says a server MUST NOT mask, and
 * a browser closes the connection on a masked frame from one. The three length
 * forms are not optional either — a payload of 200 bytes written in the 7-bit
 * form is a frame every client rejects, and the symptom is a socket that closes
 * as soon as a message grows past 125 characters.
 */
export const writeAtlasSocketFrame = (opcode: number, payload: Buffer): Buffer => {
	const first = Buffer.of(0x80 | opcode);

	if (payload.length < SHORT_LENGTH) {
		return Buffer.concat([first, Buffer.of(payload.length), payload]);
	}

	if (payload.length <= SHORT_CEILING) {
		const head = Buffer.alloc(3);
		head.writeUInt8(SHORT_LENGTH, 0);
		head.writeUInt16BE(payload.length, 1);

		return Buffer.concat([first, head, payload]);
	}

	const head = Buffer.alloc(9);
	head.writeUInt8(LONG_LENGTH, 0);
	head.writeBigUInt64BE(BigInt(payload.length), 1);

	return Buffer.concat([first, head, payload]);
};
