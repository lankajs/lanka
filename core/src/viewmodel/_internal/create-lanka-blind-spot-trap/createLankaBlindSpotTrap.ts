export interface ILankaBlindSpotTrap {
	/** Whether the trap is armed. Everything below is inert when it is not. */
	readonly isArmed: boolean;
	/** Wraps `get` so reads made inside an action are attributed to it. */
	observeGet: <TState>(get: () => TState) => () => TState;
	/** Wraps the actions so the trap knows which one is running. */
	observeActions: <TActions extends object>(declared: TActions) => TActions;
	/** Reports a change that will not re-render, when the component reads the key. */
	report: (
		trackedKeys: Set<string>,
		next: Record<string, unknown>,
		prev: Record<string, unknown>,
	) => void;
}

/**
 * The blind spot: a key the component reads through a GETTER.
 *
 * Access tracking sees direct reads off the proxy. A key reached only inside a
 * derived getter is invisible to it, so a change to that key re-renders nothing
 * and the screen freezes with no error anywhere.
 *
 * The trap watches which keys each action reads through `get()`, and warns when
 * one of those changes without a tracked key changing with it.
 *
 * Development only: in production this is work on a hot path plus console noise
 * for somebody who does not write the code. Disarmed, every method is identity.
 */
export const createLankaBlindSpotTrap = (
	viewModelName: string,
	isArmed: boolean,
): ILankaBlindSpotTrap => {
	if (!isArmed) {
		return {
			isArmed: false,
			observeGet: (get) => get,
			observeActions: (declared) => declared,
			report: () => undefined,
		};
	}

	/** Action name → state keys it read through `get()`, past the proxy. */
	const indirectReads = new Map<string, Set<string>>();
	/** Keys already warned about: a second warning adds nothing. */
	const warnedKeys = new Set<string>();
	let activeActionName: string | null = null;

	return {
		isArmed: true,

		observeGet<TState>(get: () => TState): () => TState {
			return () => {
				const state = get();
				const actionName = activeActionName;
				if (actionName === null) return state;

				return new Proxy(state as object, {
					get(target, prop, receiver) {
						if (typeof prop === "string") {
							let keys = indirectReads.get(actionName);
							if (!keys) {
								keys = new Set<string>();
								indirectReads.set(actionName, keys);
							}
							keys.add(prop);
						}
						return Reflect.get(target, prop, receiver) as unknown;
					},
				}) as TState;
			};
		},

		observeActions<TActions extends object>(declared: TActions): TActions {
			const observed = { ...declared } as Record<string, unknown>;

			for (const [name, value] of Object.entries(declared)) {
				if (typeof value !== "function") continue;

				observed[name] = (...args: unknown[]) => {
					// Restored rather than cleared: actions call each other, and clearing
					// would attribute the caller's later reads to nobody.
					const previous = activeActionName;
					activeActionName = name;
					try {
						return (value as (...a: unknown[]) => unknown)(...args);
					} finally {
						activeActionName = previous;
					}
				};
			}

			return observed as TActions;
		},

		report(trackedKeys, next, prev): void {
			for (const [changedKey, value] of Object.entries(next)) {
				if (Object.is(value, prev[changedKey])) continue;
				if (trackedKeys.has(changedKey) || warnedKeys.has(changedKey)) continue;

				// Not every untracked key is a fault: not reading what you do not need
				// is exactly what tracking exists for. The fault is a key the component
				// DOES read — through a getter taken off the proxy.
				const viaGetter = [...trackedKeys].some((key) =>
					indirectReads.get(key)?.has(changedKey),
				);
				if (!viaGetter) continue;

				warnedKeys.add(changedKey);
				console.warn(
					`[lanka] ${viewModelName}: key "${changedKey}" changed but no re-render will follow. ` +
						`The component reads it only through a getter, and tracking sees direct proxy reads only. ` +
						`Set enableAccessTrackingOptimization: false on this ViewModel — ` +
						`destructuring the key in the view "for the side effect" reads as dead code and will not survive a refactor.`,
				);
			}
		},
	};
};
