import type { ILankaGrpcCodec } from "../../_interfaces/ILankaGrpcCodec";

/**
 * The one codec this package ships: JSON over the gRPC framing.
 *
 * Two consumers, both real. A server speaking `application/grpc-web+json` —
 * which Connect does, and which several gateways offer for exactly the case
 * where the client has no protobuf runtime. And a TEST: a spec asserting on what
 * went over the wire can read it, which is not true of a binary codec and is the
 * difference between a readable failure and a hex dump.
 *
 * It is deliberately NOT the default. A gRPC server speaks protobuf unless
 * somebody configured it otherwise, and a default that silently sent JSON to one
 * would fail as a decoding error inside the server.
 */
export const createLankaGrpcJsonCodec = <TRequest, TResponse>(): ILankaGrpcCodec<
	TRequest,
	TResponse
> => ({
	encode: (message) => new TextEncoder().encode(JSON.stringify(message)),
	decode: (bytes) => JSON.parse(new TextDecoder().decode(bytes)) as TResponse,
});
