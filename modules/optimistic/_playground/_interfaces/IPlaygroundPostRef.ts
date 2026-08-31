import type { IPlaygroundPost } from "./IPlaygroundPost";

/**
 * The screen's state, passed as a thing that can be read and written.
 *
 * Each action takes this rather than closing over a local: an optimistic action
 * is defined by what it does to state before the server answers, so the state
 * has to be something it can be HANDED.
 */
export interface IPlaygroundPostRef {
	read: () => IPlaygroundPost;
	write: (post: IPlaygroundPost) => void;
}
