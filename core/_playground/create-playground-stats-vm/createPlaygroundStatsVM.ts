import { createStatelessLankaVM } from "../../src/viewmodel/index";
import type { IPlaygroundTodo } from "../_interfaces/IPlaygroundTodo";

/** Questions about a list, answered without holding one. */
export interface IPlaygroundStatsActions {
	countDone: (todos: readonly IPlaygroundTodo[]) => number;
	describe: (todos: readonly IPlaygroundTodo[]) => string;
}

/**
 * A ViewModel with no state at all.
 *
 * The shape exists because half the ViewModels an application writes hold
 * nothing: they answer questions about data somebody else owns. Giving them an
 * empty store would make every consumer of them re-render on changes to a state
 * that cannot change.
 */
export const createPlaygroundStatsVM = () =>
	createStatelessLankaVM<IPlaygroundStatsActions>({
		name: "PlaygroundStatsVM",
		createActions: () => ({
			countDone: (todos) => todos.filter((todo) => todo.done).length,
			describe: (todos) =>
				`${String(todos.filter((t) => t.done).length)} of ${String(todos.length)}`,
		}),
	});
