import type { ILankaWebSocketChannel } from "@lankajs/plugin-websocket";

/**
 * The outbound half of the board, given the channel rather than opening one.
 *
 * A gateway, because it is the layer with I/O — and it takes the channel in its
 * constructor so a test hands it a double and nothing has to open a socket.
 *
 * It does not extend `ALankaGateway`: that base is about HTTP endpoints, and
 * this one has none. The layer is a role, not a class to inherit.
 */
export class AtlasBoardChannel {
	private readonly channel: ILankaWebSocketChannel;

	public constructor(channel: ILankaWebSocketChannel) {
		this.channel = channel;
	}

	/**
	 * Says something on the board, and reports whether it went out NOW.
	 *
	 * A boolean rather than a rejection, because both answers are ordinary:
	 * `false` means the link was down and the message was held for the next
	 * connection. A caller whose message expires branches on it; one that does
	 * not can ignore it.
	 */
	public say(text: string): boolean {
		return this.channel.send("board.say", { text });
	}

	/**
	 * Completes a mission over the socket rather than over HTTP.
	 *
	 * The same intent, a different wire — which is the point of having both in
	 * one application: nothing above this line knows which one carried it.
	 */
	public complete(id: string): boolean {
		return this.channel.send("mission.complete", { id });
	}
}
