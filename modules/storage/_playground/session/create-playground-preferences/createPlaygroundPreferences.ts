import { lankaStorage } from "../../../src/index";
import type { IPlaygroundPreferences } from "../../_interfaces/IPlaygroundPreferences";

const PREFERENCES_KEY = "playground-preferences";

/**
 * Outlives the tab: the visitor chose it once and means it.
 *
 * The key is private to this file on purpose. A key exported for a second reader
 * is how two places end up disagreeing about what is stored under it.
 */
export const createPlaygroundPreferences = () => ({
	async save(preferences: IPlaygroundPreferences): Promise<void> {
		await lankaStorage.setLocal(PREFERENCES_KEY, JSON.stringify(preferences));
	},

	async read(): Promise<IPlaygroundPreferences | null> {
		const raw = await lankaStorage.getLocal(PREFERENCES_KEY);
		return raw ? (JSON.parse(raw) as IPlaygroundPreferences) : null;
	},

	async forget(): Promise<void> {
		await lankaStorage.removeLocal(PREFERENCES_KEY);
	},
});
