import type { ILankaWebSocketChannel } from "../../src/index";

/**
 * What sends, in an application that receives through bridges.
 *
 * The pattern the package asks for, and the reason it asks: a bridge is inbound
 * only, so the outbound half goes to whatever already owns the action. The
 * channel arrives through the CONSTRUCTOR, which is what lets a test hand over a
 * double and never open a socket.
 *
 * It is a gateway in the framework's sense — the layer a ViewModel calls and
 * nothing above it knows the wire — even though nothing here is an HTTP request.
 */
export class PlaygroundRoomGateway {
	private readonly channel: ILankaWebSocketChannel;

	// A parameter property is a runtime construct, and this repository compiles
	// with `erasableSyntaxOnly`: types may not emit code.
	public constructor(channel: ILankaWebSocketChannel) {
		this.channel = channel;
	}

	/** Says something. `false` means it was held for the next connection. */
	public say(text: string): boolean {
		return this.channel.send("room.say", { text });
	}

	/**
	 * Reports where the cursor is, and does NOT hold it.
	 *
	 * The case the boolean exists for: a position from thirty seconds ago is worse
	 * than no position, so this one is dropped rather than queued — and the caller
	 * can see that it was.
	 */
	public moveCursor(at: number): boolean {
		if (!this.channel.isOpen()) return false;

		return this.channel.send("room.cursor", { at });
	}
}
