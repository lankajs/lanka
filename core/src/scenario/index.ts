/**
 * Cross-screen orchestration: what happens when the session changes, a list must
 * refresh, realtime reconnects.
 *
 * `lankaEventBus.addMiddleware` and `lankaEventBus.addObserver` are the two
 * declared extension points here, and they differ in what they may do: a
 * middleware sits in the chain and may STOP an event, an observer is told what
 * became of it and may do nothing at all. `@lankajs/plugin-devtools` attaches to
 * both — to the first for when an event happened, to the second for whether it
 * arrived and which middleware stopped it if it did not.
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
export type { TLankaEventBusObserver } from "./_types/TLankaEventBusObserver";
export type { ILankaEventBusOutcome } from "./_interfaces/ILankaEventBusOutcome";
export type { TLankaReplayRequest } from "./event-bus/lanka-event-bus-instance/LankaEventBusInstance";
