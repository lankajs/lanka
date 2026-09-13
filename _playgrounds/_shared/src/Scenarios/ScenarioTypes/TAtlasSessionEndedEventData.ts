/**
 * Why the session ended.
 *
 * The two reasons need different interfaces — one was the person's decision and
 * the other was not — so the fact carries which, rather than leaving every
 * subscriber to guess from what else is true.
 */
export interface TAtlasSessionEndedEventData {
	reason: "signed-out" | "expired";
}
