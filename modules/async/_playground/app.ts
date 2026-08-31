/**
 * A live participant list, the way a realtime screen is actually built.
 *
 * The guard, the coalescer and polling appear together because that is how they
 * are used; each on its own is already a unit test. The only stub is the server.
 */
export { createPlaygroundRoom } from "./room/create-playground-room/createPlaygroundRoom";
export { createPlaygroundServer } from "./create-playground-server/createPlaygroundServer";
export type { IPlaygroundParticipant } from "./_interfaces/IPlaygroundParticipant";
export type { IPlaygroundServer } from "./_interfaces/IPlaygroundServer";
