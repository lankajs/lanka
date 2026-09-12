/**
 * The key-value storage port, and no storage.
 *
 * Types only, the way `lanka/cache` is: core declares what an engine must do and
 * calls none. Nothing in core reads or writes a key — a persisted value belongs
 * to the application, and the framework's own state is in memory for the life of
 * a page.
 *
 * The port lives here rather than in `@lankajs/storage`, which owns every
 * implementation, for one reason: `@lankajs/tool-testing` depends on `lanka` and
 * on nothing else, so a conformance suite over a MODULE's port would invert the
 * direction the whole repository points. A family whose members promise
 * interchangeability with no suite to check it promises nothing.
 *
 * `@lankajs/storage` re-exports all three names, so an application that imports
 * them from there keeps working and always will.
 */

export type { ILankaStorageAdapter } from "./_interfaces/ILankaStorageAdapter";
export type { ILankaAsyncStorageAdapter } from "./_interfaces/ILankaAsyncStorageAdapter";
export type { ILankaSyncStorageAdapter } from "./_interfaces/ILankaSyncStorageAdapter";
