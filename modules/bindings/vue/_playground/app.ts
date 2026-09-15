/**
 * The miniature application this package is exercised through.
 *
 * The same shapes `@lankajs/react`'s playground uses, because they are the same
 * application: what differs between the two playgrounds is the view layer, and
 * that difference is exactly what a reader should be able to see side by side.
 *
 * Small on purpose. Core's playground drives the whole chain framework-free;
 * what is left for a BINDING to prove is what only a renderer can show.
 */

export { createPlaygroundTodosVM } from "./create-playground-todos-vm/createPlaygroundTodosVM";
export { createPlaygroundRenameVM } from "./create-playground-rename-vm/createPlaygroundRenameVM";
export { PlaygroundTodoScreen } from "./playground-todo-screen/PlaygroundTodoScreen";
export { PlaygroundRenameScreen } from "./playground-rename-screen/PlaygroundRenameScreen";

export type { IPlaygroundTodo } from "./_interfaces/IPlaygroundTodo";
