/**
 * @lankajs/plugin-grpc — gRPC-Web: unary calls and server streams.
 *
 * A plugin, not a module — but only half of it is. A unary call is an ordinary
 * request and needs no `use()`; a server STREAM is a connection, and a
 * connection needs a lifetime to belong to.
 *
 * ## The package does not know protobuf, and must not
 *
 * A message codec belongs to whatever generated the message types —
 * `protobuf-es`, `ts-proto`, a hand-written one. Shipping a runtime for one of
 * them would pick the consumer's code generator for them and add a dependency to
 * everyone who chose differently. `ILankaGrpcCodec` is two functions, and
 * `createLankaGrpcJsonCodec` is the one this package ships.
 *
 * ## What IS here is the part everyone rewrites
 *
 * The length-prefixed framing, the trailers block, and the mapping from
 * `grpc-status` to a failure the application can branch on. Without the last
 * one, a cancelled call and a failed one look the same and the user is shown an
 * error for leaving the screen.
 */

export { lankaGrpc } from "./lanka-grpc/lankaGrpc";
export type { ILankaGrpcPlugin, ILankaGrpcPluginConfig } from "./lanka-grpc/lankaGrpc";

export { LankaGrpcRequest } from "./lanka-grpc-request/LankaGrpcRequest";
export { createLankaGrpcRequest } from "./_factories/create-lanka-grpc-request/createLankaGrpcRequest";
export type { ILankaGrpcRequestConfig } from "./lanka-grpc-request/LankaGrpcRequest";

export { ALankaGrpcGateway } from "./_abstractions/lanka-grpc-gateway/ALankaGrpcGateway";
export { createLankaGrpcGateway } from "./_factories/create-lanka-grpc-gateway/createLankaGrpcGateway";
export type { IALankaGrpcGatewayConfig } from "./_abstractions/lanka-grpc-gateway/ALankaGrpcGateway";
export type { ILankaGrpcGatewayConfig } from "./_factories/create-lanka-grpc-gateway/createLankaGrpcGateway";
export type { ILankaGrpcGatewayContext } from "./_interfaces/ILankaGrpcGatewayContext";

export { LankaGrpcStreamTransport } from "./lanka-grpc-stream-transport/LankaGrpcStreamTransport";
export { createLankaGrpcStreamTransport } from "./_factories/create-lanka-grpc-stream-transport/createLankaGrpcStreamTransport";
export type {
	ILankaGrpcStreamConfig,
	TLankaGrpcStreamOpener,
} from "./lanka-grpc-stream-transport/LankaGrpcStreamTransport";

export { createLankaGrpcJsonCodec } from "./_factories/create-lanka-grpc-json-codec/createLankaGrpcJsonCodec";
export type { ILankaGrpcCodec } from "./_interfaces/ILankaGrpcCodec";
export type { ILankaGrpcMethod } from "./_interfaces/ILankaGrpcMethod";

/*
 * The protocol-free half, re-exported so a gRPC application has one import.
 *
 * The implementations live in `lanka/stream` and must not be forked here: the
 * "from outside" marker is the one piece whose failure is silent, and two copies
 * of it would be two chances to get it wrong once.
 */
export { ALankaStreamBridge, createLankaStreamBridge } from "lanka/stream";
export type {
	ILankaServerEventTransport,
	ILankaStreamBridgeContext,
	ILankaStreamTriggerContext,
} from "lanka/stream";
