/**
 * Application start-up: one entry point, one order, one failure point.
 *
 * Phases run sync → async → post-async, with priorities inside each phase.
 */

export { createLanka } from "./_factories/create-lanka/createLanka";
export { startLanka } from "./start-lanka/startLanka";
export { resetActiveLanka } from "./reset-active-lanka/resetActiveLanka";
export type { ILankaScope } from "../locator/_factories/create-lanka-scope/createLankaScope";
export { ALankaPlugin } from "./_abstractions/lanka-plugin/ALankaPlugin";
export type { ILankaPlugin } from "./ILankaPlugin";
export type { ILankaStartOptions, TLankaStartConfig } from "./_types/TLankaStartConfig";
export type {
	ILankaBootstrapConfig,
	ILankaInstance,
	ILankaInstanceConfig,
} from "./_factories/create-lanka/createLanka";
export type {
	ILankaScenarioBootstrapConfig,
	ILankaServiceConfig,
} from "./_factories/create-lanka/createLanka";
