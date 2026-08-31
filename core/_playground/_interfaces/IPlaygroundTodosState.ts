import type { IPlaygroundTodo } from "./IPlaygroundTodo";

/**
 * Everything the todo screen can read.
 *
 * Three keys rather than one status enum on purpose: the playground exists to
 * exercise access tracking, and a screen that reads `todos` must not re-render
 * because `isLoading` moved.
 */
export interface IPlaygroundTodosState {
	todos: IPlaygroundTodo[];
	error: string | null;
	isLoading: boolean;
}
