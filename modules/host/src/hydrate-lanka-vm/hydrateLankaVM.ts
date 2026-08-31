import { getLankaFlags } from "lanka/config";
import type { StoreApi, UseBoundStore } from "zustand";

/**
 * Stores that already have their first state, so a second attempt is a no-op.
 *
 * A `WeakSet` rather than a flag per store: a ViewModel is a module-level object
 * an application creates and never disposes, and a map keyed by name would hold
 * a string for every screen the process has ever seen.
 */
const hydrated = new WeakSet<object>();

/**
 * Makes data fetched somewhere else the ViewModel's FIRST state.
 *
 * The other half of a server-rendered screen. A host framework's loader — a Next
 * server component, a React Router `loader`, a TanStack Start server function —
 * calls a gateway, and the page hands what came back to the browser as a prop.
 * Without this, the screen mounts empty and asks for the same data a second time,
 * over a slower connection, while the user watches a spinner over content the
 * server already had.
 *
 * ```tsx
 * "use client";
 *
 * export const UserScreen = ({ initial }: { initial: Partial<TUserState> }) => {
 * 	hydrateLankaVM(useUserVM, initial); // before the first read, once
 * 	const vm = useUserVM();
 * 	…
 * };
 * ```
 *
 * ## Once, and quietly the second time
 *
 * The first call wins; later ones do nothing. Not a throw, deliberately: React
 * renders a component twice in StrictMode and once more on every re-render, so a
 * throw would turn correct code into a crash that only reproduces in development.
 *
 * In development a later call carrying DIFFERENT data does warn, because that one
 * is a real mistake with a real cause — usually a navigation expecting fresh
 * server data to land in a store that already has some. **Hydration is the first
 * paint; every change after it is an action.**
 *
 * ## Why not `states` on the ViewModel config
 *
 * `states` is what the screen looks like before anybody has answered — it is
 * written once, in the ViewModel, by whoever owns the screen. This is data that
 * arrives per request and is not known where the ViewModel is declared. Merging
 * the two would mean a ViewModel whose declared initial state depends on which
 * page mounted it.
 */
export const hydrateLankaVM = <TState extends object>(
	useVM: UseBoundStore<StoreApi<TState>>,
	snapshot: Partial<TState>,
): void => {
	if (hydrated.has(useVM)) {
		if (getLankaFlags().isDevelopment === true) warnOnSecondSnapshot(useVM, snapshot);
		return;
	}

	hydrated.add(useVM);
	useVM.setState(snapshot);
};

/** The development-only half: a second, different snapshot is a mistake. */
const warnOnSecondSnapshot = <TState extends object>(
	useVM: UseBoundStore<StoreApi<TState>>,
	snapshot: Partial<TState>,
): void => {
	const current = useVM.getState() as Record<string, unknown>;
	const differing = Object.entries(snapshot).filter(
		([key, value]) => !Object.is(current[key], value),
	);

	if (differing.length === 0) return;

	console.warn(
		`[lanka] hydrateLankaVM: ignored a second snapshot that differs in ` +
			`${differing.map(([key]) => key).join(", ")}. Hydration is the first paint only — ` +
			`use an action to change state that has already been hydrated.`,
	);
};
