/**
 * @lankajs/plugin-devtools — an inspector for the bus, the logs and the wire.
 *
 * ## The data is already collected and shown to nobody
 *
 * The bus has a list of registered events, subscriber counts and — since the
 * outcome observer — a real "stopped by" marker; the logger has sinks; the
 * instance has an in-flight counter and a middleware point that sees every
 * request. Their only consumer was the console.
 *
 * ## A disabled inspector accumulates NOTHING
 *
 * Always-on history is a leak with a user interface: it looks like diagnostics
 * and behaves as slow memory growth, visible only in a long session.
 */

export { lankaDevtools } from "./lanka-devtools/lankaDevtools";
export type { ILankaDevtoolsConfig, ILankaDevtoolsPlugin } from "./lanka-devtools/lankaDevtools";
export { LankaDevtoolsCollector } from "./collector/LankaDevtoolsCollector";
export { createLankaDevtoolsCollector } from "./_factories/create-lanka-devtools-collector/createLankaDevtoolsCollector";
export { LankaRingBuffer } from "./ring-buffer/LankaRingBuffer";
export type {
	ILankaDevtoolsCollectorConfig,
	ILankaDevtoolsEvent,
	ILankaDevtoolsLogLine,
	ILankaDevtoolsRequest,
	ILankaDevtoolsScenario,
	ILankaDevtoolsSnapshot,
	TLankaDevtoolsEventOutcome,
} from "./collector/LankaDevtoolsCollector";
export { renderLankaDevtoolsPanel } from "./panel/renderLankaDevtoolsPanel";
export type { ILankaDevtoolsPanelOptions } from "./panel/renderLankaDevtoolsPanel";
// The panel's own vocabulary. Declared beside the rows it names — a tier is an
// exports entry, not a folder, and these are part of what the panel promises.
export type {
	ILankaDevtoolsPanelRow,
	TLankaDevtoolsPanelTab,
} from "./panel/_internal/lanka-devtools-panel-rows/lankaDevtoolsPanelRows";
