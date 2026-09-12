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

// The order application: the same framework under a form, under a cache, and
// under both — the boundary scenes start from these.
export { startOrderPlayground } from "./start-order-playground/startOrderPlayground";
export type { IPlaygroundOrderApp } from "./start-order-playground/startOrderPlayground";
export { createPlaygroundOrderTransport } from "./create-playground-order-transport/createPlaygroundOrderTransport";
export type { IPlaygroundOrderTransport } from "./create-playground-order-transport/createPlaygroundOrderTransport";
export { createPlaygroundForm } from "./_testing/create-playground-form/createPlaygroundForm";
export { applyPlaygroundOutcome } from "./apply-playground-outcome/applyPlaygroundOutcome";
export { playgroundOrderInputSchema } from "./playground-order-input-schema/playgroundOrderInputSchema";
export { playgroundOrderUpdated } from "./playground-order-updated/PlaygroundOrderUpdated";
export { PlaygroundRenameScreen } from "./playground-rename-screen/PlaygroundRenameScreen";
export type { IPlaygroundOrder } from "./_interfaces/IPlaygroundOrder";
export type { IPlaygroundOrderInput } from "./_interfaces/IPlaygroundOrderInput";
export { PlaygroundReadCache } from "./playground-read-cache/PlaygroundReadCache";
export { PlaygroundTanstackReadCache } from "./playground-tanstack-read-cache/PlaygroundTanstackReadCache";
export type { TPlaygroundReadCacheClass } from "./start-order-playground/startOrderPlayground";

// The same seams over the real libraries: three forms, two query hooks.
export { PlaygroundHookFormScreen } from "./playground-hook-form-screen/PlaygroundHookFormScreen";
export { PlaygroundFormikScreen } from "./playground-formik-screen/PlaygroundFormikScreen";
export { PlaygroundTanstackFormScreen } from "./playground-tanstack-form-screen/PlaygroundTanstackFormScreen";
export { PlaygroundReactQueryScreen } from "./playground-react-query-screen/PlaygroundReactQueryScreen";
export { PlaygroundSwrScreen } from "./playground-swr-screen/PlaygroundSwrScreen";
export type { IPlaygroundFormScreenProps } from "./_interfaces/IPlaygroundFormScreenProps";
