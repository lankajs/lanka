/**
 * @lankajs/plugin-sse — server events as a source of change.
 *
 * A plugin, not a module: it lives and is removed with the framework instance,
 * and its "from outside" marker is read by scenario handlers — that is, it sits
 * on the path core walks.
 *
 * ## What is here, and what is one level down
 *
 * Only `LankaSseTransport` is about `text/event-stream`. The bridge, the marker
 * and the plugin's own lifetime are the same for every pushing connection and
 * live in `lanka/stream`, where `@lankajs/plugin-websocket`,
 * `@lankajs/plugin-graphql` and `@lankajs/plugin-grpc` read them too. They are
 * re-exported HERE under the names this package has always published: an
 * application on SSE needs one import, and one that later swaps the transport
 * changes a line of configuration rather than every bridge file.
 *
 * ## What will NOT appear here
 *
 * Concrete bridges. Which events exist is the application's domain; the package
 * knows only the shape of a bridge.
 */

export { lankaSse } from "./lanka-sse/lankaSse";
export type { ILankaSsePluginConfig, ILankaSsePlugin } from "./lanka-sse/lankaSse";
export type { ILankaServerEventTransport } from "lanka/stream";
export { LankaSseTransport } from "./lanka-sse-transport/LankaSseTransport";
export { createLankaSseTransport } from "./_factories/create-lanka-sse-transport/createLankaSseTransport";
export { createLankaStreamBridge as createLankaSseBridge } from "lanka/stream";
export type { ILankaStreamBridgeContext as ILankaSseBridgeContext } from "lanka/stream";
export { ALankaStreamBridge as ALankaSseBridge } from "lanka/stream";
export { createLankaStreamTriggerContext as createLankaSseTriggerContext } from "lanka/stream";
export type {
	ILankaSseConfig,
	TLankaSseEventCallback,
	TLankaSseReconnectCallback,
} from "./lanka-sse-transport/LankaSseTransport";
export type { ILankaStreamTriggerContext as ILankaSseTriggerContext } from "lanka/stream";

/*
 * The guard and the coalescer are re-exported HERE, not only from
 * `@lankajs/async`.
 *
 * They are useful on their own but are always needed with server events: SSE
 * arrives in bursts by nature, and without the guard a late response overwrites
 * a fresh one, while without the coalescer one user action produces one request
 * per participant.
 */
export { createLankaLatestGuard, createLankaBurstCoalescer } from "@lankajs/async";
export type { ILankaLatestGuard, ILankaBurstCoalescer, TLankaLatestToken } from "@lankajs/async";
