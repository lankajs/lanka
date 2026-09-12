import type { ILankaReadCache } from "lanka/cache";
import type { PlaygroundArticleGateway } from "../playground-article-gateway/PlaygroundArticleGateway";
import type { IPlaygroundArticle } from "../_interfaces/IPlaygroundArticle";

/** What opening an article is handed. */
export interface IPlaygroundOpenContext {
	cache: ILankaReadCache;
	articleGateway: PlaygroundArticleGateway;
	article: () => IPlaygroundArticle | null;
	set: (
		state: Partial<{
			article: IPlaygroundArticle;
			changedElsewhere: boolean;
			isLoading: boolean;
		}>,
	) => void;
	/** Where the screen keeps the release, so a second open replaces the first. */
	held: { release: (() => void) | null };
}

/**
 * Opens an article: start listening, then read.
 *
 * In that ORDER, so a change landing between the two is not missed. Nothing
 * arrives from the subscription until somebody else writes — the port promises
 * that subscribing delivers no current value, which is what lets a screen listen
 * before it has anything to show.
 *
 * A change that arrives later sets a MARKER rather than replacing what is being
 * read silently. That is the rule the Forms boundary states one layer up, and it
 * is the same rule: what came from elsewhere never overwrites what a person is
 * looking at without saying so.
 */
export const openPlaygroundArticle = async (
	{ cache, articleGateway, article, set, held }: IPlaygroundOpenContext,
	slug: string,
): Promise<void> => {
	held.release?.();

	held.release = cache.subscribe(["article", slug], (data) => {
		const next = data as IPlaygroundArticle;
		if (next.title === article()?.title) return;
		set({ article: next, changedElsewhere: true });
	});

	set({ isLoading: true });
	try {
		set({
			article: await cache.read(
				["article", slug],
				(signal) => articleGateway.bySlug(slug, { signal }),
				{ staleMs: 30_000 },
			),
			changedElsewhere: false,
		});
	} finally {
		set({ isLoading: false });
	}
};
