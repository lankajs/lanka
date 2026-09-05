import { requireActiveRuntime } from "../../../_internal/active-runtime/activeRuntime";
import { ILankaScenario } from "../../_interfaces/ILankaScenario";
import { ALankaScenario } from "../../_abstractions/lanka-scenario/ALankaScenario";
import { ILankaScenarioVM } from "../../_interfaces/ILankaScenarioVM";
import { LankaScenarioVMRegistry } from "../lanka-scenario-vm-registry/LankaScenarioVMRegistry";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import type { ILankaScenarioMetadata } from "../../_interfaces/ILankaScenarioMetadata";

/**
 * Runs a scenario's `cleanup`, if it declared one, and contains what it throws.
 *
 * `ILankaScenario` promises `cleanup` is "called when the scenario is removed
 * from the registry", and for a long time nothing called it: a scenario whose
 * `initialize` opened something had no way to close it, and the promise read
 * as kept. Contained, because a removal runs over MANY scenarios — on dispose,
 * on the between-tests reset — and one failing to let go is no reason to leave
 * the rest registered.
 */
const release = (scenario: ILankaScenario<unknown>): void => {
	if (!scenario.cleanup) return;
	try {
		scenario.cleanup();
	} catch (error) {
		lankaLogger.printScenarioLog(`Error cleaning up scenario "${scenario.name}":`, error);
	}
};

/**
 * The scenario registry: both those that registered themselves and those
 * registered by hand.
 *
 * `ALankaScenario` subclasses arrive here automatically unless they opted out.
 */
export class LankaScenariosRegistry {
	private registeredScenarios: Map<string, ILankaScenario<unknown>> = new Map();
	private scenarioMetadata: Map<string, ILankaScenarioMetadata> = new Map();

	/**
	 * Public: the registry belongs to a framework instance rather than to the
	 * module.
	 */
	public constructor() {}

	/**
	 * The active instance's registry, for callers that cannot hold one:
	 * `ALankaScenario` (a base class the consumer extends) and the static
	 * `LankaScenarioBootstrap`. Instance holders read `lanka.scenarios`.
	 */
	public static getInstance(): LankaScenariosRegistry {
		return requireActiveRuntime().scenarios;
	}

	/**
	 * Registers a scenario by hand.
	 *
	 * @param scenario What to register
	 * @returns `false` when it was already registered
	 */
	public register(scenario: ILankaScenario<unknown>): boolean {
		if (this.registeredScenarios.has(scenario.name)) {
			return false;
		}

		this.registeredScenarios.set(scenario.name, scenario);
		this.scenarioMetadata.set(scenario.name, {
			scenario,
			name: scenario.name,
			eventType: scenario.eventType,
			dataTypeName: scenario.dataTypeName,
			isRegistered: true,
		});

		return true;
	}

	/**
	 * Removes a scenario, calling its `cleanup` if it declared one.
	 *
	 * @param scenarioName Name of the scenario to unregister
	 * @returns true if unregistered successfully, false if not found
	 */
	public unregister(scenarioName: string): boolean {
		const scenario = this.registeredScenarios.get(scenarioName);
		if (!scenario) {
			return false;
		}

		const metadata = this.scenarioMetadata.get(scenarioName);
		if (metadata) {
			metadata.isRegistered = false;
		}

		this.registeredScenarios.delete(scenarioName);
		release(scenario);
		return true;
	}

	/**
	 * Get metadata for a specific scenario
	 * @param scenarioName Name of the scenario
	 * @returns Scenario metadata or undefined if not found
	 */
	public getMetadata(scenarioName: string): ILankaScenarioMetadata | undefined {
		return this.scenarioMetadata.get(scenarioName);
	}

	/** Every registered scenario. */
	public getAllScenarios(): ILankaScenario<unknown>[] {
		return Array.from(this.registeredScenarios.values());
	}

	/** Metadata of every scenario. */
	public getAllMetadata(): ILankaScenarioMetadata[] {
		return Array.from(this.scenarioMetadata.values());
	}

	/** Whether a scenario with this name is registered. */
	public isRegistered(scenarioName: string): boolean {
		return this.registeredScenarios.has(scenarioName);
	}

	/**
	 * Collects every scenario that registered itself at construction.
	 */
	public collectAutoRegisteredScenarios(): void {
		// Take those that registered themselves at construction.
		const autoRegistered = ALankaScenario.getAutoRegisteredScenarios();
		autoRegistered.forEach((scenario) => {
			if (!this.registeredScenarios.has(scenario.name)) {
				this.register(scenario);
			}
		});
	}

	/**
	 * A scenario by name.
	 *
	 * @returns `undefined` when there is none
	 */
	public getScenarioByName(scenarioName: string): ILankaScenario<unknown> | undefined {
		return this.registeredScenarios.get(scenarioName);
	}

	/** Every registered ViewModel. */
	public getAllViewModels(): ILankaScenarioVM[] {
		return LankaScenarioVMRegistry.getInstance().getAllViewModels();
	}

	/**
	 * Removes every scenario, calling each one's `cleanup`.
	 *
	 * What `dispose()` and the between-tests reset go through: `initialize` ran
	 * for every scenario at bootstrap, and this is the one moment its mirror
	 * image can run for all of them.
	 */
	public clear(): void {
		const scenarios = [...this.registeredScenarios.values()];
		this.registeredScenarios.clear();
		this.scenarioMetadata.clear();
		for (const scenario of scenarios) release(scenario);
	}
}
