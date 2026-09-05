import type { TLankaStreamEventCallback } from "../_types/TLankaStreamEventCallback";
import type { TLankaStreamReconnectCallback } from "../_types/TLankaStreamReconnectCallback";

/**
 * A connection that pushes named events, whatever carries them.
 *
 * The port is the whole reason a screen can stop caring which protocol it is
 * on. `text/event-stream`, a WebSocket, a `graphql-ws` subscription and a gRPC
 * server stream differ in how bytes arrive and in nothing a bridge can see —
 * and the choice between them is made by a proxy, a load balancer or a backend
 * team, none of which the application controls.
 *
 * What a bridge needs is exactly this: subscribe to a named event, learn that
 * the connection came back, and be told whether there is a connection to be had
 * at all. Everything else — reconnect backoff, envelope parsing, credentials,
 * a handshake — is an implementation's own business, and `ALankaStreamTransport`
 * is where the parts that are the same for all of them live.
 *
 * ## Kept minimal on purpose
 *
 * A CONSUMER implements this — a native bridge, a mock, a socket the
 * application already had — so every member added later is a compile error in
 * code nobody touched (`skills/surface/SKILL.md` §6b). Five members is not
 * meanness; it is the only form the promise survives in.
 */
export interface ILankaServerEventTransport {
	/** Whether this engine can carry server events at all. */
	isSupported: () => boolean;
	connect: () => void;
	disconnect: () => void;
	/** Subscribes to one named event. Returns the unsubscribe. */
	on: (eventType: string, callback: TLankaStreamEventCallback) => () => void;
	/**
	 * Called after a connection is re-established, never on the first one.
	 *
	 * What it is for: everything that happened while the connection was down was
	 * missed, so a screen refetches rather than assuming it is current.
	 */
	onReconnect: (callback: TLankaStreamReconnectCallback) => () => void;
}
