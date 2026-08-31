import { lankaStorage } from "../../../src/index";

const FEED_KEY = "playground-feed";

/** May vanish: the feed is derived, and re-deriving it is cheap. */
export const createPlaygroundFeedCache = () => ({
	async save(items: readonly string[]): Promise<void> {
		await lankaStorage.setCache(FEED_KEY, JSON.stringify(items));
	},

	async read(): Promise<string[] | null> {
		const raw = await lankaStorage.getCache(FEED_KEY);
		return raw ? (JSON.parse(raw) as string[]) : null;
	},
});
