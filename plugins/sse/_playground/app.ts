/**
 * A chat screen fed by server events: one path a test or a reader starts from.
 *
 * The package's job is the SEAM — a wire message becomes a scenario the rest of
 * the application already understands, and everything it triggers is marked as
 * having come from outside. Which events exist is the application's business;
 * the package knows only the shape of a bridge.
 */
export { startPlaygroundChat } from "./start-playground-chat/startPlaygroundChat";
export { playgroundMessageArrived } from "./playground-message-arrived/PlaygroundMessageArrived";
export { PlaygroundChatBridge } from "./playground-chat-bridge/PlaygroundChatBridge";
export { PlaygroundEventSource } from "./playground-event-source/PlaygroundEventSource";
export { PlaygroundSocketTransport } from "./playground-socket-transport/PlaygroundSocketTransport";
export type { IPlaygroundChat } from "./_interfaces/IPlaygroundChat";
