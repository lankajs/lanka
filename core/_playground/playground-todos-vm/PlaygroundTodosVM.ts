import { ALankaVM } from "../../src/viewmodel/index";
import { markPlaygroundTodoDone } from "../view-models/mark-playground-todo-done/markPlaygroundTodoDone";
import { playgroundTodoCompleted } from "../playground-todo-completed/PlaygroundTodoCompleted";
import type { PlaygroundTodoGateway } from "../playground-todo-gateway/PlaygroundTodoGateway";
import type { TUnknownLankaScenarioBinding } from "../../src/viewmodel/index";
import type { IPlaygroundTodoActions } from "../_interfaces/IPlaygroundTodoActions";
import type { IPlaygroundTodoGateways } from "../_interfaces/IPlaygroundTodoGateways";
import type { IPlaygroundTodosState } from "../_interfaces/IPlaygroundTodosState";

/**
 * The same ViewModel as `createPlaygroundTodosVM`, written the other way.
 *
 * Not a translation of it: the actions here are written against `this.set` and
 * `this.gateways` as a class-style consumer would write them, and the scene
 * drives both through the same steps and asserts the same results. That is what
 * makes "both styles, one implementation" a test rather than a claim — a
 * behaviour that reached only one style fails here.
 */
export class PlaygroundTodosVM extends ALankaVM<
	IPlaygroundTodosState,
	IPlaygroundTodoActions,
	IPlaygroundTodoGateways
> {
	protected readonly name = "PlaygroundTodosVM";

	private readonly todoGateway: PlaygroundTodoGateway;

	public constructor(todoGateway: PlaygroundTodoGateway) {
		super();
		this.todoGateway = todoGateway;
	}

	protected override states(): IPlaygroundTodosState {
		return { todos: [], error: null, isLoading: false };
	}

	protected override createGateways(): IPlaygroundTodoGateways {
		return { todoGateway: this.todoGateway };
	}

	/**
	 * The same binding the functional style declares, reached through `this`.
	 *
	 * A handler is still handed the context — the binding type is shared, and a
	 * class-style consumer simply ignores it, which is the one place the two
	 * idioms show through the seam.
	 */
	protected override scenarioHandlers(): TUnknownLankaScenarioBinding<
		IPlaygroundTodosState & IPlaygroundTodoActions,
		IPlaygroundTodoGateways,
		Record<string, never>
	>[] {
		return [
			{
				scenario: playgroundTodoCompleted,
				handler: () => (data?: unknown) => {
					const completed = data as { id: number } | undefined;
					if (!completed) return;

					this.set({ todos: markPlaygroundTodoDone(this.get().todos, completed.id) });
				},
			},
		];
	}

	protected createActions(): IPlaygroundTodoActions {
		return {
			load: async () => {
				this.set({ isLoading: true, error: null });
				try {
					this.set({ todos: await this.gateways.todoGateway.list() });
				} finally {
					this.set({ isLoading: false });
				}
			},

			loadOne: async (id) => {
				try {
					this.set({ todos: [await this.gateways.todoGateway.byId(id)] });
				} catch (error) {
					this.set({ error: error instanceof Error ? error.message : "unknown" });
				}
			},

			complete: (id) => {
				this.set({ todos: markPlaygroundTodoDone(this.get().todos, id) });
				this.trigger(playgroundTodoCompleted, { id });
			},
		};
	}
}
