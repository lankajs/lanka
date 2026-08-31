/**
 * A "like" button and a "publish" button — the two shapes of optimistic action.
 *
 * A like is LATEST-wins: tapping again supersedes the previous attempt, and a
 * superseded attempt needs no rollback. Publishing is EXCLUSIVE: a second tap
 * while the first is in flight is not a new intent, and a failure must roll back
 * or the screen goes on claiming something that did not happen. One file each,
 * because the difference is the subject.
 */
export { createPlaygroundEditor } from "./editor/create-playground-editor/createPlaygroundEditor";
export { createPlaygroundLike } from "./editor/create-playground-like/createPlaygroundLike";
export { createPlaygroundPublish } from "./editor/create-playground-publish/createPlaygroundPublish";
export type { IPlaygroundPost } from "./_interfaces/IPlaygroundPost";
export type { IPlaygroundPostRef } from "./_interfaces/IPlaygroundPostRef";
