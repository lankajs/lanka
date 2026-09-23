/**
 * A medium between REALMS — tabs, iframes, workers — that a relay posts to and
 * hears from.
 *
 * The page needs none: applications on one page meet through the global object,
 * synchronously, and always will. A transport is for the applications that are
 * not on the page — another tab, a worker, an iframe — and it is ADDED to the
 * page, never put in its place: a relay with a transport still hears and is heard
 * by every application on its own page.
 *
 * Two members, because this is implemented by an application — over
 * `postMessage` with the origin policy it decides, over a `MessagePort`, over
 * whatever its host gives it. `createLankaRelayBroadcastChannelTransport` is the one
 * this package ships.
 *
 * What an implementation must do:
 *
 * - **Reach everyone.** A post reaches every OTHER endpoint on the medium: the
 *   relay never forwards, so a medium that delivers to one neighbour delivers to
 *   one neighbour.
 * - **Keep one sender's order.** Two posts from one sender arrive in the order
 *   they were posted. `BroadcastChannel` and `MessagePort` both promise this.
 * - **Take several subscribers.** One transport may be handed to two relays —
 *   two channels — and each subscriber hears every message until ITS OWN stop
 *   is called. `port.onmessage = onMessage` is the implementation that fails
 *   this: the second relay replaces the first.
 * - **Accept a post as soon as `subscribe` returns.** A relay subscribes and
 *   says hello in one step; a medium still opening — a socket, an iframe not yet
 *   loaded — buffers until it can deliver. A hello lost there is a late-joining
 *   application that never hears another realm's retained value.
 * - **Handle its own asynchrony.** `post` returns nothing the relay reads: an
 *   implementation that sends asynchronously catches its own rejections.
 *
 * What it may do: deliver asynchronously, and hand a sender its own post back —
 * the relay drops a message carrying its own id. Messages are structured-clone
 * values; a post that throws (`DataCloneError`) is caught and logged by the
 * relay, and the local delivery it came from still happens.
 */
export interface ILankaRelayTransport {
	/** Hands one message to the medium, for every other endpoint on it. */
	post: (message: unknown) => void;
	/** Starts hearing the medium. Returns the call that stops THIS subscriber. */
	subscribe: (onMessage: (message: unknown) => void) => () => void;
}
