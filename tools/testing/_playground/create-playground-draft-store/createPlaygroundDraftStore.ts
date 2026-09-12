import type { ILankaStorageAdapter } from "lanka/storage";

/** What the application keeps: the text, and when it was kept. */
interface IPlaygroundStoredDraft {
	text: string;
	savedAt: number;
}

/** A draft is worth restoring for a day; after that it is somebody else's sentence. */
const KEEP_FOR_MS = 24 * 60 * 60 * 1000;

const KEY = "playground.profile.draft";

/**
 * The half-typed profile a reload must not lose — somebody else's code.
 *
 * The unit a consumer would be testing, and the reason this playground needs a
 * storage double at all: it holds a DECISION, not a pass-through. An expired
 * draft is not restored, and it is not left lying in the store either — which is
 * the part a test has to be able to see, because "not restored" and "removed"
 * look identical from the outside.
 *
 * The engine arrives as a parameter. That is what lets this be tested in node
 * without a browser, and it is also how the application swaps the engine on a
 * device without this file learning about it.
 */
export const createPlaygroundDraftStore = (
	adapter: ILankaStorageAdapter,
	now: () => number = () => Date.now(),
) => ({
	save: (text: string): Promise<void> =>
		adapter.setItem(KEY, JSON.stringify({ text, savedAt: now() })),

	read: async (): Promise<string | null> => {
		const raw = await adapter.getItem(KEY);
		if (raw === null) return null;

		const draft = JSON.parse(raw) as IPlaygroundStoredDraft;
		if (now() - draft.savedAt <= KEEP_FOR_MS) return draft.text;

		await adapter.removeItem(KEY);
		return null;
	},

	discard: (): Promise<void> => adapter.removeItem(KEY),

	/** Signing out takes the draft with it, whatever the engine underneath. */
	signOut: (): Promise<void> => adapter.clear(),
});
