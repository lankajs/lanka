import type { ILankaServerEventTransport } from "lanka/stream";

/**
 * A two-way named-message channel.
 *
 * `ILankaServerEventTransport` plus the one thing a socket has and a
 * server-sent stream does not. It is a SEPARATE port rather than a widening of
 * that one: the event transport is implemented by consumers, and a member added
 * to it is a compile error in every SSE transport anybody wrote
 * (`skills/surface/SKILL.md` §6b).
 *
 * Everything that only receives keeps taking the narrow port, so a bridge, a
 * screen and the plugin's own teardown are identical on either wire — and a
 * gateway that sends asks for this one and says so in its constructor.
 */
export interface ILankaWebSocketChannel extends ILankaServerEventTransport {
	/**
	 * Sends a named message.
	 *
	 * Answers whether it went out NOW: `false` means it was queued for the next
	 * open connection, or dropped because queueing is off. A caller that must know
	 * — a keystroke, a cursor position, anything whose value expires — branches on
	 * it; a caller that does not can ignore it, which is why this is not a
	 * rejection.
	 */
	send: (eventType: string, payload?: Record<string, unknown>) => boolean;
	/** Whether the socket is open right now. */
	isOpen: () => boolean;
}
