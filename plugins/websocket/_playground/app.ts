/**
 * A chat room over a socket: one path a test or a reader starts from.
 *
 * The package's job is the SEAM in both directions — a wire frame becomes a
 * scenario the rest of the application already understands, and everything it
 * triggers is marked as having come from outside; a message the user sends goes
 * out through the plugin's channel rather than through a bridge. Which events
 * exist is the application's business.
 */
export { startPlaygroundRoom } from "./start-playground-room/startPlaygroundRoom";
export { playgroundMessageArrived } from "./playground-message-arrived/PlaygroundMessageArrived";
export { PlaygroundRoomBridge } from "./playground-room-bridge/PlaygroundRoomBridge";
export { PlaygroundWebSocket } from "./playground-web-socket/PlaygroundWebSocket";
export { PlaygroundNativeChannel } from "./playground-native-channel/PlaygroundNativeChannel";
export type { IPlaygroundRoom } from "./_interfaces/IPlaygroundRoom";
