import { getActiveRuntime } from "../../_internal/active-runtime/activeRuntime";
import type { ILankaScenarioVM } from "../../scenario/_interfaces/ILankaScenarioVM";

/**
 * Resets the active instance, if there is one.
 *
 * What the test kit needs between cases. Silent when there is no instance:
 * "reset nothing" is not an error, and the setup file runs before EVERY test,
 * including those that never bootstrap the framework.
 */
export function resetActiveLanka(): void {
	const active = getActiveRuntime();
	if (!active) return;

	active.viewModels.resetAll();
	active.scenarios.clear();
	active.eventBus.clearAllEvents();
	active.scenarioState.bootstrapped = false;
	active.scenarioState.initialized = new WeakSet<ILankaScenarioVM>();
}
