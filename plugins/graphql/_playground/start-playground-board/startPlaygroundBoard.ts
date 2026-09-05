import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { createLankaGraphqlRequest, lankaGraphql } from "../../src/index";
import { PlaygroundGraphqlSocket } from "../playground-graphql-socket/PlaygroundGraphqlSocket";
import { PlaygroundTodoBridge } from "../playground-todo-bridge/PlaygroundTodoBridge";
import { PlaygroundTodoGateway } from "../playground-todo-gateway/PlaygroundTodoGateway";
import {
	createPlaygroundGraphqlServer,
	type IPlaygroundGraphqlAnswer,
} from "../_testing/create-playground-graphql-server/createPlaygroundGraphqlServer";
import type { IPlaygroundBoard } from "../_interfaces/IPlaygroundBoard";

const TODO_COMPLETED = `subscription { todoCompleted { id } }`;

/** Starts a board that reads over GraphQL and hears about changes over one. */
export const startPlaygroundBoard = (
	answers: readonly IPlaygroundGraphqlAnswer[] = [{ body: { data: { todos: [] } } }],
): IPlaygroundBoard => {
	PlaygroundGraphqlSocket.instances = [];

	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();

	const server = createPlaygroundGraphqlServer(answers);
	const todos = new PlaygroundTodoGateway({
		request: createLankaGraphqlRequest({ transport: server.transport }),
	});

	let isActive: () => boolean = () => false;

	const graphql = lankaGraphql({
		operations: { "todo.completed": { document: TODO_COMPLETED } },
		openSocket: (url, events) => new PlaygroundGraphqlSocket(url, events),
		bridges: ({ subscriptions, trigger }) => {
			isActive = trigger.isActive;
			return [new PlaygroundTodoBridge(subscriptions, trigger)];
		},
	});

	lanka.use(graphql);

	return {
		lanka,
		todos,
		signIn: () => graphql.subscriptions.connect(),
		isConnected: () => PlaygroundGraphqlSocket.instances.length > 0,
		connection() {
			const socket = PlaygroundGraphqlSocket.instances.at(-1);
			if (!socket) throw new Error("the plugin opened no connection");
			return socket;
		},
		isFromOutside: () => isActive(),
	};
};
