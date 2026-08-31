import type {
	TLankaSseEventCallback,
	TLankaSseReconnectCallback,
} from "../lanka-sse-transport/LankaSseTransport";

/**
 * A connection that pushes named events, whatever carries them.
 *
 * The port exists because the SECOND transport is a matter of when rather than
 * whether: a proxy that strips `text/event-stream` leaves an application with a
 * WebSocket and nothing else, and long-polling is the same shape again. Both
 * differ from `EventSource` in how bytes arrive and in nothing a bridge can see.
 *
 * What a bridge needs is exactly this: subscribe to a named event, learn that
 * the connection came back, and be told when there is no connection to be had.
 * Everything else — reconnect backoff, envelope parsing, `withCredentials` — is
 * an implementation's own business.
 *
 * The implementations themselves arrive WITH their first consumer. A port with
 * one implementation is a seam; a second implementation nobody asked for is an
 * imagined need costing real support.
 */
export interface ILankaServerEventTransport {
	/** Whether this engine can carry server events at all. */
	isSupported: () => boolean;
	connect: () => void;
	disconnect: () => void;
	/** Subscribes to one named event. Returns the unsubscribe. */
	on: (eventType: string, callback: TLankaSseEventCallback) => () => void;
	/**
	 * Called after a connection is re-established, never on the first one.
	 *
	 * What it is for: everything that happened while the connection was down was
	 * missed, so a screen refetches rather than assuming it is current.
	 */
	onReconnect: (callback: TLankaSseReconnectCallback) => () => void;
}
