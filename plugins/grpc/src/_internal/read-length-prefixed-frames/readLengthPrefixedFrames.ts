/** One frame off the wire: what it is, and what it carried. */
export interface IGrpcFrame {
	/** `true` when the flag byte marks this as the trailers block. */
	isTrailers: boolean;
	data: Uint8Array;
}

/** Whole frames read so far, and the bytes that are not a whole frame yet. */
export interface IGrpcFrameRead {
	frames: readonly IGrpcFrame[];
	rest: Uint8Array;
}

/** The flag bit that marks the trailers block rather than a message. */
const TRAILERS_FLAG = 0x80;

/**
 * Reads whole frames out of a buffer, and answers what is left over.
 *
 * The leftover is the whole point. A server stream arrives in chunks decided by
 * the network, not by the message boundaries, so a five-byte header can be split
 * across two reads and a message across ten. A reader that assumed each chunk
 * held whole frames would work in every test and drop messages under load —
 * which is the failure that never reproduces.
 */
export const readLengthPrefixedFrames = (buffer: Uint8Array): IGrpcFrameRead => {
	const frames: IGrpcFrame[] = [];
	let offset = 0;

	while (buffer.length - offset >= 5) {
		const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 5);
		const length = view.getUint32(1, false);
		if (buffer.length - offset - 5 < length) break;

		frames.push({
			isTrailers: (buffer[offset] & TRAILERS_FLAG) !== 0,
			data: buffer.slice(offset + 5, offset + 5 + length),
		});
		offset += 5 + length;
	}

	return { frames, rest: buffer.slice(offset) };
};
