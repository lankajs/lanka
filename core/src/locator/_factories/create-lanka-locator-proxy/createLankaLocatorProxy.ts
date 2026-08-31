import type { ILankaLocator } from "../../_interfaces/ILankaLocator";

/**
 * Configuration of the global locator proxy.
 */
export interface ILankaLocatorProxyConfig<TInstance> {
	/** The locator that actually resolves instances. */
	locator: ILankaLocator<TInstance>;
	/** Properties whose access must throw. */
	protectedProperties?: string[];
	/** Prefix of the message thrown for an unknown property. */
	errorPrefix?: string;
}

/**
 * Creates a Proxy for dynamic access to instances with type safety.
 * Converts camelCase property access to PascalCase instance names.
 *
 * @param config Proxy configuration
 * @returns Proxy object typed as TType
 */
export function createLankaLocatorProxy<TInstance, TType extends Record<string, TInstance>>(
	config: ILankaLocatorProxyConfig<TInstance>,
): TType {
	const { locator, protectedProperties = [], errorPrefix = "Cannot access" } = config;

	return new Proxy(locator, {
		get(target, prop: string | symbol): TInstance {
			// Symbols such as `Symbol.iterator` are not instance names.
			if (typeof prop !== "string") {
				throw new Error(`${errorPrefix} with symbol property: ${String(prop)}`);
			}

			// Internal properties are rejected.
			const internalProps = ["_", "constructor", "prototype", ...protectedProperties];

			if (
				prop.startsWith("_") ||
				internalProps.some((internalProp) => prop === internalProp)
			) {
				throw new Error(`${errorPrefix} with property: ${prop}`);
			}

			// The instance for a camelCase property name.
			return target.get(prop);
		},
	}) as unknown as TType;
}
