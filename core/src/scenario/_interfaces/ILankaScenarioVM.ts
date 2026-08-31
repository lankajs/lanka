/**
 * A ViewModel that participates in scenarios.
 *
 * Not every ViewModel does: one with no `scenarioHandlers` never subscribes to
 * anything and is never registered. This is the pair of methods
 * `LankaScenarioBootstrap` calls on those that do, which is why the name says
 * scenario rather than ViewModel.
 *
 * Both are idempotent by contract: bootstrap may run after a ViewModel has
 * already initialised itself, and a reset may arrive for one that never did.
 */
export interface ILankaScenarioVM {
	/**
	 * Subscribes this ViewModel's scenario handlers.
	 *
	 * Called once the scenario registry is populated — a ViewModel declared at
	 * module level exists before any scenario does.
	 */
	initializeScenario(): void;

	/**
	 * Releases every subscription, leaving the ViewModel ready to initialise again.
	 *
	 * Called when the framework instance is disposed, and by `resetLanka()`
	 * between tests.
	 */
	resetScenario(): void;
}
