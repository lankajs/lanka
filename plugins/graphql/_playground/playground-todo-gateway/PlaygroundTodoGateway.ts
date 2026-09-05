import { ALankaGraphqlGateway } from "../../src/index";

/** What one row of the board is. */
export interface IPlaygroundTodo {
	id: string;
	title: string;
	done: boolean;
}

const TODOS = `query Todos { todos { id title done } }`;
const COMPLETE = `mutation Complete($id: ID!) { completeTodo(id: $id) { id done } }`;

/**
 * What a consumer writes: one gateway per family of operations.
 *
 * The class style, which is what both applications this framework grew out of
 * chose for every gateway they have. `query` and `mutate` are the same POST on
 * the wire, and the name is the only place a GraphQL call says whether it
 * changes anything.
 */
export class PlaygroundTodoGateway extends ALankaGraphqlGateway {
	public list(): Promise<{ todos: IPlaygroundTodo[] }> {
		return this.query<{ todos: IPlaygroundTodo[] }>({ document: TODOS });
	}

	public complete(id: string): Promise<{ completeTodo: IPlaygroundTodo }> {
		return this.mutate<{ completeTodo: IPlaygroundTodo }>({
			document: COMPLETE,
			variables: { id },
		});
	}
}
