/**
 * The playground's entry point: one path a test or a reader starts from.
 *
 * It declares nothing. Every part lives in its own file under this folder, in
 * the same shape a real application takes — gateways, scenarios, view models,
 * screens, services published to the locator — because a playground kept in one
 * file stops being an example of how the framework is meant to be used the
 * moment it grows.
 */
export { startPlayground } from "./start-playground/startPlayground";
export { playgroundAmbient } from "./start-playground/startPlayground";
export { playgroundSession } from "./start-playground/startPlayground";
export type { IPlaygroundApp } from "./start-playground/startPlayground";
export { createPlaygroundTodoGateway } from "./create-playground-todo-gateway/createPlaygroundTodoGateway";
export { createPlaygroundTransport } from "./create-playground-transport/createPlaygroundTransport";
export { PlaygroundTodoScreen } from "./playground-todo-screen/PlaygroundTodoScreen";
export { playgroundTodoCompleted } from "./playground-todo-completed/PlaygroundTodoCompleted";
export { PlaygroundSessionService } from "./playground-session-service/PlaygroundSessionService";
export { APlaygroundAuditLog } from "./playground-audit-log/PlaygroundAuditLog";
export { createPlaygroundAuditLog } from "./playground-audit-log/PlaygroundAuditLog";
export { PlaygroundTodoStore } from "./playground-todo-store/PlaygroundTodoStore";
export { PlaygroundBareGateway } from "./playground-bare-gateway/PlaygroundBareGateway";
export { PlaygroundClock } from "./playground-clock/PlaygroundClock";
export type { IPlaygroundClock } from "./playground-clock/PlaygroundClock";
export { PlaygroundBadgeVM } from "./playground-badge-vm/PlaygroundBadgeVM";
export { PlaygroundStatsVM } from "./playground-stats-vm/PlaygroundStatsVM";
export { PlaygroundTodosVM } from "./playground-todos-vm/PlaygroundTodosVM";
export { createPlaygroundTodosVM } from "./view-models/create-playground-todos-vm/createPlaygroundTodosVM";
export { playgroundTodoSchema } from "./playground-todo-schema/playgroundTodoSchema";
export type { IPlaygroundTodo } from "./_interfaces/IPlaygroundTodo";
