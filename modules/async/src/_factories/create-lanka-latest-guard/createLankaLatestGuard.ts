/**
 * Request versioning: a late response learns it lost and does not write to
 * state.
 *
 * ## Why
 *
 * A burst of events produces several reads of the same thing, and nothing
 * guarantees the order of their responses. Without a version the screen can end
 * up showing the FIRST response, which arrived last — the state before the
 * change those events announced.
 *
 * ## What the guard does NOT do
 *
 * It does not reduce the number of requests. It makes a burst CORRECT while
 * every event still goes to the network and all responses but one are discarded.
 * Cost is `createLankaBurstCoalescer`'s job: different work, complementary
 * rather than interchangeable.
 */
export type TLankaLatestToken = number;

export interface ILankaLatestGuard {
	/** Starts a request and issues its token. Every earlier token stops being current. */
	start: () => TLankaLatestToken;
	/** Invalidates everything in flight: what just arrived is fresher. */
	invalidate: () => void;
	/** Whether this response may write to state. */
	isCurrent: (token: TLankaLatestToken) => boolean;
}

export const createLankaLatestGuard = (): ILankaLatestGuard => {
	let version = 0;

	return {
		start: () => {
			version += 1;
			return version;
		},

		invalidate: () => {
			version += 1;
		},

		isCurrent: (token) => token === version,
	};
};
