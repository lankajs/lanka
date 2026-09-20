import { LankaScenariosRegistry } from "../../../scenario/_registries/lanka-scenarios-registry/LankaScenariosRegistry";
import { ILankaScenario } from "../../../scenario/_interfaces/ILankaScenario";
import { ALankaScenario } from "../../../scenario/_abstractions/lanka-scenario/ALankaScenario";
import { ALankaLocator } from "../../_abstractions/lanka-locator/ALankaLocator";
/**
 * Classes come from the consumer's barrel.
 *
 * Adding one is ONE export line: types are inferred, autocomplete works, and no
 * list has to be maintained.
 */
import * as ScenariosModule from "@lanka_di/Scenarios";

/**
 * The barrel's class whose INSTANCE carries this name, when the export key does
 * not.
 *
 * A pooled instance answers for its class without constructing another: the
 * pool is never drained, so a lookup that constructed every class on every miss
 * grew it by the whole barrel each time a bad name was asked for. Only a class
 * the pool has never seen is constructed here — once, and it joins the pool.
 */
const findScenarioClassByInstanceName = (
	scenarioName: string,
): (new () => ILankaScenario<unknown>) | undefined => {
	const pooled = ALankaScenario.getAutoRegisteredScenarios();

	for (const value of Object.values(ScenariosModule)) {
		if (typeof value !== "function" || !value.prototype) continue;

		const Class = value as new () => ALankaScenario<unknown>;
		const instance =
			pooled.find((scenario) => scenario.constructor === Class) ?? construct(Class);
		if (instance?.name === scenarioName) return Class;
	}

	return undefined;
};

/** A new instance, or `undefined` for an export that is not constructible. */
const construct = (
	Class: new () => ALankaScenario<unknown>,
): ALankaScenario<unknown> | undefined => {
	try {
		return new Class();
	} catch {
		return undefined;
	}
};

/**
 * Resolves scenarios by property name (camelCase) or scenario name
 * (PascalCase).
 *
 * Looks in the registry, then in the self-registration pool, and failing both
 * constructs the scenario from the consumer's barrel on first use.
 */
export class LankaScenarioLocator extends ALankaLocator<ILankaScenario<unknown>> {
	/**
	 * The registry is read LAZILY rather than in a field initialiser.
	 *
	 * The locator is constructed INSIDE `createLanka`, before the instance becomes
	 * active. A field initialiser would ask for the active instance at that moment
	 * and fail with "no instance yet" while the instance being created is on the
	 * stack. Deferred reading resolves it: by the first scenario resolution an
	 * active instance exists.
	 */
	private get registry(): LankaScenariosRegistry {
		return LankaScenariosRegistry.getInstance();
	}

	/**
	 * Every constructible class the consumer's barrel exports.
	 *
	 * Published so that this file stays the ONE module in the framework that reads
	 * `@lanka_di/Scenarios`. `LankaScenarioBootstrap` used to read it too, and
	 * that second reader is what made `lanka/scenario` — the entry a consumer's
	 * scenario class imports `ALankaScenario` from — part of the import cycle the
	 * inversion creates. A bundler is free to order the chunks behind that entry
	 * however it likes, and when it put the barrel first the consumer's class
	 * extended `undefined`. `lanka/locator` carries the cycle instead, and no
	 * scenario class imports it.
	 *
	 * Not a filter on "is a scenario": an export that is not a function has no
	 * chance of being one, and anything further is decided by CONSTRUCTING it,
	 * which is the caller's job and the only honest test.
	 *
	 * ## Why the values are widened to `unknown` first
	 *
	 * A type predicate has to be assignable to the type it narrows, and the type
	 * of what this reads is the CONSUMER'S — whatever their `Scenarios` barrel
	 * happens to export. A real scenario class is `typeof TheirScenario`, which
	 * carries the statics `ALankaScenario` declares, and `new () => ILankaScenario`
	 * has none of them: the predicate is not assignable to it, and the file does
	 * not compile in any project whose barrel has a scenario in it.
	 *
	 * It compiled here for one reason: this repository's fixture barrel says
	 * `export {}`, so `Object.values` is `never[]` and every predicate is
	 * vacuously assignable. `_playgrounds/node` is where it failed, because that
	 * is a barrel with a real class in it — the same blind spot, in the same
	 * shape, as the empty probe barrels that let the 2.0.0 chunk cycle ship.
	 *
	 * `unknown` is also what this honestly knows. The framework cannot see a
	 * consumer's types; it sees exports and asks whether each is a function.
	 */
	public getDeclaredScenarioClasses(): readonly (new () => ILankaScenario<unknown>)[] {
		return (Object.values(ScenariosModule) as readonly unknown[]).filter(
			(exported): exported is new () => ILankaScenario<unknown> =>
				typeof exported === "function",
		);
	}

	constructor() {
		super({
			findClassByName: (scenarioName: string) => {
				// By export key first: an instance name does not always survive minification.
				if (scenarioName in ScenariosModule) {
					// `as unknown` before the guards, exactly as in the singleton locator.
					// An EMPTY barrel — what the scaffolder writes, and what a new project
					// has until its first scenario — makes the module's keys `never`, so
					// an indexed access is `never` and reading `.prototype` off it does
					// not compile.
					const ScenarioClass = ScenariosModule[
						scenarioName as keyof typeof ScenariosModule
					] as unknown;
					if (
						typeof ScenarioClass === "function" &&
						"prototype" in ScenarioClass &&
						ScenarioClass.prototype
					) {
						return ScenarioClass as new () => ILankaScenario<unknown>;
					}
				}
				// Fallback: look up by instance name.
				return findScenarioClassByInstanceName(scenarioName);
			},
			getInstanceByName: (scenarioName: string) => {
				// The registry first.
				const registered = this.registry.getScenarioByName(scenarioName);
				if (registered) {
					return registered;
				}

				// Then those that registered themselves.
				const autoRegistered = ALankaScenario.getAutoRegisteredScenarios();
				const scenario = autoRegistered.find((s) => s.name === scenarioName);

				if (scenario) {
					if (!this.registry.isRegistered(scenarioName)) {
						this.registry.register(scenario);
					}
					return scenario;
				}

				// Then finding the class by name and constructing it.
				return undefined;
			},
			createInstance: (ScenarioClass) => {
				const instance = new ScenarioClass();
				const scenarioName = instance.name;
				if (!this.registry.isRegistered(scenarioName)) {
					this.registry.register(instance);
				}
				return instance;
			},
			notFoundError: (scenarioName, propertyName) =>
				`Scenario "${scenarioName}" (accessed as "${propertyName}") not found. ` +
				`Make sure the scenario class extends ALankaScenario and has name="${scenarioName}".`,
		});
	}
}
