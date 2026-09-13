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

// The marker and its factory stand BEFORE the facade, and the order is
// load-bearing rather than tidy.
//
// This module is the one that reads the consumer's barrels: the facade below
// imports `@lanka_di/Singletons` at module level, and a consumer's singleton
// there extends `ALankaSingleton` or is built by `createLankaSingleton` — both
// of which live HERE. Exported after the facade, their modules had not been
// evaluated when the barrel reached for them, and a consumer publishing a
// singleton the documented way met:
//
//     TypeError: Class extends value undefined is not a constructor or null
//     TypeError: (0 , createLankaSingleton) is not a function
//
// Under a bundler the graph is hoisted and it happened to work; under node's own
// ESM evaluation — a server build, a test runner, anything reading source — it
// did not. Singletons are the only one of the four with this cycle, because they
// are the only kind whose base and factory live in the module that reads the
// barrels: a gateway's base is `lanka/gateway`, a scenario's `lanka/scenario`, a
// shared store's `lanka/viewmodel`.
export { ALankaSingleton } from "./singleton/_abstractions/lanka-singleton/ALankaSingleton";
export { createLankaSingleton } from "./singleton/_factories/create-lanka-singleton/createLankaSingleton";
export { lankaSingletons } from "./singleton/_facades/lanka-singletons/lankaSingletons";
export type { ILankaSingletonLocatorConfig } from "./singleton/_facades/lanka-singletons/lankaSingletons";
export type { TLankaSingletons } from "./_types/TLankaSingletons";

export { lankaSharedStores } from "./shared-store/_facades/lanka-shared-stores/lankaSharedStores";
export type { ILankaSharedStoreLocatorConfig } from "./shared-store/_facades/lanka-shared-stores/lankaSharedStores";
export type { TLankaSharedStores } from "./shared-store/_types/TLankaSharedStores";
