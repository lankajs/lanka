import { createLazyLankaVM } from "../../src/viewmodel/index";
import { createPlaygroundTodoActions } from "../view-models/create-playground-todo-actions/createPlaygroundTodoActions";
import { markPlaygroundTodoDone } from "../view-models/mark-playground-todo-done/markPlaygroundTodoDone";
import { playgroundTodoCompleted } from "../playground-todo-completed/PlaygroundTodoCompleted";
import type { PlaygroundTodoGateway } from "../playground-todo-gateway/PlaygroundTodoGateway";
import type { IPlaygroundTodoActions } from "../_interfaces/IPlaygroundTodoActions";
import type { IPlaygroundTodoGateways } from "../_interfaces/IPlaygroundTodoGateways";
import type { IPlaygroundTodosState } from "../_interfaces/IPlaygroundTodosState";

/**
 * The same ViewModel, built on first use rather than on import.
 *
 * A screen behind a lazy route must not construct its ViewModel — and resolve
 * its gateways, and subscribe its scenarios — while the user is looking at a
 * different screen. The eager form is the default because most ViewModels are
 * cheap; this one exists for the ones that are not.
 */
export const createPlaygroundLazyTodosVM = (todoGateway: PlaygroundTodoGateway) =>
	createLazyLankaVM<IPlaygroundTodosState, IPlaygroundTodoActions, IPlaygroundTodoGateways>({
		name: "PlaygroundLazyTodosVM",
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
