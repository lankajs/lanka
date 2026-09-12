/**
 * @lankajs/tool-testing — the framework's test kit.
 *
 * The only package allowed to reach into core internals, which is what lets
 * those internals stay sealed: without it a consumer would have to touch the
 * registries directly.
 *
 * `setupTests` is loaded as `setupFiles` and imported for its side effect, so it
 * is not exported here — the path is given directly:
 *
 * ```ts
 * setupFiles: ["@lankajs/tool-testing/setupTests"]
 * ```
 *
 * ## What the kit answers, in the order a test needs it
 *
 * A clean framework (`resetLanka`), a screen with one in it (`renderWithLanka`),
 * doubles for what the subject depends on (`createLankaFakeTransport`,
 * `createLankaFakeScenario`, `registerLankaFakes`), a way to WAIT for the work
 * to finish (`waitForLankaIdle`), and a way to assert on what the framework did
 * rather than on how it printed it (`createLankaEventRecorder`,
 * `createLankaLogRecorder`).
 */

export { lankaTestHost } from "./lankaTestHost";
export { resetLanka } from "./resetLanka";
export { renderWithLanka } from "./renderWithLanka";
export { createLankaFakeTransport, createLankaFakeScenario } from "./lankaTestFakes";
export { createLankaFakeReadCache } from "./_factories/create-lanka-fake-read-cache/createLankaFakeReadCache";
export { createLankaFakeStorageAdapter } from "./_factories/create-lanka-fake-storage-adapter/createLankaFakeStorageAdapter";
export { registerLankaFakes } from "./register-lanka-fakes/registerLankaFakes";
export { waitForLankaIdle } from "./wait-for-lanka-idle/waitForLankaIdle";
export { createLankaEventRecorder } from "./_factories/create-lanka-event-recorder/createLankaEventRecorder";
export { createLankaLogRecorder } from "./_factories/create-lanka-log-recorder/createLankaLogRecorder";

export type { IRenderWithLankaOptions, IRenderWithLankaResult } from "./renderWithLanka";
export type {
	ILankaFakeTransport,
	ILankaFakeTransportConfig,
	ILankaFakeTransportRoute,
	ILankaFakeScenario,
	TLankaFakeTransportMatch,
} from "./lankaTestFakes";
export type { ILankaFakeReadCache } from "./_factories/create-lanka-fake-read-cache/createLankaFakeReadCache";
export type { ILankaFakeStorageAdapter } from "./_factories/create-lanka-fake-storage-adapter/createLankaFakeStorageAdapter";
export type { ILankaFakes } from "./register-lanka-fakes/registerLankaFakes";
export type { IWaitForLankaIdleOptions } from "./wait-for-lanka-idle/waitForLankaIdle";
export type {
	ILankaEventRecorder,
	ILankaEventRecorderConfig,
	ILankaRecordedEvent,
	ILankaWaitForEventOptions,
} from "./_factories/create-lanka-event-recorder/createLankaEventRecorder";
export type {
	ILankaLogRecorder,
	ILankaLogRecorderConfig,
	ILankaRecordedLogLine,
} from "./_factories/create-lanka-log-recorder/createLankaLogRecorder";
