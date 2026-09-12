/**
 * The lifecycle moments a ViewModel took, as the scenario binder receives them.
 *
 * A hook is present only when the ViewModel DECLARED it — overrode the method,
 * or passed it in config. Bootstrap registers a ViewModel for the sake of these
 * calls, so "declared" is what decides registration; a default no-op must not
 * count, or every ViewModel would sit in the scenario registry for nothing.
 */
export interface ILankaVMLifecycleHooks {
	onInit?: () => void;
	onReset?: () => void;
}
