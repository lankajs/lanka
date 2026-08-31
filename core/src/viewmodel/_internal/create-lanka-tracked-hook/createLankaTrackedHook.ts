import { useCallback, useRef, useSyncExternalStore } from "react";

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

const asRecord = (state: object): Record<string, unknown> => state as Record<string, unknown>;

/**
 * The access-tracking hook every ViewModel factory renders through.
 *
 * Without a selector the component receives a Proxy that records which keys it
 * read; the next change re-renders only if one of THOSE keys moved. With a
 * selector the selector decides and tracking is bypassed.
 *
 * Both ViewModel families needed exactly this, and differed only in where the
 * state comes from — a store of their own, or a slice of a shared one. Those are
 * the two parameters above; the eighty lines below were copied.
 */
export const createLankaTrackedHook = <TState extends object>(
	config: ILankaTrackedHookConfig<TState>,
) => {
	return (selector?: (state: TState) => unknown): unknown => {
		const selectorRef = useRef(selector);
		selectorRef.current = selector;

		const trackedKeysRef = useRef<Set<string>>(new Set());
		const trackedStateRef = useRef<TState | null>(null);
		const trackedProxyRef = useRef<TState | null>(null);

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

					const trackedKeys = trackedKeysRef.current;
					if (trackedKeys.size === 0) {
						onStoreChange();
						return;
					}

					const next = asRecord(nextState);
					const prev = asRecord(prevState);

					for (const key of trackedKeys) {
						if (!Object.is(next[key], prev[key])) {
							onStoreChange();
							return;
						}
					}

					// Reaching here means NO re-render will follow. If the changed key is
					// linked to the component through a getter it read, the screen froze.
					config.onUntrackedChange?.(trackedKeys, next, prev);
				}),
			[],
		);

		return useSyncExternalStore(subscribe, readTracked, readUntracked);

		function readTracked(): unknown {
			const state = config.readState();
			const activeSelector = selectorRef.current;

			if (activeSelector) return activeSelector(state);

			if (trackedStateRef.current === state && trackedProxyRef.current) {
				return trackedProxyRef.current;
			}

			const trackedKeys = new Set<string>();
			const proxyState = new Proxy(state, {
				get(target, prop, receiver) {
					if (typeof prop === "string") {
						trackedKeys.add(prop);
					}
					return Reflect.get(target, prop, receiver);
				},
			});

			trackedKeysRef.current = trackedKeys;
			trackedStateRef.current = state;
			trackedProxyRef.current = proxyState;

			return proxyState;
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
