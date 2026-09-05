/**
 * A desk that calls over gRPC-Web and watches a server stream: the path a test
 * or a reader starts from.
 *
 * The package's job is two seams. A `grpc-status` becomes a failure the
 * application already knows how to branch on, with the framing and the trailers
 * read on the way; a stream message becomes a scenario the rest of the
 * application already understands, marked as having come from outside. Which
 * RPCs exist, and how their messages are encoded, is the application's business.
 */
export { startPlaygroundDesk } from "./start-playground-desk/startPlaygroundDesk";
export { PlaygroundTodoGateway } from "./playground-todo-gateway/PlaygroundTodoGateway";
export { createPlaygroundTagGateway } from "./create-playground-tag-gateway/createPlaygroundTagGateway";
export { playgroundTodoCompleted } from "./playground-todo-completed/PlaygroundTodoCompleted";
export { PlaygroundTodoBridge } from "./playground-todo-bridge/PlaygroundTodoBridge";
export { createPlaygroundGrpcServer } from "./_testing/create-playground-grpc-server/createPlaygroundGrpcServer";
export { createPlaygroundGrpcStream } from "./_testing/create-playground-grpc-stream/createPlaygroundGrpcStream";
export type { IPlaygroundGrpcAnswer } from "./_testing/create-playground-grpc-server/createPlaygroundGrpcServer";
export type { IPlaygroundGrpcStream } from "./_testing/create-playground-grpc-stream/createPlaygroundGrpcStream";
export type { IPlaygroundDesk } from "./_interfaces/IPlaygroundDesk";
export type { IPlaygroundTodo } from "./playground-todo-gateway/PlaygroundTodoGateway";
export type { IPlaygroundTag } from "./create-playground-tag-gateway/createPlaygroundTagGateway";
