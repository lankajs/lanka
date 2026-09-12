import type { ILankaStorageAdapter } from "lanka/storage";

const ACCESS = "auth.access token";
const REFRESH = "auth.refresh/token";

/**
 * The application: two tokens, and a sign-out that has to be true.
 *
 * The keys are written with a space and a slash on purpose. An application names
 * its keys for itself and should not have to learn which characters the device's
 * keychain dislikes — that is the adapter's problem, and this is the fixture that
 * proves it stays there.
 *
 * `signOut` is the whole reason the adapter keeps an index. The application does
 * not name its keys when it signs out; it says "everything", and everything has
 * to mean everything, including a token some earlier screen wrote and this file
 * never heard of.
 */
export const createPlaygroundVault = (adapter: ILankaStorageAdapter) => ({
	keep: async (access: string, refresh: string): Promise<void> => {
		await adapter.setItem(ACCESS, access);
		await adapter.setItem(REFRESH, refresh);
	},

	access: (): Promise<string | null> => adapter.getItem(ACCESS),

	/** A rotation: the access token is replaced, the refresh token is not. */
	rotate: (access: string): Promise<void> => adapter.setItem(ACCESS, access),

	/** What this session put on the device, whoever wrote it. */
	held: (): Promise<string[]> => adapter.keys?.() ?? Promise.resolve([]),

	signOut: (): Promise<void> => adapter.clear(),
});
