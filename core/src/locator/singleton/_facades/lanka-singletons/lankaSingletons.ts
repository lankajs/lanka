import { requireActiveRuntime } from "../../../../_internal/active-runtime/activeRuntime";
import type { ILankaLocator } from "../../../_interfaces/ILankaLocator";
import type { TLankaSingletons } from "../../../_types/TLankaSingletons";
import { createLankaLocatorProxy } from "../../../_factories/create-lanka-locator-proxy/createLankaLocatorProxy";
export { LankaSingletonLocator } from "../../lanka-singleton-locator/LankaSingletonLocator";
export type { ILankaSingletonLocatorConfig } from "../../lanka-singleton-locator/LankaSingletonLocator";

/**
 * Access to every singleton at once.
 *
 * A class appears here by itself as soon as the consumer's barrel exports it.
 * The property is camelCase, the class name PascalCase.
 *
 * ```ts
 * import { lankaSingletons } from "lanka";
 *
 * const profile = lankaSingletons.userProfile;
 * ```
 *
 * `LankaSingletonLocator` itself registers a class or a ready object by hand —
 * for tests and for objects that arrive already built. Those methods are NOT
 * called through this proxy: `registerSingleton`,
 * `registerSingletonInstance`, `unregisterSingleton`, `isRegistered` and
 * `clearCache` are closed here deliberately, or reaching for them would read as
 * a request for a singleton by that name and the failure would come from the
 * wrong place.
 */
/**
 * The locator comes from the active instance rather than being created here.
 *
 * The cache of resolved objects is state, and module-level state means two
 * frameworks in one process resolve the same gateway. The proxy stays in
 * place; what moved is the cache.
 */
const singletonLocator: ILankaLocator<unknown> = {
	get: (propertyName: string) => requireActiveRuntime().locators.singletons.get(propertyName),
};

export const lankaSingletons = createLankaLocatorProxy<unknown, TLankaSingletons>({
	locator: singletonLocator,
	protectedProperties: [
		"clearCache",
		"register",
		"registerInstance",
		"unregister",
		"isRegistered",
	],
	errorPrefix: "Cannot access singleton",
});
