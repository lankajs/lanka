import { createLankaVM } from "lanka/viewmodel";
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
 *
 * What it never does is write into what the person is reading without saying so:
 * a change that arrives from elsewhere sets a MARKER, and the screen offers to
 * reload. That rule is the same one the Forms boundary states for a form's
 * inputs, one layer down.
 */
export const createPlaygroundArticleVM = (
	articleGateway: PlaygroundArticleGateway,
	cache: ILankaReadCache,
	name = "PlaygroundArticleVM",
) => {
	let release: (() => void) | null = null;
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
			open: async (slug) => {
				release?.();
				openSlug = slug;

				// Listening starts BEFORE reading, so a change landing between the two
				// is not missed. The first answer is not an event, so nothing arrives
				// from this subscription until somebody else writes.
				release = services.cache.subscribe(["article", slug], (data) => {
					const next = data as IPlaygroundArticle;
					if (next.title === get().article?.title) return;
					set({ article: next, changedElsewhere: true });
				});

				set({ isLoading: true });
				try {
					set({
						article: await services.cache.read(
							["article", slug],
							(signal) => gateways.articleGateway.bySlug(slug, { signal }),
							{ staleMs: 30_000 },
						),
						changedElsewhere: false,
					});
				} finally {
					set({ isLoading: false });
				}
			},

			close: () => {
				release?.();
				release = null;
				// `cancel` is ABSENT on this member, and the optional call says so at
				// the call site: a request already in flight will finish and its answer
				// will be discarded. Wasteful, never wrong — and the alternative, a
				// no-op `cancel`, would have this screen believe it stopped.
				if (openSlug !== null) services.cache.cancel?.(["article", openSlug]);
				openSlug = null;
			},
		}),

		onReset: () => {
			release?.();
			release = null;
		},
	});
};
