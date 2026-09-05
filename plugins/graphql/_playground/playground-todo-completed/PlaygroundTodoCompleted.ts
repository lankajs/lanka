import { ALankaScenario } from "lanka/scenario";

/**
 * What the rest of the application understands: a todo was completed.
 *
 * The scenario is declared by the APPLICATION, not by this package. A bridge
 * translates a subscription frame into it; nothing above the bridge knows a
 * GraphQL socket exists, which is the whole point of the seam.
 */
export class PlaygroundTodoCompleted extends ALankaScenario<{ id: string }> {
	readonly name = "PlaygroundTodoCompleted";
	readonly eventType = "playground:todo-completed";
	readonly dataTypeName = "IPlaygroundTodoCompleted";
}

/** The single instance the bridge triggers and screens subscribe to. */
export const playgroundTodoCompleted = new PlaygroundTodoCompleted();
