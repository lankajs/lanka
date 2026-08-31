import type { LankaOptimisticActions } from "../../../src/index";
import type { IPlaygroundPost } from "../../_interfaces/IPlaygroundPost";
import type { IPlaygroundPostRef } from "../../_interfaces/IPlaygroundPostRef";

/**
 * Latest wins: the screen follows the last tap.
 *
 * Tapping again SUPERSEDES the previous attempt, so a superseded attempt needs
 * no rollback — rolling it back would undo the state the newer tap just wrote.
 */
export const createPlaygroundLike =
	(actions: LankaOptimisticActions, post: IPlaygroundPostRef) =>
	(send: (isLiked: boolean, signal: AbortSignal) => Promise<void>): Promise<void> => {
		const next = !post.read().isLiked;

		return actions.runLatest<IPlaygroundPost>(
			"like",
			() => {
				const snapshot = post.read();
				post.write({ ...snapshot, isLiked: next, likes: snapshot.likes + (next ? 1 : -1) });
				return snapshot;
			},
			(signal) => send(next, signal),
			(snapshot) => {
				post.write(snapshot);
			},
		);
	};
