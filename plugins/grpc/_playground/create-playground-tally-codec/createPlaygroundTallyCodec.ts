import type { ILankaGrpcCodec } from "../../src/index";

/** What the tally service counts. */
export interface IPlaygroundTally {
	value: number;
}

/**
 * A codec that is not JSON, written by hand.
 *
 * The point of the scene: `createLankaGrpcJsonCodec` is what the package ships,
 * and a reader could take it for a requirement. It is not — the seam is two
 * functions over bytes, and a generated protobuf codec plugs in exactly here and
 * exactly like this.
 *
 * Four bytes, big-endian, which is enough to be genuinely binary: a JSON reader
 * pointed at these bytes produces nothing, so a test that passes proves the
 * package never looked inside the message.
 */
export const createPlaygroundTallyCodec = (): ILankaGrpcCodec<
	IPlaygroundTally,
	IPlaygroundTally
> => ({
	encode: (message) => {
		const bytes = new Uint8Array(4);
		new DataView(bytes.buffer).setUint32(0, message.value, false);
		return bytes;
	},
	decode: (bytes) => ({
		value: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false),
	}),
});
