import type { IPlaygroundTodo } from "./IPlaygroundTodo";

/**
 * Everything the todo screen can read.
 *
 * Three keys rather than one status enum on purpose: this playground exists to
 * exercise the BINDING's access tracking, and a screen reading `todos` must not
 * re-render because `isLoading` moved.
 */
export interface IPlaygroundTodosState {
	todos: IPlaygroundTodo[];
	error: string | null;
	isLoading: boolean;
}
