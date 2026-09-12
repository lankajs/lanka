/**
 * Somebody else's application — the one a consumer would be testing.
 *
 * This package is a test kit, so its playground is INVERTED: the thing under
 * test is the kit, and the application is the fixture. What the kit promises is
 * that testing this costs a consumer nothing beyond a render call — no manual
 * bootstrap, no leaked subscriptions between tests, no hand-built doubles.
 */
export { startPlaygroundApp } from "./start-playground-app/startPlaygroundApp";
export { createPlaygroundProfileVM } from "./create-playground-profile-vm/createPlaygroundProfileVM";
export { PlaygroundProfileScreen } from "./playground-profile-screen/PlaygroundProfileScreen";
export { PlaygroundProfileGateway } from "./playground-profile-gateway/PlaygroundProfileGateway";
export { PlaygroundProfileAudit } from "./playground-profile-audit/PlaygroundProfileAudit";
export { createPlaygroundDraftStore } from "./create-playground-draft-store/createPlaygroundDraftStore";
export { createPlaygroundBagAdapter } from "./create-playground-bag-adapter/createPlaygroundBagAdapter";
export {
	PlaygroundProfileLoaded,
	playgroundProfileLoaded,
} from "./playground-profile-loaded/PlaygroundProfileLoaded";
export type { IPlaygroundApp } from "./_interfaces/IPlaygroundApp";
export type { IPlaygroundProfile } from "./_interfaces/IPlaygroundProfile";
export type { IPlaygroundProfileAudit } from "./_interfaces/IPlaygroundProfileAudit";
export type { IPlaygroundProfileState } from "./_interfaces/IPlaygroundProfileState";
