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
 */

export { lankaTestHost } from "./lankaTestHost";
export { resetLanka } from "./resetLanka";
export { renderWithLanka } from "./renderWithLanka";
export { createLankaFakeTransport, createLankaFakeScenario } from "./lankaTestFakes";

export type { IRenderWithLankaOptions, IRenderWithLankaResult } from "./renderWithLanka";
export type {
	ILankaFakeTransport,
	ILankaFakeTransportConfig,
	ILankaFakeScenario,
} from "./lankaTestFakes";
