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
				for (const value of Object.values(ScenariosModule)) {
					if (typeof value === "function" && value.prototype) {
						try {
							const instance = new (value as new () => ALankaScenario<unknown>)();
							if (instance.name === scenarioName) {
								return value as new () => ILankaScenario<unknown>;
							}
						} catch {
							// Not constructible — skip.
							continue;
						}
					}
				}
				return undefined;
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
