/**
 * One screen, rendered the way a host framework renders one.
 *
 * The scene has both sides of the seam in it: a loader that runs on the server
 * against a per-request instance, and a screen that starts in the browser from
 * what the loader returned. The only stub is the server itself.
 */
export { PlaygroundPostGateway } from "./playground-post-gateway/PlaygroundPostGateway";
export { createPlaygroundPostsVM } from "./create-playground-posts-vm/createPlaygroundPostsVM";
export { createPlaygroundApi } from "./create-playground-api/createPlaygroundApi";
export type { IPlaygroundApi } from "./_interfaces/IPlaygroundApi";
export type { IPlaygroundPost } from "./_interfaces/IPlaygroundPost";
