import { ALankaLocator } from "../../_abstractions/lanka-locator/ALankaLocator";
import { findExportedClass } from "../../_internal/findExportedClass";
/**
 * Classes come from the consumer's barrel.
 *
 * Adding one is ONE export line: types are inferred, autocomplete works, and no
 * list has to be maintained. A list maintained by hand is a list that eventually
 * falls behind the code.
 */
import * as SingletonsModule from "@lanka_di/Singletons";

/**
 * LankaSingletonLocator configuration.
 */
export interface ILankaSingletonLocatorConfig {
	/** The module holding singleton classes — the consumer's barrel. */
	singletonIndexModule?: Record<string, unknown>;
}

/**
 * Resolves singletons by property name (camelCase) or class name (PascalCase),
 * constructing them on first use and caching them.
 *
 * A class arrives either from the consumer's barrel or registered by hand — the
 * latter for tests and for objects that arrive already built.
 */
export class LankaSingletonLocator extends ALankaLocator<unknown> {
	private readonly singletonIndexModule?: Record<string, unknown>;

	constructor(config?: ILankaSingletonLocatorConfig) {
		super({
			findClassByName: (className: string) => {
				// Order: hand-registered first, then the application's barrel, then an
				// extra module if one was given.
				//
				// Each source is checked ONCE, by export key. A fallback pass over
				// `Class.name` looks for something a built bundle no longer has:
				// minification loses class names exactly as it loses export names.
				const registered = this.registeredClasses.get(className);
				if (registered) return registered;

				return (
					findExportedClass<unknown>(SingletonsModule, className) ??
					(this.singletonIndexModule
						? findExportedClass<unknown>(this.singletonIndexModule, className)
						: undefined)
				);
			},
			createInstance: (Class) => {
				return new Class();
			},
			notFoundError: (className, propertyName) =>
				`Singleton "${className}" (accessed as "${propertyName}") not found. ` +
				`Make sure the class is exported from @lanka_di/Singletons.ts or registered via registerSingleton method.`,
		});

		this.singletonIndexModule = config?.singletonIndexModule;
	}

	/**
	 * Creates a NEW service object, bypassing the locator's cache.
	 *
	 * For scopes: they take the class from here and set the lifetime themselves.
	 * The root cache is untouched — otherwise the first resolution inside a scope
	 * would replace the application's root object.
	 */
	public createScopedInstance(className: string, propertyName: string): unknown {
		const Class = this.config.findClassByName(className);
		if (!Class) {
			throw new Error(this.config.notFoundError(className, propertyName));
		}
		return this.config.createInstance(Class);
	}
}
