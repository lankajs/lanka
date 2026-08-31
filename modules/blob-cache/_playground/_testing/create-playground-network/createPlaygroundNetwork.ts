import type { IPlaygroundNetwork } from "../../_interfaces/IPlaygroundNetwork";

/**
 * An empty wire a test fills in.
 *
 * Kept apart from the environment that installs `fetch`, because a test asserts
 * on what was requested far more often than it configures how requests are
 * answered.
 */
export const createPlaygroundNetwork = (): IPlaygroundNetwork => ({
	fetched: [],
	answers: new Map(),
});
