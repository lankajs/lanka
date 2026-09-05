import { ALankaStreamTransport, type ILankaStreamTransportHandlers } from "../../src/index";
import type { ILankaWebSocketChannel } from "../../src/index";

/**
 * A channel the APPLICATION wrote, over something that is not a `WebSocket`.
 *
 * The case is ordinary rather than exotic: a React Native application whose
 * socket lives on the native side, an Electron renderer talking over IPC, a
 * desktop shell with its own transport. None of them has a `WebSocket`, all of
 * them push named messages, and every bridge above works unchanged.
 *
 * What the base supplies is everything except `open` and `close`: the listener
 * registry, dispatch, the reconnect ladder and `onReconnect`. Thirty lines is
 * the whole cost of a fifth transport, which is what the abstraction is for.
 */
export class PlaygroundNativeChannel
	extends ALankaStreamTransport
	implements ILankaWebSocketChannel
{
	/** Everything the application sent through the bridge to the native side. */
	public readonly sent: { type: string; payload: Record<string, unknown> }[] = [];
	public opened = 0;
	public closed = 0;

	private wire: ILankaStreamTransportHandlers | null = null;

	public isOpen(): boolean {
		return this.wire !== null;
	}

	public send(eventType: string, payload: Record<string, unknown> = {}): boolean {
		if (!this.isOpen()) return false;

		this.sent.push({ type: eventType, payload });
		return true;
	}

	/** The native side finished attaching. */
	public accept(): void {
		this.wire?.opened();
	}

	/** A message arrives from the native side. */
	public deliver(eventType: string, payload: Record<string, unknown>): void {
		this.wire?.received(eventType, payload);
	}

	/** The native side went away. */
	public drop(): void {
		this.wire?.lost();
	}

	protected open(handlers: ILankaStreamTransportHandlers): void {
		this.opened += 1;
		this.wire = handlers;
	}

	protected close(): void {
		this.closed += 1;
		this.wire = null;
	}
}
