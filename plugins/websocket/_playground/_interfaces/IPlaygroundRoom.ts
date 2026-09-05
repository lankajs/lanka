import type { ILankaInstance } from "lanka";
import type { PlaygroundRoomGateway } from "../playground-room-gateway/PlaygroundRoomGateway";
import type { PlaygroundWebSocket } from "../playground-web-socket/PlaygroundWebSocket";

/** A started chat room, and the questions a test may ask of it. */
export interface IPlaygroundRoom {
	lanka: ILankaInstance;
	/** The layer that sends. A screen calls this, never the channel. */
	gateway: PlaygroundRoomGateway;
	/**
	 * Opens the socket, as an application does once a session exists.
	 *
	 * Installing the plugin does NOT connect: the plugin has no idea whether
	 * anyone is signed in, and connecting on install would open a socket from the
	 * sign-in screen.
	 */
	signIn: () => void;
	/** The socket, once one has been opened. */
	connection: () => PlaygroundWebSocket;
	/** Whether any socket exists at all. */
	isConnected: () => boolean;
	/** Says something in the room. `false` means it was held for the next connection. */
	say: (text: string) => boolean;
	/** Reports the cursor. Never held: a stale position is worse than none. */
	moveCursor: (at: number) => boolean;
	/** Whether a handler is running because of a server message right now. */
	isFromOutside: () => boolean;
}
