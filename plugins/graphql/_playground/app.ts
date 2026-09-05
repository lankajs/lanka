/**
 * A board that reads over GraphQL and hears about changes over one: the path a
 * test or a reader starts from.
 *
 * The package's job is two seams. An operation's `errors` array becomes a tagged
 * failure the application already knows how to branch on; a subscription frame
 * becomes a scenario the rest of the application already understands, marked as
 * having come from outside. Which operations exist is the application's
 * business.
 */
export { startPlaygroundBoard } from "./start-playground-board/startPlaygroundBoard";
export { PlaygroundTodoGateway } from "./playground-todo-gateway/PlaygroundTodoGateway";
export { createPlaygroundTagGateway } from "./create-playground-tag-gateway/createPlaygroundTagGateway";
export { playgroundTodoCompleted } from "./playground-todo-completed/PlaygroundTodoCompleted";
export { PlaygroundTodoBridge } from "./playground-todo-bridge/PlaygroundTodoBridge";
export { PlaygroundGraphqlSocket } from "./playground-graphql-socket/PlaygroundGraphqlSocket";
export { createPlaygroundGraphqlServer } from "./_testing/create-playground-graphql-server/createPlaygroundGraphqlServer";
export type { IPlaygroundGraphqlAnswer } from "./_testing/create-playground-graphql-server/createPlaygroundGraphqlServer";
export type { IPlaygroundBoard } from "./_interfaces/IPlaygroundBoard";
export type { IPlaygroundTodo } from "./playground-todo-gateway/PlaygroundTodoGateway";
export type { IPlaygroundTag } from "./create-playground-tag-gateway/createPlaygroundTagGateway";
