/**
 * A place to keep the release of a subscription opened in one hook and closed
 * in another. Held in the factory's closure, never in the store: a function is
 * not state a screen reads.
 */
export interface IPlaygroundSubscription {
	release: (() => void) | null;
}
