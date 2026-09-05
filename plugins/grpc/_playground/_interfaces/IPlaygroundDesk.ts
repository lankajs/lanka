import type { ILankaInstance } from "lanka";
import type { IPlaygroundGrpcStream } from "../_testing/create-playground-grpc-stream/createPlaygroundGrpcStream";
import type { PlaygroundTodoGateway } from "../playground-todo-gateway/PlaygroundTodoGateway";

/** A started desk, and the questions a test may ask of it. */
export interface IPlaygroundDesk {
	lanka: ILankaInstance;
	/** The gateway a screen calls. */
	todos: PlaygroundTodoGateway;
	/** The server stream, as a test drives it. */
	server: IPlaygroundGrpcStream;
	/**
	 * Opens the stream, as an application does once a session exists.
	 *
	 * Installing the plugin does NOT connect: the plugin has no idea whether
	 * anyone is signed in, and connecting on install would present no credentials.
	 */
	signIn: () => void;
	/** Whether a handler is running because of a stream message right now. */
	isFromOutside: () => boolean;
}
