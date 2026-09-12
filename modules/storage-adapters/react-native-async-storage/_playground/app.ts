/**
 * A device application whose preferences arrive a tick after its first render.
 *
 * The engine is the fixture — AsyncStorage in memory, answering late the way the
 * bridge does — and the preferences are ordinary application code that never
 * learns which engine it was handed.
 */
export { createPlaygroundAsyncStorage } from "./create-playground-async-storage/createPlaygroundAsyncStorage";
export { createPlaygroundPreferences } from "./create-playground-preferences/createPlaygroundPreferences";
export type { IPlaygroundBoot } from "./create-playground-preferences/createPlaygroundPreferences";
