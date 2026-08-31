import type { IPlaygroundTodo } from "../../_interfaces/IPlaygroundTodo";

/**
 * The list with one todo completed.
 *
 * Extracted because it happens TWICE for two different reasons: this screen
 * completed a todo, and a scenario said another screen did. Those are separate
 * events that must produce identical state — writing the transition twice is how
 * they stop being identical.
 */
export const markPlaygroundTodoDone = (todos: IPlaygroundTodo[], id: number): IPlaygroundTodo[] =>
	todos.map((todo) => (todo.id === id ? { ...todo, done: true } : todo));
