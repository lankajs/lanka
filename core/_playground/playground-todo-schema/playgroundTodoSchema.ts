import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { IPlaygroundTodo } from "../_interfaces/IPlaygroundTodo";

/**
 * The server's answer, described by hand.
 *
 * Written without zod or valibot on purpose: the framework validates through
 * Standard Schema, so a schema is anything carrying `~standard`. That is what
 * makes `@lankajs/zod` and `@lankajs/valibot` interchangeable rather than blessed,
 * and it is only visible when something implements the protocol directly.
 */
export const playgroundTodoSchema: StandardSchemaV1<unknown, IPlaygroundTodo[]> = {
	"~standard": {
		version: 1,
		vendor: "playground",
		validate: (value) => {
			if (!Array.isArray(value)) {
				return { issues: [{ message: "expected a list", path: [] }] };
			}

			const wrong = value.findIndex(
				(item: unknown) =>
					typeof item !== "object" ||
					item === null ||
					typeof (item as IPlaygroundTodo).title !== "string",
			);

			return wrong === -1
				? { value: value as IPlaygroundTodo[] }
				: { issues: [{ message: "not a todo", path: [wrong, "title"] }] };
		},
	},
};
