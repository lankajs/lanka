import { ALankaStatelessVM } from "../../src/viewmodel/index";
import type { IPlaygroundStatsActions } from "../create-playground-stats-vm/createPlaygroundStatsVM";
import type { IPlaygroundTodo } from "../_interfaces/IPlaygroundTodo";

/**
 * The same stateless ViewModel as `createPlaygroundStatsVM`, written the other
 * way.
 *
 * Not a translation of it: the actions are written as a class-style consumer
 * writes them, and the scene asks both the same questions and expects the same
 * answers. A ViewModel that holds nothing is the case where the two styles come
 * closest — which makes it the one where a divergence would be least visible.
 */
export class PlaygroundStatsVM extends ALankaStatelessVM<IPlaygroundStatsActions> {
	protected readonly name = "PlaygroundStatsVM";

	protected createActions(): IPlaygroundStatsActions {
		return {
			countDone: (todos: readonly IPlaygroundTodo[]) =>
				todos.filter((todo) => todo.done).length,

			// Through `this.get()`, which is what a stateless ViewModel has instead of
			// a store: the actions can reach each other, and the class reaches them the
			// same way the functional context does.
			describe: (todos: readonly IPlaygroundTodo[]) =>
				`${String(this.get().countDone(todos))} of ${String(todos.length)}`,
		};
	}
}
