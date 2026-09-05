import { ALankaStreamBridge } from "../../src/index";
import { playgroundTodoCompleted } from "../playground-todo-completed/PlaygroundTodoCompleted";

/**
 * What a consumer writes: one bridge per family of stream events.
 *
 * It is the same class a server-sent stream or a socket would use, and it says
 * nothing about gRPC. Which named event a stream message is was decided by
 * `eventTypeOf` one layer down; from here it is an ordinary named event.
 */
export class PlaygroundTodoBridge extends ALankaStreamBridge {
	public register(): void {
		this.on("todo.completed", (payload) => {
			playgroundTodoCompleted.trigger({ id: String(payload.id) });
		});
	}
}
