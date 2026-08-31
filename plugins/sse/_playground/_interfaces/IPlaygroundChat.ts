import type { ILankaInstance } from "lanka";
import type { PlaygroundEventSource } from "../playground-event-source/PlaygroundEventSource";

/** A started chat application, and the questions a test may ask of it. */
export interface IPlaygroundChat {
	lanka: ILankaInstance;
	/**
	 * Opens the stream, as an application does once a session exists.
	 *
	 * Installing the plugin does NOT connect: the plugin has no idea whether
	 * anyone is signed in, and connecting on install would open a stream from
	 * the sign-in screen.
	 */
	signIn: () => void;
	/** The connection, once one has been opened. */
	connection: () => PlaygroundEventSource;
	/** Whether any connection exists at all. */
	isConnected: () => boolean;
	/** Whether a handler is running because of a server event right now. */
	isFromOutside: () => boolean;
}
