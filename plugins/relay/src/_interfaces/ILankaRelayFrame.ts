/**
 * What one relay posts to a transport: the wire format between REALMS.
 *
 * Not the page's envelope, and not versioned with it. The page's protocol has
 * participants that already shipped — 0.1.0 copies on the same page — and must
 * not move; the medium is a new protocol with none, so it gets its own shape and
 * its own `v`.
 *
 * - `event` — a delivery, repeated to the other realms;
 * - `hello` — an endpoint just joined, and asks what the other realms retain;
 * - `retained` — the answer: one retained value, addressed to the one that asked.
 *
 * ## How it may change
 *
 * Version 1 grows by OPTIONAL fields only. `v` changes only for a shape an old
 * reader would misread, because a reader drops every `v` it does not know — and
 * a tab left open on the previous deploy is a reader nobody can update.
 */
export interface ILankaRelayFrame {
	/** The mark that tells a relay's traffic from anyone else's on a shared medium. */
	readonly lanka: "relay";
	readonly v: number;
	readonly kind: "event" | "hello" | "retained";
	readonly channel: string;
	/** The sending endpoint's id. */
	readonly from: string;
	/**
	 * The sending realm's id. A frame from this realm was delivered by the page
	 * already — even when its sender has left the page since, which is exactly
	 * the window an asynchronous medium opens.
	 */
	readonly realm?: string;
	/**
	 * Counts the sender's frames from 1. A frame at or below the last one heard
	 * from its sender is a copy — a medium that delivered twice, or two media —
	 * and is dropped: at most once, whatever carried it.
	 */
	readonly seq: number;
	/**
	 * The sender's clock when the value was stamped. A receiver moves its own past
	 * it (a Lamport clock), so "newer" means the same thing in every realm without
	 * trusting anyone's wall time.
	 */
	readonly at?: number;
	/** On a `retained` frame: the endpoint whose `hello` it answers. */
	readonly to?: string;
	readonly eventType?: string;
	readonly data?: unknown;
}
