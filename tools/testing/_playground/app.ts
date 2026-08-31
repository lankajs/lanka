/**
 * Somebody else's application — the one a consumer would be testing.
 *
 * This package is a test kit, so its playground is INVERTED: the thing under
 * test is the kit, and the application is the fixture. What the kit promises is
 * that testing this costs a consumer nothing beyond a render call — no manual
 * bootstrap, no leaked subscriptions between tests, no hand-built doubles.
 */
export { createPlaygroundProfileVM } from "./create-playground-profile-vm/createPlaygroundProfileVM";
export { PlaygroundProfileScreen } from "./playground-profile-screen/PlaygroundProfileScreen";
export { PlaygroundProfileGateway } from "./playground-profile-gateway/PlaygroundProfileGateway";
export type { IPlaygroundProfile } from "./_interfaces/IPlaygroundProfile";
export type { IPlaygroundProfileState } from "./_interfaces/IPlaygroundProfileState";
