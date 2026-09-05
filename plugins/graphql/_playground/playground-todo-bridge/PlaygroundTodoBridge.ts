import { ALankaStreamBridge } from "../../src/index";
import { playgroundTodoCompleted } from "../playground-todo-completed/PlaygroundTodoCompleted";

/**
 * What a consumer writes: one bridge per family of subscription events.
 *
 * It is the same class a server-sent stream or a socket would use, and it says
 * nothing about GraphQL. What arrives is the subscription's `data` object, and
 * the bridge names the field it wanted out of it.
 */
export class PlaygroundTodoBridge extends ALankaStreamBridge {
	public register(): void {
		this.on("todo.completed", (payload) => {
			const completed = payload.todoCompleted as { id: string } | undefined;
			if (completed) playgroundTodoCompleted.trigger(completed);
		});
	}
}
