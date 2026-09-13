import type { LankaStorage } from "@lankajs/storage";

/** Which screen the application mounts, decided before it renders anything. */
export interface IAtlasFirstFrame {
	screen: "sign-in" | "board";
	/** What the person last sorted the board by, or nothing. */
	sortField: string | null;
}

const SORT_KEY = "atlas.sortField";
const OPERATOR_KEY = "atlas.operator";

/**
 * What the first frame needs, read SYNCHRONOUSLY.
 *
 * This is the whole reason `@lankajs/mmkv` is in this application. Written over
 * an awaited engine, the same code renders the sign-in screen first and the
 * board a moment later — which a person reads as a flash rather than as a load.
 * Here the decision is made, not guessed and corrected a tick afterwards.
 *
 * `getLocalSync` exists only because the adapter under `local` has both halves
 * of the port. The store ASKS the adapter before using them, so an async-only
 * engine is not broken here — it simply cannot answer this question, and an
 * application on one writes the honest version with a splash screen instead.
 */
export const readAtlasFirstFrame = (storage: LankaStorage): IAtlasFirstFrame => ({
	// The token itself lives in the keychain, which is slow and asynchronous. What
	// is read here is a FLAG the application wrote beside it — enough to choose a
	// screen, and worth nothing to anybody who reads it off the device.
	screen: storage.getLocalSync(OPERATOR_KEY) === null ? "sign-in" : "board",
	sortField: storage.getLocalSync(SORT_KEY),
});
