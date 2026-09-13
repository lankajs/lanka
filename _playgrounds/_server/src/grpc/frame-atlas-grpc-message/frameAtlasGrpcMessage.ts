/** The flag byte that marks the trailers block rather than a message. */
const TRAILERS = 0x80;

/**
 * One gRPC-Web frame: a flag byte, a big-endian length, then the bytes.
 *
 * Five bytes rather than none because a stream carries several messages and a
 * reader has to know where each ends without looking inside it. This is the same
 * format `@lankajs/plugin-grpc` reads, written from the other side — and the two
 * meeting over a real socket is the only thing that proves either is right.
 */
export const frameAtlasGrpcMessage = (payload: Buffer, isTrailers = false): Buffer => {
	const head = Buffer.alloc(5);
	head.writeUInt8(isTrailers ? TRAILERS : 0, 0);
	head.writeUInt32BE(payload.length, 1);

	return Buffer.concat([head, payload]);
};
