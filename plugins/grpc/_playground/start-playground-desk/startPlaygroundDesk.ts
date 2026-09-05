import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import {
	createLankaGrpcJsonCodec,
	createLankaGrpcRequest,
	createLankaGrpcStreamTransport,
	lankaGrpc,
} from "../../src/index";
import { PlaygroundTodoBridge } from "../playground-todo-bridge/PlaygroundTodoBridge";
import { PlaygroundTodoGateway } from "../playground-todo-gateway/PlaygroundTodoGateway";
import { createPlaygroundGrpcStream } from "../_testing/create-playground-grpc-stream/createPlaygroundGrpcStream";
import {
	createPlaygroundGrpcServer,
	type IPlaygroundGrpcAnswer,
} from "../_testing/create-playground-grpc-server/createPlaygroundGrpcServer";
import type { IPlaygroundDesk } from "../_interfaces/IPlaygroundDesk";

/** What the watch stream carries: a change, and what kind of change it is. */
interface IPlaygroundChange {
	kind: string;
	id: string;
}

/** Starts a desk that calls over gRPC and watches a server stream for changes. */
export const startPlaygroundDesk = (
	answers: readonly IPlaygroundGrpcAnswer[] = [{ message: { todos: [] } }],
): IPlaygroundDesk => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();

	const unary = createPlaygroundGrpcServer(answers);
	const todos = new PlaygroundTodoGateway({
		request: createLankaGrpcRequest({ transport: unary.transport }),
	});

	const server = createPlaygroundGrpcStream();
	const stream = createLankaGrpcStreamTransport<{ since: number }, IPlaygroundChange>({
		path: "/playground.Todos/Watch",
		request: { since: 0 },
		codec: createLankaGrpcJsonCodec<{ since: number }, IPlaygroundChange>(),
		// One call, many kinds of thing: the application says which named event a
		// message is, because it is the only layer that knows the message's shape.
		eventTypeOf: (change) => (change.kind === "completed" ? "todo.completed" : null),
		payloadOf: (change) => ({ id: change.id }),
		openStream: server.open,
	});

	let isActive: () => boolean = () => false;

	const grpc = lankaGrpc({
		transport: stream,
		bridges: ({ stream: transport, trigger }) => {
			isActive = trigger.isActive;
			return [new PlaygroundTodoBridge(transport, trigger)];
		},
	});

	lanka.use(grpc);

	return {
		lanka,
		todos,
		server,
		signIn: () => grpc.stream.connect(),
		isFromOutside: () => isActive(),
	};
};
