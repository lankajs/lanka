import { requireActiveRuntime } from "../../../_internal/active-runtime/activeRuntime";
import { ILankaScenario } from "../../_interfaces/ILankaScenario";
import { ALankaScenario } from "../../_abstractions/lanka-scenario/ALankaScenario";
import { ILankaScenarioVM } from "../../_interfaces/ILankaScenarioVM";
import { LankaScenarioVMRegistry } from "../lanka-scenario-vm-registry/LankaScenarioVMRegistry";
import type { ILankaScenarioMetadata } from "../../_interfaces/ILankaScenarioMetadata";

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
	 * Unregister a scenario
	 * @param scenarioName Name of the scenario to unregister
	 * @returns true if unregistered successfully, false if not found
	 */
	public unregister(scenarioName: string): boolean {
		if (!this.registeredScenarios.has(scenarioName)) {
			return false;
		}

		const metadata = this.scenarioMetadata.get(scenarioName);
		if (metadata) {
			metadata.isRegistered = false;
		}

		this.registeredScenarios.delete(scenarioName);
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
	 * Clears every registered scenario. Required by tests.
	 */
	public clear(): void {
		this.registeredScenarios.clear();
		this.scenarioMetadata.clear();
	}
}
