import { createLankaVM } from "../../../src/viewmodel/index";
import { createPlaygroundTodoActions } from "../create-playground-todo-actions/createPlaygroundTodoActions";
import { markPlaygroundTodoDone } from "../mark-playground-todo-done/markPlaygroundTodoDone";
import { playgroundTodoCompleted } from "../../playground-todo-completed/PlaygroundTodoCompleted";
import type { PlaygroundTodoGateway } from "../../playground-todo-gateway/PlaygroundTodoGateway";
import type { IPlaygroundTodoActions } from "../../_interfaces/IPlaygroundTodoActions";
import type { IPlaygroundTodoGateways } from "../../_interfaces/IPlaygroundTodoGateways";
import type { IPlaygroundTodosState } from "../../_interfaces/IPlaygroundTodosState";

/**
 * The application's one ViewModel: state, actions, and what it listens to.
 *
 * It reads as a DECLARATION because the behaviour lives beside it — the actions
 * in their own file, the state transition in its own function. What is left here
 * is the wiring, which is the part a reader comes to this file for.
 */
export const createPlaygroundTodosVM = (todoGateway: PlaygroundTodoGateway) =>
	createLankaVM<IPlaygroundTodosState, IPlaygroundTodoActions, IPlaygroundTodoGateways>({
		name: "PlaygroundTodosVM",
		gateways: () => ({ todoGateway }),
		states: { todos: [], error: null, isLoading: false },
		createActions: createPlaygroundTodoActions,

		scenarioHandlers: [
			{
				scenario: playgroundTodoCompleted,
				handler:
					({ set, get }) =>
					(data?: { id: number }) => {
						if (!data) return;
						set({ todos: markPlaygroundTodoDone(get().todos, data.id) });
					},
			},
		],
	});
