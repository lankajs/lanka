import type { LankaOptimisticActions, TLankaExclusiveOutcome } from "../../../src/index";
import type { IPlaygroundPost } from "../../_interfaces/IPlaygroundPost";
import type { IPlaygroundPostRef } from "../../_interfaces/IPlaygroundPostRef";

/**
 * Exclusive: a second tap while publishing is not a second intent.
 *
 * A failure MUST roll back, or the screen goes on claiming something that did
 * not happen — which is the difference between this shape and a like, and the
 * reason they are two functions rather than a flag.
 */
export const createPlaygroundPublish =
	(actions: LankaOptimisticActions, post: IPlaygroundPostRef) =>
	(send: () => Promise<void>): Promise<TLankaExclusiveOutcome> =>
		actions.runExclusive<IPlaygroundPost>(
			"publish",
			() => {
				const snapshot = post.read();
				post.write({ ...snapshot, isPublished: true });
				return snapshot;
			},
			() => send(),
			(snapshot) => {
				post.write(snapshot);
			},
		);
