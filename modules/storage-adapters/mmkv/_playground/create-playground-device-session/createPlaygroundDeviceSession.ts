import type { ILankaStorageAdapter } from "lanka/storage";

const TOKEN = "session.token";
const LAST_SCREEN = "session.last-screen";

/**
 * The application: a session that must be there on the first frame.
 *
 * This is what the synchronous half is FOR, and the scene that shows it cannot
 * be written with an awaited engine. A device application decides which screen
 * to mount before it renders anything: with a token it goes to the feed,
 * without one to the sign-in. An answer that arrives a tick later means both
 * screens have already been decided against.
 *
 * The engine is a parameter here too, one level up: the application takes an
 * adapter, not MMKV, so the same session runs over a keychain or over a test
 * double without a line changing.
 */
export const createPlaygroundDeviceSession = (adapter: ILankaStorageAdapter) => {
	const readNow = (key: string): string | null => {
		if (!adapter.getItemSync) {
			throw new Error("This session needs an engine that answers without awaiting.");
		}
		return adapter.getItemSync(key);
	};

	return {
		/** The decision taken before the first render. */
		firstScreen: (): "feed" | "sign-in" => (readNow(TOKEN) === null ? "sign-in" : "feed"),

		/** Where the visitor was, restored on the same frame as the screen. */
		lastScreen: (): string | null => readNow(LAST_SCREEN),

		signIn: (token: string): Promise<void> => adapter.setItem(TOKEN, token),

		rememberScreen: (name: string): Promise<void> => adapter.setItem(LAST_SCREEN, name),

		/** Everything this session wrote, gone — including where they had been. */
		signOut: (): Promise<void> => adapter.clear(),
	};
};
