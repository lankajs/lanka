import { ALankaScenario } from "../../src/scenario/index";

/**
 * The one cross-screen fact of this application: a todo was completed.
 *
 * A scenario is declared once and triggered wherever the change happens.
 * Whoever cares subscribes; nobody imports the other screen. That is the reason
 * the layer exists, and the reason this names a FACT rather than an action —
 * "todo completed", not "complete todo".
 */
export class PlaygroundTodoCompleted extends ALankaScenario<{ id: number }> {
	readonly name = "PlaygroundTodoCompleted";
	readonly eventType = "playground:todo-completed";
	readonly dataTypeName = "IPlaygroundTodoCompleted";
}

/**
 * The single instance every screen triggers and subscribes to.
 *
 * Beside its class rather than in a file of its own: a second instance would be
 * a second event nobody listens to, which is silence rather than an error, and
 * the two names differ only in their first letter — a case-insensitive
 * filesystem cannot hold both files.
 */
export const playgroundTodoCompleted = new PlaygroundTodoCompleted();
