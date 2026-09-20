import type { IPlaygroundTodo } from "./IPlaygroundTodo";

/**
 * Everything the todo screen can read.
 *
 * Separate keys rather than one status enum on purpose: this playground exists
 * to exercise the BINDING's access tracking, and a screen reading `todos` must
 * not re-render because `isLoading` moved.
 *
 * `unread` is the key NO screen reads. Access tracking is only observable
 * against one — a state whose every key is on screen can never show a skip — so
 * it is here to be moved while nothing re-renders.
 */
export interface IPlaygroundTodosState {
	todos: IPlaygroundTodo[];
	error: string | null;
	isLoading: boolean;
	unread: number;
}
