/**
 * One gRPC-Web frame: a flag byte, a big-endian length, then the message.
 *
 * The wire format, and the reason it is five bytes rather than none: a stream
 * carries several messages and a reader has to know where each one ends without
 * looking inside it. The flag byte is `0` for data and `0x80` for the trailers
 * block, which is how a response says "that was the last of it, and here is the
 * status".
 *
 * `DataView` rather than four shifts: the length is big-endian and writing it by
 * hand is the kind of code that is wrong on one platform and nowhere else.
 */
export const encodeLengthPrefixed = (message: Uint8Array): Uint8Array => {
	const framed = new Uint8Array(5 + message.length);
	new DataView(framed.buffer).setUint32(1, message.length, false);
	framed.set(message, 5);

	return framed;
};
