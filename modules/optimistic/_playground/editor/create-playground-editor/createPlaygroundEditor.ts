import { LankaOptimisticActions } from "../../../src/index";
import { createPlaygroundLike } from "../create-playground-like/createPlaygroundLike";
import { createPlaygroundPublish } from "../create-playground-publish/createPlaygroundPublish";
import type { IPlaygroundPost } from "../../_interfaces/IPlaygroundPost";

/**
 * A "like" button and a "publish" button — the two shapes of optimistic action,
 * which behave differently on purpose.
 *
 * They sit side by side here because the package's claim is that the difference
 * is a CHOICE the caller makes, not a policy the package applies: each shape is
 * its own file, and this one only says which button gets which.
 */
export const createPlaygroundEditor = (initial: IPlaygroundPost) => {
	const actions = new LankaOptimisticActions();
	let post = initial;

	const ref = {
		read: () => post,
		write: (next: IPlaygroundPost) => {
			post = next;
		},
	};

	return {
		get post(): IPlaygroundPost {
			return post;
		},
		like: createPlaygroundLike(actions, ref),
		publish: createPlaygroundPublish(actions, ref),
	};
};
