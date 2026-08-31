import { markPlaygroundTodoDone } from "../mark-playground-todo-done/markPlaygroundTodoDone";
import { playgroundTodoCompleted } from "../../playground-todo-completed/PlaygroundTodoCompleted";
import type { ILankaScenarioVM } from "../../../src/scenario/index";
import type { ILankaVMContext } from "../../../src/viewmodel/index";
import type { IPlaygroundTodoActions } from "../../_interfaces/IPlaygroundTodoActions";
import type { IPlaygroundTodoGateways } from "../../_interfaces/IPlaygroundTodoGateways";
import type { IPlaygroundTodosState } from "../../_interfaces/IPlaygroundTodosState";

/** What the framework hands an action factory. */
export type TPlaygroundTodoContext = ILankaVMContext<
	IPlaygroundTodosState & IPlaygroundTodoActions & ILankaScenarioVM,
	IPlaygroundTodoGateways,
	Record<string, never>
>;

/**
 * Everything the todo screen can do, in its own file.
 *
 * Actions are where a ViewModel grows, so they are the part that has to be
 * readable on its own. The factory takes the framework's context and nothing
 * else: it never reaches for a gateway, a store or a scenario through a module
 * import — except the scenario it ANNOUNCES, which is a fact about the domain
 * rather than a dependency.
 */
export const createPlaygroundTodoActions = ({
	set,
	get,
	gateways,
	trigger,
}: TPlaygroundTodoContext): IPlaygroundTodoActions => ({
	async load() {
		set({ isLoading: true, error: null });
		try {
			set({ todos: await gateways.todoGateway.list() });
		} finally {
			set({ isLoading: false });
		}
	},

	async loadOne(id) {
		try {
			set({ todos: [await gateways.todoGateway.byId(id)] });
		} catch (error) {
			// The framework's promise: whatever the transport threw arrives as an
			// Error carrying the server's own words, and the screen decides from
			// those alone — never from a status code.
			set({ error: error instanceof Error ? error.message : "unknown" });
		}
	},

	complete(id) {
		set({ todos: markPlaygroundTodoDone(get().todos, id) });
		trigger(playgroundTodoCompleted, { id });
	},
});
