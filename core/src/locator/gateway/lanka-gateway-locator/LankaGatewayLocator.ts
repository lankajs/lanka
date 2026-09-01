import * as GatewaysModule from "@lanka_di/Gateways";
import type { ALankaGateway } from "../../../gateway/_abstractions/lanka-gateway/ALankaGateway";
import { ALankaLocator } from "../../_abstractions/lanka-locator/ALankaLocator";
import { findExportedClass } from "../../_internal/find-exported-class/findExportedClass";

/**
 * Resolves a gateway by property name (camelCase) or class name (PascalCase),
 * constructing it lazily and caching the instance.
 *
 * Adding a gateway takes one export line in `@lanka_di/Gateways`: types are
 * inferred and nothing is registered.
 */
export class LankaGatewayLocator extends ALankaLocator<ALankaGateway<unknown>> {
	constructor() {
		super({
			findClassByName: (gatewayName: string) =>
				findExportedClass<ALankaGateway<unknown>>(GatewaysModule, gatewayName),
			notFoundError: (gatewayName, propertyName) =>
				`Gateway "${gatewayName}" (accessed as "${propertyName}") not found. ` +
				`Make sure the gateway class extends ALankaGateway and is exported from lankaGateways.ts.`,
		});
	}
}
