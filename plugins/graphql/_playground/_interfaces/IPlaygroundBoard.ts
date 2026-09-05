import type { ILankaInstance } from "lanka";
import type { PlaygroundGraphqlSocket } from "../playground-graphql-socket/PlaygroundGraphqlSocket";
import type { PlaygroundTodoGateway } from "../playground-todo-gateway/PlaygroundTodoGateway";

/** A started board, and the questions a test may ask of it. */
export interface IPlaygroundBoard {
	lanka: ILankaInstance;
	/** The gateway a screen calls. */
	todos: PlaygroundTodoGateway;
	/**
	 * Opens the subscription socket, as an application does once a session exists.
	 *
	 * Installing the plugin does NOT connect: the plugin has no idea whether
	 * anyone is signed in, and connecting on install would present no token.
	 */
	signIn: () => void;
	/** The subscription socket, once one has been opened. */
	connection: () => PlaygroundGraphqlSocket;
	/** Whether any socket exists at all. */
	isConnected: () => boolean;
	/** Whether a handler is running because of a subscription frame right now. */
	isFromOutside: () => boolean;
}
