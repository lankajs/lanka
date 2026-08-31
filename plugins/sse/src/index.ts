/**
 * @lankajs/plugin-sse — server events as a source of change.
 *
 * A plugin, not a module: it lives and is removed with the framework instance,
 * and its "from outside" marker is read by scenario handlers — that is, it sits
 * on the path core walks.
 *
 * ## What will NOT appear here
 *
 * Concrete bridges. Which events exist is the application's domain; the package
 * knows only the shape of a bridge.
 */

export { lankaSse } from "./lanka-sse/lankaSse";
export type { ILankaSsePluginConfig, ILankaSsePlugin } from "./lanka-sse/lankaSse";
export type { ILankaServerEventTransport } from "./_interfaces/ILankaServerEventTransport";
export { LankaSseTransport } from "./lanka-sse-transport/LankaSseTransport";
export { createLankaSseTransport } from "./_factories/create-lanka-sse-transport/createLankaSseTransport";
export { createLankaSseBridge } from "./_factories/create-lanka-sse-bridge/createLankaSseBridge";
export type { ILankaSseBridgeContext } from "./_interfaces/ILankaSseBridgeContext";
export { ALankaSseBridge } from "./_abstractions/lanka-sse-bridge/ALankaSseBridge";
export { createLankaSseTriggerContext } from "./_factories/create-lanka-sse-trigger-context/createLankaSseTriggerContext";
export type {
	ILankaSseConfig,
	TLankaSseEventCallback,
	TLankaSseReconnectCallback,
} from "./lanka-sse-transport/LankaSseTransport";
export type { ILankaSseTriggerContext } from "./_factories/create-lanka-sse-trigger-context/createLankaSseTriggerContext";

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
