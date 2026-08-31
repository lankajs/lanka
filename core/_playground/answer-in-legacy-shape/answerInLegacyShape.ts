import type { IPlaygroundTodo } from "../_interfaces/IPlaygroundTodo";

/**
 * A server whose shape is not the application's.
 *
 * Snake_case names and a number where the domain has a boolean — every backend
 * is somebody else's decision, and this is the one the mapping scene is about.
 */
export const answerInLegacyShape = (todos: readonly IPlaygroundTodo[]): Promise<Response> =>
	Promise.resolve(
		new Response(
			JSON.stringify(
				todos.map((todo) => ({
					todo_id: todo.id,
					todo_title: todo.title,
					is_done: todo.done ? 1 : 0,
				})),
			),
			{ status: 200, headers: { "content-type": "application/json" } },
		),
	);
