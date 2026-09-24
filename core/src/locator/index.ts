/**
 * Resolution by name, and the inverted dependency on the application.
 *
 * The application publishes five barrels at a known path; the framework reads
 * them through `@lanka_di` and gets type-safe access with no manual
 * registration list.
 *
 * All four locators live in one subsystem: they differ only by the marker used
 * to select classes, and the shared `ALankaLocator` is the single place where
 * that difference is expressed.
 */

export type { ILankaScope } from "./_factories/create-lanka-scope/createLankaScope";
export type { ILankaLocatorConfig } from "./_abstractions/lanka-locator/ALankaLocator";
export type { ILankaLocator } from "./_interfaces/ILankaLocator";

// The four ambient facades an application writes. The concrete locator behind
// each of them is mechanism and lives in `lanka/extend`: an application resolves
// through the facade, and only something building its own resolution needs the
// class that does it.
export { lankaGateways } from "./gateway/_facades/lanka-gateways/lankaGateways";
export type { TLankaGateways } from "./gateway/_types/TLankaGateways";

export { lankaScenarios } from "./scenario/_facades/lanka-scenarios/lankaScenarios";
export type { TLankaScenarios } from "./scenario/_types/TLankaScenarios";

// This entry must reach NO module that imports a `@lanka_di/*` barrel.
//
// A consumer's singleton extends `ALankaSingleton` or is built by
// `createLankaSingleton`, both exported here, and is published in
// `@lanka_di/Singletons` — the barrel `LankaSingletonLocator` reads. Reach that
// locator from here and the entry is inside a cycle: the barrel evaluates while
// this module's body has not run, and the consumer's class meets
//
//     TypeError: Class extends value undefined is not a constructor or null
//
// Export order cannot hold this. The build hoists every chunk import above the
// body, so what decides the evaluation order is which chunks this entry imports,
// and the only safe answer is none that reads a barrel. The facades reach their
// locators through the active runtime, never by import; `lanka/extend` publishes
// the locator classes from their own files. `scripts/verify-build.mjs` §1b reads
// the built graph and refuses this entry the moment it reaches a reader, and §3b
// imports it FIRST in a consumer whose barrel extends the marker.
export { ALankaSingleton } from "./singleton/_abstractions/lanka-singleton/ALankaSingleton";
export { createLankaSingleton } from "./singleton/_factories/create-lanka-singleton/createLankaSingleton";
export { lankaSingletons } from "./singleton/_facades/lanka-singletons/lankaSingletons";
export type { ILankaSingletonLocatorConfig } from "./singleton/lanka-singleton-locator/LankaSingletonLocator";
export type { TLankaSingletons } from "./_types/TLankaSingletons";

export { lankaSharedStores } from "./shared-store/_facades/lanka-shared-stores/lankaSharedStores";
export type { ILankaSharedStoreLocatorConfig } from "./shared-store/lanka-shared-store-locator/LankaSharedStoreLocator";
export type { TLankaSharedStores } from "./shared-store/_types/TLankaSharedStores";
