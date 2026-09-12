import type { ILankaStorageAdapter } from "lanka/storage";

const THEME = "preferences.theme";
const LOCALE = "preferences.locale";

/** What the application boots into, once it has been told. */
export interface IPlaygroundBoot {
	screen: "splash" | "app";
	theme: string;
	locale: string;
}

/**
 * The application: preferences that arrive a tick after the first render.
 *
 * The counterpart to `@lankajs/mmkv`'s device session, and the same code written
 * for the engine it actually has. Nothing here can be read synchronously, so the
 * application does the only honest thing: it renders a splash, awaits, and then
 * renders the screen with the preferences already in hand.
 *
 * Writing it the other way — render the app with defaults and correct it when
 * the store answers — is the flash that made MMKV worth a second package.
 */
export const createPlaygroundPreferences = (adapter: ILankaStorageAdapter) => ({
	/** Before anything is known. The screen a device shows for one tick. */
	initial: (): IPlaygroundBoot => ({ screen: "splash", theme: "light", locale: "en" }),

	boot: async (): Promise<IPlaygroundBoot> => ({
		screen: "app",
		theme: (await adapter.getItem(THEME)) ?? "light",
		locale: (await adapter.getItem(LOCALE)) ?? "en",
	}),

	choose: async (theme: string, locale: string): Promise<void> => {
		await adapter.setItem(THEME, theme);
		await adapter.setItem(LOCALE, locale);
	},

	/** One preference reset to the default, which is a removal and not an empty value. */
	forgetTheme: (): Promise<void> => adapter.removeItem(THEME),

	signOut: (): Promise<void> => adapter.clear(),
});
