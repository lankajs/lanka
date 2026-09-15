import { createLankaVM } from "lanka/viewmodel";

/** The state a fake ViewModel holds: one key a reader watches, one it does not. */
export interface ILankaFakeVMState {
	/** The list a reader is expected to read. */
	rows: readonly string[];
	/** A second key a reader may or may not read — the other half of every tracking scene. */
	isLoading: boolean;
	/** A key nothing reads, moved to prove a change can be skipped. */
	unread: number;
	/** Whatever the fake was told to fail with. */
	error: string | null;
	[key: string]: unknown;
}

/** What a fake ViewModel can be told to do. */
export interface ILankaFakeVMActions {
	/** Replaces `rows` with what the fake was built with. */
	load: () => Promise<void>;
	/** Writes `error`. */
	fail: (message: string) => void;
	/** Moves `unread`, which no reader is expected to have read. */
	touchUnread: () => void;
}

export interface ILankaFakeVMOptions {
	/** What `load` answers. Empty by default. */
	rows?: readonly string[];
	/** Whether the ViewModel asks a reader to track access. True by default. */
	tracked?: boolean;
}

/**
 * A real ViewModel with no gateway under it — the one every binding's playground
 * reads.
 *
 * ## Why this is in the kit
 *
 * Four bindings each need a ViewModel to render, and each needs the SAME one:
 * the claims their playgrounds make are deliberately identical, so that reading
 * two of them side by side shows only each framework's own syntax. Four copies
 * of the ViewModel would diverge, and then the playgrounds would be comparing
 * different things while looking as though they were not.
 *
 * A member of a shelf may not depend on a sibling, so the kit is the one place
 * all four already look.
 *
 * ## Why it is REAL and not a stub
 *
 * It is `createLankaVM`, not an object shaped like one. What a binding's
 * playground proves is the binding against the framework's actual ViewModel —
 * its store, its tracking flag, its scenario registration. A hand-shaped double
 * would let a binding pass against something no application has.
 *
 * `unread` exists to be moved and NOT seen: a reader that never looked at it
 * must not re-render when it changes, and that scene is the whole of access
 * tracking in one assertion.
 */
export const createLankaFakeVM = (options: ILankaFakeVMOptions = {}) => {
	const rows = options.rows ?? [];

	return createLankaVM<ILankaFakeVMState, ILankaFakeVMActions>({
		name: "LankaFakeVM",
		enableAccessTrackingOptimization: options.tracked ?? true,
		states: { rows: [], unread: 0, error: null, isLoading: false },
		createActions: ({ set, get }) => ({
			load: async () => {
				set({ isLoading: true });
				await Promise.resolve();
				set({ rows, isLoading: false });
			},
			fail: (message) => {
				set({ error: message });
			},
			touchUnread: () => {
				set({ unread: get().unread + 1 });
			},
		}),
	});
};
