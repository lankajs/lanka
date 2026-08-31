export interface ILankaSseTriggerContext {
	/** Whether a SERVER event handler is running right now. */
	isActive: () => boolean;
	/** Runs a function marked as triggered by a server event. */
	run: <T>(fn: () => T) => T;
}

/**
 * The "this change came from outside" marker.
 *
 * A handler that updates state cannot tell its own change from someone else's:
 * the user pressed a button and then receives the server event about that
 * button. Without the marker the screen notifies the user about their own
 * action, and an optimistic update is rolled back by a "foreign" response that
 * in fact confirms it.
 *
 * ## An instance, not a module variable
 *
 * A module-level flag is one per process: two framework instances (a test beside
 * the app) would share it, and one instance's handler would see a marker set by
 * the other.
 *
 * ## Boundaries
 *
 * The marker is SYNCHRONOUS: it holds for the duration of the call and is
 * cleared in `finally`. An async continuation (an `await` inside the handler)
 * no longer sees it — honestly so: after an `await` control has been anywhere,
 * and claiming "we are still inside a server event" would be untrue.
 */
export const createLankaSseTriggerContext = (): ILankaSseTriggerContext => {
	let active = false;

	return {
		isActive: () => active,
		run<T>(fn: () => T): T {
			// The previous value is saved rather than reset to `false`: otherwise a
			// nested call would clear the outer marker, and the rest of the outer
			// handler would consider itself a user action.
			const previous = active;
			active = true;
			try {
				return fn();
			} finally {
				active = previous;
			}
		},
	};
};
