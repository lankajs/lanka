import type { ILankaLocator } from "../../_interfaces/ILankaLocator";
import { caseConvert } from "../../../_internal/case-convert/caseConvert";

/**
 * Base locator configuration.
 */
export interface ILankaLocatorConfig<TInstance> {
	/** How to find a constructor by class name. */
	findClassByName: (name: string) => (new () => TInstance) | undefined;
	/** How to create an object from a constructor. */
	createInstance?: (Class: new () => TInstance) => TInstance;
	/** Custom resolution by name, when the ordinary one is not enough. */
	getInstanceByName?: (name: string) => TInstance | undefined;
	/** What to say when there is no such object. */
	notFoundError?: (name: string, propertyName: string) => string;
}

/**
 * The locator base: resolves objects by property name (camelCase), translating
 * it into a class name (PascalCase).
 *
 * Handles what every locator shares — name translation, construction on first
 * use from the barrel's exports, and caching what was constructed.
 */
export abstract class ALankaLocator<TInstance> implements ILankaLocator<TInstance> {
	protected readonly instanceCache: Map<string, TInstance> = new Map();
	protected readonly registeredClasses: Map<string, new () => TInstance> = new Map();
	protected readonly registeredInstances: Map<string, TInstance> = new Map();
	protected readonly config: ILankaLocatorConfig<TInstance> & {
		createInstance: (Class: new () => TInstance) => TInstance;
		notFoundError: (name: string, propertyName: string) => string;
	};

	protected constructor(config: ILankaLocatorConfig<TInstance>) {
		// The defaults are applied AFTER the spread, so an explicit `undefined` —
		// which a caller forwarding its own optional config passes — falls back
		// instead of removing the only thing that can construct an instance.
		this.config = {
			...config,
			createInstance: config.createInstance ?? ((Class) => new Class()),
			notFoundError:
				config.notFoundError ??
				((name, propertyName) =>
					`Instance "${name}" (accessed as "${propertyName}") not found.`),
		};
	}

	/**
	 * The class a name resolves to: hand-registered FIRST, then the consumer's
	 * barrel.
	 *
	 * One owner for both callers, and that is the whole point of it existing.
	 * `registeredClasses` used to be read inside each locator's own
	 * `findClassByName`, and only two of the four did it — singletons and shared
	 * stores worked, gateways and scenarios silently dropped the class. Moving the
	 * read into `getInstanceByName` fixed those two and broke a third path:
	 * `LankaSingletonLocator.createScopedInstance` calls `findClassByName`
	 * directly, so a registered class stopped resolving inside a scope. Ten tests
	 * said so.
	 *
	 * Both callers go through here now. A fourth caller added later gets the
	 * precedence for free instead of having to remember it.
	 *
	 * The precedence itself matches `registeredInstances` below: what a caller
	 * handed over wins over what the barrel happens to export under that name,
	 * because the caller is usually a test substituting a double.
	 */
	protected classFor(instanceName: string): (new () => TInstance) | undefined {
		return (
			this.registeredClasses.get(instanceName) ?? this.config.findClassByName(instanceName)
		);
	}

	/**
	 * An object by class name.
	 *
	 * The cache first, then custom resolution when configured, and only then
	 * construction.
	 */
	protected getInstanceByName(instanceName: string): TInstance | undefined {
		if (this.instanceCache.has(instanceName)) {
			return this.instanceCache.get(instanceName);
		}

		// What was handed to us already built. Ahead of the barrel, and ahead of
		// custom resolution: a test's double must win over what the barrel exports.
		if (this.registeredInstances.has(instanceName)) {
			return this.registeredInstances.get(instanceName);
		}

		// Custom resolution when configured.
		if (this.config.getInstanceByName) {
			const instance = this.config.getInstanceByName(instanceName);
			if (instance) {
				this.instanceCache.set(instanceName, instance);
				return instance;
			}
		}

		// Otherwise find the class and construct.
		const Class = this.classFor(instanceName);
		if (Class) {
			const instance = this.config.createInstance(Class);
			this.instanceCache.set(instanceName, instance);
			return instance;
		}

		return undefined;
	}

	/**
	 * An object by property name (camelCase).
	 *
	 * Throws when there is none: a silent `undefined` would surface layers later.
	 */
	public get(propertyName: string): TInstance {
		const instanceName = caseConvert(propertyName, "pascalCase");
		const instance = this.getInstanceByName(instanceName);

		if (!instance) {
			throw new Error(this.config.notFoundError(instanceName, propertyName));
		}

		return instance;
	}

	/**
	 * Clears the instance cache. Required by tests.
	 */
	public clearCache(): void {
		this.instanceCache.clear();
	}

	// ── Registration by hand ─────────────────────────────────────────────────
	//
	// Every locator needs it, for the same two reasons: a test supplies a double,
	// and an application supplies an object it built itself. It lives here rather
	// than in each locator because three copies of four one-line methods are three
	// places for the cache invalidation to be forgotten.

	/**
	 * Registers a class by hand, ahead of the consumer's barrel.
	 *
	 * The cache entry is dropped: what it holds was built from the previous class.
	 */
	public register(className: string, Class: new () => TInstance): void {
		this.registeredClasses.set(className, Class);
		this.instanceCache.delete(className);
	}

	/**
	 * Registers an already-built object by hand.
	 *
	 * It goes straight into the cache: there is nothing left to construct, and a
	 * later lookup must not build a rival.
	 */
	public registerInstance(className: string, instance: TInstance): void {
		this.registeredInstances.set(className, instance);
		this.instanceCache.set(className, instance);
	}

	/** Removes a class or object registered by hand, and what was built from it. */
	public unregister(className: string): void {
		this.registeredClasses.delete(className);
		this.registeredInstances.delete(className);
		this.instanceCache.delete(className);
	}

	/** Whether this name resolves to anything the locator already holds. */
	public isRegistered(className: string): boolean {
		return (
			this.registeredClasses.has(className) ||
			this.registeredInstances.has(className) ||
			this.instanceCache.has(className)
		);
	}
}
