/**
 * A session that survives a reload, and a set of ids that must stay small.
 *
 * The three lifetimes are three files under `session/`, so picking the wrong one
 * is a visible import rather than a character in a method name.
 */
export { startPlaygroundStorage } from "./start-playground-storage/startPlaygroundStorage";
export { createPlaygroundSession } from "./session/create-playground-session/createPlaygroundSession";
export { createPlaygroundReadMarks } from "./create-playground-read-marks/createPlaygroundReadMarks";
export { createPlaygroundTenantStorage } from "./create-playground-tenant-storage/createPlaygroundTenantStorage";
export { createPlaygroundSecretNotes } from "./create-playground-secret-notes/createPlaygroundSecretNotes";
export { createPlaygroundMemoryAdapter } from "./create-playground-memory-adapter/createPlaygroundMemoryAdapter";
export type { IPlaygroundPreferences } from "./_interfaces/IPlaygroundPreferences";
