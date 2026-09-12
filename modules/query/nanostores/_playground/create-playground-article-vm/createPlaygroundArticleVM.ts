import { createLankaVM } from "lanka/viewmodel";
import { openPlaygroundArticle } from "../open-playground-article/openPlaygroundArticle";
import type { ILankaReadCache } from "lanka/cache";
import type { PlaygroundArticleGateway } from "../playground-article-gateway/PlaygroundArticleGateway";
import type { IPlaygroundArticle } from "../_interfaces/IPlaygroundArticle";

interface IArticleState {
	article: IPlaygroundArticle | null;
	/** Somebody else changed it while this screen was open. */
	changedElsewhere: boolean;
	isLoading: boolean;
}

interface IArticleActions {
	open: (slug: string) => Promise<void>;
	close: () => void;
}

/**
 * A DETAIL screen, which is the shape this member is shown in.
 *
 * The family shows its two members differently on purpose:
 * `@lankajs/tanstack-query` carries a list with a second reader and an
 * optimistic rename, and this one carries a screen that hears a change made
 * elsewhere. The behaviour they share is asserted by the conformance suite, so a
 * second copy of one scene would teach nothing.
 */
export const createPlaygroundArticleVM = (
	articleGateway: PlaygroundArticleGateway,
	cache: ILankaReadCache,
	name = "PlaygroundArticleVM",
) => {
	const held: { release: (() => void) | null } = { release: null };
	let openSlug: string | null = null;

	return createLankaVM<
		IArticleState,
		IArticleActions,
		{ articleGateway: PlaygroundArticleGateway },
		{ cache: ILankaReadCache }
	>({
		name,
		gateways: () => ({ articleGateway }),
		services: () => ({ cache }),
		states: { article: null, changedElsewhere: false, isLoading: false },

		createActions: ({ set, get, gateways, services }) => ({
			open: (slug) => {
				openSlug = slug;
				return openPlaygroundArticle(
					{
						cache: services.cache,
						articleGateway: gateways.articleGateway,
						article: () => get().article,
						set,
						held,
					},
					slug,
				);
			},

			close: () => {
				held.release?.();
				held.release = null;
				// `cancel` is ABSENT on this member, and the optional call says so at
				// the call site: a request already in flight will finish and its answer
				// will be discarded. Wasteful, never wrong — and the alternative, a
				// no-op `cancel`, would have this screen believe it stopped.
				if (openSlug !== null) services.cache.cancel?.(["article", openSlug]);
				openSlug = null;
			},
		}),

		onReset: () => {
			held.release?.();
			held.release = null;
		},
	});
};
