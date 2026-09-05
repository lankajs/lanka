/**
 * A change that arrives from the server, and the seam it comes through.
 *
 * Everything here is protocol-free, and that is the subsystem's whole reason.
 * Server-sent events, a WebSocket, a `graphql-ws` subscription and a gRPC
 * server stream differ in how bytes arrive and in nothing above this line: a
 * bridge, the "came from outside" marker, the reconnect ladder and the plugin
 * that owns the connection's lifetime are the same four things every time.
 *
 * Held in core rather than copied into four plugin packages because the marker
 * is the piece whose failure is SILENT — a handler that forgot it is
 * indistinguishable from a user action, and the screen merely behaves oddly in
 * a rare case. Four copies of that is four chances to get it wrong once.
 *
 * ## What will NOT appear here
 *
 * A transport. Which protocol an application is on is decided by a proxy, a
 * backend team and a platform, and core has no business choosing for them:
 * `@lankajs/plugin-sse`, `@lankajs/plugin-websocket`, `@lankajs/plugin-graphql`
 * and `@lankajs/plugin-grpc` each bring one, and an application that needs a
 * fifth writes it against `ALankaStreamTransport` without asking anybody.
 *
 * Concrete bridges either: which events exist is the application's domain.
 */

export { lankaStream } from "./lanka-stream/lankaStream";
export type {
	ILankaStreamPlugin,
	ILankaStreamPluginConfig,
	ILankaStreamPluginContext,
} from "./lanka-stream/lankaStream";
export { ALankaStreamTransport } from "./_abstractions/lanka-stream-transport/ALankaStreamTransport";
export type {
	ILankaStreamConfig,
	ILankaStreamTransportHandlers,
} from "./_abstractions/lanka-stream-transport/ALankaStreamTransport";
export { ALankaStreamBridge } from "./_abstractions/lanka-stream-bridge/ALankaStreamBridge";
export { createLankaStreamBridge } from "./_factories/create-lanka-stream-bridge/createLankaStreamBridge";
export { createLankaStreamTriggerContext } from "./_factories/create-lanka-stream-trigger-context/createLankaStreamTriggerContext";
export type { ILankaStreamTriggerContext } from "./_factories/create-lanka-stream-trigger-context/createLankaStreamTriggerContext";
export type { ILankaServerEventTransport } from "./_interfaces/ILankaServerEventTransport";
export type { ILankaStreamBridgeContext } from "./_interfaces/ILankaStreamBridgeContext";
export type { TLankaStreamEventCallback } from "./_types/TLankaStreamEventCallback";
export type { TLankaStreamReconnectCallback } from "./_types/TLankaStreamReconnectCallback";
