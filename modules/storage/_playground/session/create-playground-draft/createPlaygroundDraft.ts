import { lankaStorage } from "../../../src/index";

const DRAFT_KEY = "playground-draft";

/** Dies with the tab: an unfinished message is not a preference. */
export const createPlaygroundDraft = () => ({
	async save(text: string): Promise<void> {
		await lankaStorage.setSession(DRAFT_KEY, text);
	},

	read(): Promise<string | null> {
		return lankaStorage.getSession(DRAFT_KEY);
	},

	async discard(): Promise<void> {
		await lankaStorage.removeSession(DRAFT_KEY);
	},
});
