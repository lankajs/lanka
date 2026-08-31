import { requireActiveRuntime } from "../../../../_internal/active-runtime/activeRuntime";
import type { ILankaLocator } from "../../../_interfaces/ILankaLocator";
import { createLankaLocatorProxy } from "../../../_factories/create-lanka-locator-proxy/createLankaLocatorProxy";
import type { ILankaScenario } from "../../../../scenario/_interfaces/ILankaScenario";
import { TLankaScenarios } from "../../_types/TLankaScenarios";

/**
 * The locator comes from the active instance rather than being created here.
 *
 * The cache of resolved objects is state, and module-level state would let two
 * frameworks in one process resolve the same scenario. The proxy stays at module
 * level because it has hundreds of call sites; only the cache moved.
 */
const scenarioLocator: ILankaLocator<ILankaScenario<unknown>> = {
	get: (propertyName: string) => requireActiveRuntime().locators.scenarios.get(propertyName),
};

/**
 * Access to every scenario at once.
 *
 * An `ALankaScenario` subclass appears here by itself. The property is camelCase,
 * the scenario name is PascalCase.
 *
 * ```ts
 * import { lankaScenarios } from "lanka";
 *
 * lankaScenarios.sessionUpdated.trigger({ user });
 * lankaScenarios.usersListRefresh.trigger({ reason: "create" });
 *
 * lankaScenarios.usersListRefresh.subscribe((data) => { ... });
 * ```
 */
export const lankaScenarios = createLankaLocatorProxy<ILankaScenario<unknown>, TLankaScenarios>({
	locator: scenarioLocator,
	errorPrefix: "Cannot access scenario",
});
