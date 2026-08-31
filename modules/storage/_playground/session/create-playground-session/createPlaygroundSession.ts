import { lankaStorage } from "../../../src/index";
import { createPlaygroundDraft } from "../create-playground-draft/createPlaygroundDraft";
import { createPlaygroundFeedCache } from "../create-playground-feed-cache/createPlaygroundFeedCache";
import { createPlaygroundPreferences } from "../create-playground-preferences/createPlaygroundPreferences";
import type { IPlaygroundPreferences } from "../../_interfaces/IPlaygroundPreferences";

/**
 * A session that survives a reload, assembled from three LIFETIMES.
 *
 * Three storages exist for three lifetimes, and an application picks by MEANING
 * rather than by convenience: a preference outlives the tab, a draft does not,
 * and a computed list is a cache that may vanish without anyone noticing. Each
 * lifetime is its own file, so choosing wrongly is a visible import.
 */
export const createPlaygroundSession = () => {
	const preferences = createPlaygroundPreferences();
	const draft = createPlaygroundDraft();
	const feed = createPlaygroundFeedCache();

	return {
		savePreferences: (value: IPlaygroundPreferences) => preferences.save(value),
		readPreferences: () => preferences.read(),

		saveDraft: (text: string) => draft.save(text),
		readDraft: () => draft.read(),
		discardDraft: () => draft.discard(),

		cacheFeed: (items: readonly string[]) => feed.save(items),
		readFeed: () => feed.read(),

		/**
		 * Signing out takes the tab AND the preference, but not the cache.
		 *
		 * The cache holds nothing private and re-deriving it costs a request the
		 * next visitor would pay for no reason.
		 */
		async signOut(): Promise<void> {
			await lankaStorage.clearSession();
			await preferences.forget();
		},
	};
};
