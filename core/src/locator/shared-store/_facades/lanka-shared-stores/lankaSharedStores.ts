import { requireActiveRuntime } from "../../../../_internal/active-runtime/activeRuntime";
import type { ILankaLocator } from "../../../_interfaces/ILankaLocator";
import { createLankaLocatorProxy } from "../../../_factories/create-lanka-locator-proxy/createLankaLocatorProxy";
import { ALankaSharedStore } from "../../../../viewmodel/_abstractions/lanka-shared-store/ALankaSharedStore";
import type { TLankaSharedStores } from "../../_types/TLankaSharedStores";

export { LankaSharedStoreLocator } from "../../lanka-shared-store-locator/LankaSharedStoreLocator";
export type { ILankaSharedStoreLocatorConfig } from "../../lanka-shared-store-locator/LankaSharedStoreLocator";

/**
 * The locator comes from the active instance rather than being created here.
 *
 * The cache of resolved objects is state, and module-level state would let two
 * frameworks in one process resolve the same store. The proxy stays at module
 * level because it has hundreds of call sites; only the cache moved.
 */
const sharedStoreLocator: ILankaLocator<ALankaSharedStore<object>> = {
	get: (propertyName: string) => requireActiveRuntime().locators.sharedStores.get(propertyName),
};

/**
 * Access to every shared store at once.
 *
 * An `ALankaSharedStore` subclass appears here by itself once it is exported from
 * `@lanka_di/SharedStores`. The property is camelCase, the class name PascalCase.
 */
export const lankaSharedStores = createLankaLocatorProxy<
	ALankaSharedStore<object>,
	TLankaSharedStores
>({
	locator: sharedStoreLocator,
	protectedProperties: [
		"clearCache",
		"register",
		"registerInstance",
		"unregister",
		"isRegistered",
	],
	errorPrefix: "Cannot access shared store",
});
