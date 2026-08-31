/**
 * @lankajs/browser — platform capabilities that have no single API.
 *
 * What the residents share: browsers diverge and a fallback is required. The
 * Cookie Store API is asynchronous and not universally available, so the wrapper
 * exists because of the platform, not as a precaution.
 *
 * No dependencies at all — not on core, not on anything. Which is why the
 * release guard reports through a callback rather than the framework logger: a
 * package that took core for a log line would stop being usable without it.
 */

export { lankaCookies } from "./cookies/lanka-cookies/LankaCookies";
export type { ILankaCookieOptions } from "./cookies/_interfaces/ILankaCookieOptions";
export type { ILankaCookieSetOptions } from "./cookies/_interfaces/ILankaCookieSetOptions";
export type { ILankaCookieDeleteOptions } from "./cookies/_interfaces/ILankaCookieDeleteOptions";

export { createLankaReleaseGuard } from "./_factories/create-lanka-release-guard/createLankaReleaseGuard";
export type { ILankaReleaseGuardConfig } from "./_factories/create-lanka-release-guard/createLankaReleaseGuard";
export type { ILankaReleaseMemory } from "./_interfaces/ILankaReleaseMemory";
export type { TLankaReleaseOutcome } from "./_types/TLankaReleaseOutcome";
