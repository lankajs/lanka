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

export { lankaSingletons } from "./singleton/_facades/lanka-singletons/lankaSingletons";
export { ALankaSingleton } from "./singleton/_abstractions/lanka-singleton/ALankaSingleton";
export { createLankaSingleton } from "./singleton/_factories/create-lanka-singleton/createLankaSingleton";
export type { ILankaSingletonLocatorConfig } from "./singleton/_facades/lanka-singletons/lankaSingletons";
export type { TLankaSingletons } from "./_types/TLankaSingletons";

export { lankaSharedStores } from "./shared-store/_facades/lanka-shared-stores/lankaSharedStores";
export type { ILankaSharedStoreLocatorConfig } from "./shared-store/_facades/lanka-shared-stores/lankaSharedStores";
export type { TLankaSharedStores } from "./shared-store/_types/TLankaSharedStores";
