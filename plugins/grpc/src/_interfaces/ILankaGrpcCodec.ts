/**
 * How a message becomes bytes and back.
 *
 * The seam, and the reason this package has no dependency on a protobuf
 * runtime. A codec belongs to whatever generated the message types —
 * `protobuf-es`, `ts-proto`, a hand-written one — and shipping one of them would
 * pick the consumer's code generator for them while adding a dependency to
 * everyone who chose differently.
 *
 * Two functions. `createLankaGrpcJsonCodec` is the one this package ships, for a
 * server speaking `+json` and for a test that wants to read what went over the
 * wire.
 */
export interface ILankaGrpcCodec<TRequest, TResponse> {
	encode: (message: TRequest) => Uint8Array;
	decode: (bytes: Uint8Array) => TResponse;
}
