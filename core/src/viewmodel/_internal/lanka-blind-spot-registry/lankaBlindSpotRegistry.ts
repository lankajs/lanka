import type { ILankaBlindSpotTrap } from "../create-lanka-blind-spot-trap/createLankaBlindSpotTrap";

/**
 * A ViewModel → its blind-spot trap, for whoever is doing the reading.
 *
 * ## Why the trap is not on the port
 *
 * The blind spot is a DEVELOPMENT diagnostic of this framework: a key the screen
 * reaches only through a derived getter changes, no re-render follows, and the
 * warning names the ViewModel and the key. Whoever can see that a render was
 * skipped is the binding — so the binding has to be able to reach the trap.
 *
 * Putting it on `ILankaReadableVM` would have been the short way and is the
 * wrong one: the port is what every binding implements against and what a
 * third-party author reads as the contract. A member that is empty in production
 * and framework-internal in development is not part of a contract; it is core
 * talking to itself past the interface.
 *
 * So the lookup is here, exported through `lanka/extend` by way of
 * `createLankaAccessTracker`, and a binding never names it. A ViewModel with no
 * trap — production, or a shape that has no blind spot to report — simply is not
 * in the map, and the tracker reports nothing.
 *
 * ## A WeakMap and not a property
 *
 * A ViewModel is a module-level object an application creates and never
 * disposes, and the trap must not outlive it — which a `Map` keyed by name would
 * guarantee it did. It is also not a property because the object a screen holds
 * is the store, and the store's members are a surface somebody's devtools walks.
 */
const traps = new WeakMap<object, ILankaBlindSpotTrap>();

export const lankaBlindSpotRegistry = {
	/** Remembers the trap built for one ViewModel. Disarmed traps are not kept. */
	remember(viewModel: object, trap: ILankaBlindSpotTrap): void {
		if (trap.isArmed) traps.set(viewModel, trap);
	},

	/** The trap for this ViewModel, if it has one. */
	of(viewModel: object): ILankaBlindSpotTrap | undefined {
		return traps.get(viewModel);
	},
};
