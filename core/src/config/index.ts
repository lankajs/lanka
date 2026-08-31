/**
 * Configuration and the host contract — what the framework cannot know by itself.
 *
 * `ILankaHost` is required, not optional: a missing error translator is then a
 * compile error in the host rather than an untranslated string in the UI.
 */

export { createLankaHost } from "./_factories/create-lanka-host/createLankaHost";
export { getLankaFlags } from "./get-lanka-flags/getLankaFlags";
export { getLankaHost } from "./get-lanka-host/getLankaHost";
export type { ILankaFlags } from "./_interfaces/ILankaFlags";
export type { ILankaHost } from "./_interfaces/ILankaHost";
export type { ILankaHostConfig } from "./_factories/create-lanka-host/createLankaHost";
export type { ILankaRuntimeConfig } from "./_interfaces/ILankaRuntimeConfig";
