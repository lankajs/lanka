import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { IPlaygroundTodo } from "../_interfaces/IPlaygroundTodo";

/** What the server actually sends, before anything here has a say. */
interface IPlaygroundTodoApiShape {
	todo_id: number;
	todo_title: string;
	is_done: 0 | 1;
}

const isApiShape = (value: unknown): value is IPlaygroundTodoApiShape =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as IPlaygroundTodoApiShape).todo_id === "number" &&
	typeof (value as IPlaygroundTodoApiShape).todo_title === "string";

/**
 * The server's shape, mapped to the application's.
 *
 * The mapping travels IN THE SCHEMA, which is the whole reason the framework
 * needs no adapter layer: Standard Schema's `validate` returns the transformed
 * value, so one call both reads the wire and produces a domain object.
 *
 * Two schemas rather than one on purpose. This one is about the SERVER and
 * changes when the server changes; `playgroundTodoSchema` is about the
 * application and changes when the application does. Folding them together
 * would make every rename on either side an edit to the other.
 */
export const playgroundTodoApiSchema: StandardSchemaV1<unknown, IPlaygroundTodo[]> = {
	"~standard": {
		version: 1,
		vendor: "playground",
		validate: (value) => {
			if (!Array.isArray(value)) {
				return { issues: [{ message: "expected a list", path: [] }] };
			}

			const wrong = value.findIndex((item: unknown) => !isApiShape(item));
			if (wrong !== -1) {
				return { issues: [{ message: "not a server todo", path: [wrong, "todo_id"] }] };
			}

			return {
				value: (value as IPlaygroundTodoApiShape[]).map((item) => ({
					id: item.todo_id,
					title: item.todo_title,
					done: item.is_done === 1,
				})),
			};
		},
	},
};
