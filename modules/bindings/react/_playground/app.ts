/**
 * The miniature application this package is exercised through.
 *
 * Small on purpose. Core's playground drives the whole chain — a transport, a
 * gateway, scenarios, validation — and does it without a framework. What is
 * left for a BINDING to prove is what only a renderer can show: that a screen
 * reads a ViewModel, that it re-renders for the keys it read and not for the
 * others, and that a form library can sit on top of the same ViewModel.
 *
 * So there is no server here and no gateway. A second copy of that chain would
 * be a second subject, and the scenes that need it already exist next door.
 */

export { createPlaygroundOrderEditVM } from "./create-playground-order-edit-vm/createPlaygroundOrderEditVM";
export type { IPlaygroundOrderServer } from "./_interfaces/IPlaygroundOrderServer";

export { PlaygroundTodoScreen } from "./playground-todo-screen/PlaygroundTodoScreen";
export { PlaygroundCallableTodoScreen } from "./playground-callable-todo-screen/PlaygroundCallableTodoScreen";
export { PlaygroundRenameScreen } from "./playground-rename-screen/PlaygroundRenameScreen";
export { PlaygroundHookFormScreen } from "./playground-hook-form-screen/PlaygroundHookFormScreen";
export { PlaygroundFormikScreen } from "./playground-formik-screen/PlaygroundFormikScreen";
export { PlaygroundTanstackFormScreen } from "./playground-tanstack-form-screen/PlaygroundTanstackFormScreen";

export { playgroundOrderInputSchema } from "./playground-order-input-schema/playgroundOrderInputSchema";

export type { IPlaygroundTodo } from "./_interfaces/IPlaygroundTodo";
export type { IPlaygroundTodosState } from "./_interfaces/IPlaygroundTodosState";
export type { IPlaygroundTodoActions } from "./_interfaces/IPlaygroundTodoActions";
export type { IPlaygroundOrder, IPlaygroundOrderItem } from "./_interfaces/IPlaygroundOrder";
export type { IPlaygroundOrderInput } from "./_interfaces/IPlaygroundOrderInput";
export type { IPlaygroundFormScreenProps } from "./_interfaces/IPlaygroundFormScreenProps";
