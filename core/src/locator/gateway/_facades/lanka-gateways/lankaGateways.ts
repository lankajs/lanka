import { requireActiveRuntime } from "../../../../_internal/active-runtime/activeRuntime";
import type { ILankaLocator } from "../../../_interfaces/ILankaLocator";
import type { TLankaGateways } from "../../_types/TLankaGateways";
import { createLankaLocatorProxy } from "../../../_factories/create-lanka-locator-proxy/createLankaLocatorProxy";
import type { ALankaGateway } from "../../../../gateway/_abstractions/lanka-gateway/ALankaGateway";

/**
 * The locator comes from the active instance rather than being created here.
 *
 * The cache of resolved objects is state, and module-level state would let two
 * frameworks in one process resolve the same gateway. The proxy stays at module
 * level because it has hundreds of call sites; only the cache moved.
 */
const gatewayLocator: ILankaLocator<ALankaGateway<unknown>> = {
	get: (propertyName: string) => requireActiveRuntime().locators.gateways.get(propertyName),
};

/**
 * Access to every gateway at once.
 *
 * An `ALankaGateway` subclass appears here by itself. The property is camelCase,
 * the gateway name is PascalCase.
 *
 * ```ts
 * import { lankaGateways } from "lanka";
 *
 * const user = await lankaGateways.userGateway.getById(1);
 * const list = await lankaGateways.companyGateway.getList({ page: 1 });
 * ```
 */
export const lankaGateways = createLankaLocatorProxy<ALankaGateway<unknown>, TLankaGateways>({
	locator: gatewayLocator,
	protectedProperties: ["clearCache"],
	errorPrefix: "Cannot access gateway",
});
