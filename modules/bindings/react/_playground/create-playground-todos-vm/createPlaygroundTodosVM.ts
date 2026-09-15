import { createLankaVM } from "lanka/viewmodel";
import type { IPlaygroundTodo } from "../_interfaces/IPlaygroundTodo";
import type { IPlaygroundTodoActions } from "../_interfaces/IPlaygroundTodoActions";
import type { IPlaygroundTodosState } from "../_interfaces/IPlaygroundTodosState";

/**
 * The list this playground renders, with no gateway under it.
 *
 * A binding's playground is about the BINDING: what a screen reads, when it
 * re-renders, and what it does not re-render for. A transport here would add a
 * second subject and prove nothing extra — core's playground already drives the
 * whole chain, framework-free.
 *
 * `touchUnread` exists to be called and NOT seen: it moves a key no screen
 * reads, which is the scene that says access tracking is doing something.
 */
export const createPlaygroundTodosVM = (rows: () => IPlaygroundTodo[], tracked = true) =>
	createLankaVM<IPlaygroundTodosState & { unread: number }, IPlaygroundTodoActions>({
		name: "PlaygroundTodosVM",
		enableAccessTrackingOptimization: tracked,
		states: { todos: [], error: null, isLoading: false, unread: 0 },
		createActions: ({ set, get }) => ({
			load: async () => {
				set({ isLoading: true });
				await Promise.resolve();
				set({ todos: rows(), isLoading: false });
			},
			fail: (message) => {
				set({ error: message });
			},
			complete: (id) => {
				set({
					todos: get().todos.map((todo) =>
						todo.id === id ? { ...todo, done: true } : todo,
					),
				});
			},
			touchUnread: () => {
				set({ unread: get().unread + 1 });
			},
		}),
	});
