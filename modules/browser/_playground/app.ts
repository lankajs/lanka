/**
 * A consent banner, which is what cookies are usually reached for.
 *
 * The package exists because browsers disagree, and a consumer should not have
 * to know which API answered. What the application decides — its own shape, and
 * that anything else counts as absent — is a guard of its own.
 */
export { createPlaygroundConsent } from "./create-playground-consent/createPlaygroundConsent";
export { isConsent } from "./_guards/isConsent";
export type { IPlaygroundConsent } from "./_interfaces/IPlaygroundConsent";
export { startPlaygroundDeployment } from "./start-playground-release/startPlaygroundRelease";
export type { IPlaygroundDeployment } from "./start-playground-release/startPlaygroundRelease";
