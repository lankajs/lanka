/**
 * @lankajs/plugin-websocket — a two-way channel as a source of change.
 *
 * A plugin, not a module: it lives and is removed with the framework instance,
 * and the "from outside" marker it carries is read by scenario handlers — that
 * is, it sits on the path core walks.
 *
 * ## The same port as server-sent events
 *
 * `LankaWebSocketTransport` is an `ILankaServerEventTransport`, which is the
 * type `@lankajs/plugin-sse` accepts as its `transport`. An application that
 * started on SSE and met a proxy stripping `text/event-stream` changes one line
 * of configuration; bridges, scenarios and screens are untouched.
 *
 * The bridge, the marker and the plugin's lifetime come from `lanka/stream` and
 * are re-exported here, so an application on a socket needs one import.
 *
 * ## What will NOT appear here
 *
 * A message protocol. `{ type, payload }` is a DEFAULT with a seam beside it,
 * not a format this package asks a backend to adopt; and which events exist is
 * the application's domain.
 */

export { lankaWebSocket } from "./lanka-web-socket/lankaWebSocket";
export type {
	ILankaWebSocketPlugin,
	ILankaWebSocketPluginConfig,
} from "./lanka-web-socket/lankaWebSocket";
export { LankaWebSocketTransport } from "./lanka-web-socket-transport/LankaWebSocketTransport";
export { createLankaWebSocketTransport } from "./_factories/create-lanka-web-socket-transport/createLankaWebSocketTransport";
export type {
	ILankaWebSocketConfig,
	ILankaWebSocketMessage,
	TLankaWebSocketFrameReader,
	TLankaWebSocketFrameWriter,
} from "./lanka-web-socket-transport/LankaWebSocketTransport";
export type { ILankaWebSocketChannel } from "./_interfaces/ILankaWebSocketChannel";

/*
 * The protocol-free half, re-exported so a socket application has one import.
 *
 * The implementations live in `lanka/stream` and must not be forked here: the
 * "from outside" marker is the one piece whose failure is silent, and two copies
 * of it would be two chances to get it wrong once.
 */
export { ALankaStreamBridge, createLankaStreamBridge, ALankaStreamTransport } from "lanka/stream";
export type {
	ILankaServerEventTransport,
	ILankaStreamBridgeContext,
	ILankaStreamConfig,
	ILankaStreamTransportHandlers,
	ILankaStreamTriggerContext,
	TLankaStreamEventCallback,
} from "lanka/stream";
