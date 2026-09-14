import { useCallback, useRef, useSyncExternalStore } from "react";
import { createLankaAccessTracker } from "../create-lanka-access-tracker/createLankaAccessTracker";
import type { ILankaAccessTracker } from "../create-lanka-access-tracker/createLankaAccessTracker";

export interface ILankaTrackedHookConfig<TState extends object> {
	/**
	 * Subscribes to the source, reporting both states already in FULL shape.
	 *
	 * A shared-store ViewModel composes its full state from a store slice, so the
	 * shaping happens here rather than inside the hook: the hook compares states,
	 * it does not know how one is assembled.
	 */
	subscribe: (onChange: (next: TState, prev: TState) => void) => () => void;
	/** The current full state. */
	readState: () => TState;
	/**
	 * Called when a change touched no tracked key, so no re-render will follow.
	 *
	 * The one seam the two ViewModel families differ on: only the plain factory
	 * reports the blind spot, and only in development.
	 */
	onUntrackedChange?: (
		trackedKeys: Set<string>,
		next: Record<string, unknown>,
		prev: Record<string, unknown>,
	) => void;
}

/**
 * The access-tracking hook every ViewModel factory renders through.
 *
 * Without a selector the component receives a Proxy that records which keys it
 * read; the next change re-renders only if one of THOSE keys moved. With a
 * selector the selector decides and tracking is bypassed.
 *
 * Both ViewModel families needed exactly this, and differed only in where the
 * state comes from — a store of their own, or a slice of a shared one. Those are
 * the two parameters above.
 *
 * ## What is here and what is next door
 *
 * The RECORDING — which keys were read, whether a change touched them, and the
 * proxy that answers the first question — is `createLankaAccessTracker`, and it
 * imports nothing. What is left here is the part that is genuinely React: a ref
 * per mounted component, a stable `subscribe`, and `useSyncExternalStore`.
 *
 * The split is not tidiness. Every framework asks the same question of a store
 * and answers it with a different mechanism, so the question had to stop living
 * inside one framework's answer — see `_plans/14`.
 */
export const createLankaTrackedHook = <TState extends object>(
	config: ILankaTrackedHookConfig<TState>,
) => {
	return (selector?: (state: TState) => unknown): unknown => {
		const selectorRef = useRef(selector);
		selectorRef.current = selector;

		// One tracker per mounted component: two components over one ViewModel read
		// different keys and must re-render for different changes. Built lazily
		// rather than as an initialiser argument, which would construct one on
		// every render and throw all but the first away.
		const trackerRef = useRef<ILankaAccessTracker<TState> | null>(null);
		trackerRef.current ??= createLankaAccessTracker(config.readState);

		/**
		 * Stable identity; the empty dependency list is deliberate.
		 *
		 * `useSyncExternalStore` keeps `subscribe` in an effect keyed on its
		 * identity, so an inline arrow makes React tear the subscription down and
		 * rebuild it on EVERY render of EVERY connected component — measured at 201
		 * subscriptions for 200 renders. The body reads only refs and the
		 * factory-scope config, never a prop or a render-scoped value, so there is
		 * nothing for `[]` to capture stale.
		 */
		const subscribe = useCallback(
			(onStoreChange: () => void) =>
				config.subscribe((nextState, prevState) => {
					if (selectorRef.current) {
						onStoreChange();
						return;
					}

					const tracker = trackerRef.current;
					if (!tracker || tracker.shouldNotify(nextState, prevState)) {
						onStoreChange();
						return;
					}

					// Reaching here means NO re-render will follow. If the changed key is
					// linked to the component through a getter it read, the screen froze.
					config.onUntrackedChange?.(
						new Set(tracker.trackedKeys),
						nextState as Record<string, unknown>,
						prevState as Record<string, unknown>,
					);
				}),
			[],
		);

		return useSyncExternalStore(subscribe, readTracked, readUntracked);

		function readTracked(): unknown {
			const activeSelector = selectorRef.current;
			if (activeSelector) return activeSelector(config.readState());

			return trackerRef.current?.read() ?? config.readState();
		}

		/**
		 * The server snapshot: the state itself, never the Proxy.
		 *
		 * Tracking exists to skip renders a client would otherwise do; a server
		 * renders once, and handing it a recording Proxy would only add work whose
		 * result nothing reads.
		 */
		function readUntracked(): unknown {
			const state = config.readState();
			const activeSelector = selectorRef.current;

			return activeSelector ? activeSelector(state) : state;
		}
	};
};
