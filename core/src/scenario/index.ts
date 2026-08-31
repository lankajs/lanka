/**
 * Cross-screen orchestration: what happens when the session changes, a list must
 * refresh, realtime reconnects.
 *
 * `lankaEventBus.addMiddleware` is the declared extension point;
 * `@lankajs/plugin-devtools` attaches there.
 *
 * The registries are public as part of the subsystem, not as a concession to
 * tests: test state is reset by `resetLanka()` from `@lankajs/tool-testing`, which
 * never requires touching a registry by hand.
 */

export { ALankaScenario } from "./_abstractions/lanka-scenario/ALankaScenario";
export { createLankaScenario } from "./_factories/create-lanka-scenario/createLankaScenario";
export type { ILankaScenarioConfig } from "./_factories/create-lanka-scenario/createLankaScenario";
export { lankaEventBus } from "./event-bus/_facades/lanka-event-bus/lankaEventBus";
export { lankaScenarioBootstrap } from "./lanka-scenario-bootstrap/LankaScenarioBootstrap";
// The two registries are mechanism, not vocabulary: an application declares a
// scenario and subscribes to it, and never enumerates them. They are published
// as `lanka/extend` — reachable for an inspector, promised to nobody.

export type { ILankaEventLog } from "./_interfaces/ILankaEventLog";
export type { ILankaEventMetadata } from "./_interfaces/ILankaEventMetadata";
export type { ILankaScenario } from "./_interfaces/ILankaScenario";
export type { ILankaScenarioMetadata } from "./_interfaces/ILankaScenarioMetadata";
export type { ILankaScenarioVM } from "./_interfaces/ILankaScenarioVM";
export type {
	TLankaEventBusDecision,
	TLankaEventBusMiddleware,
} from "./_types/TLankaEventBusMiddleware";
export type { TLankaReplayRequest } from "./event-bus/lanka-event-bus-instance/LankaEventBusInstance";
