import { lankaEncryptedStorage, lankaStorage } from "@lankajs/storage";

/** What this application remembers between visits. */
export interface IAtlasPreferences {
	/** Which column the board was sorted by. Not personal. */
	sortField: string | null;
	/** Whether the devtools panel was open. Not personal either. */
	isPanelOpen: boolean;
}

const PREFERENCES_KEY = "atlas.preferences";
const OPERATOR_KEY = "atlas.operator";

const DEFAULTS: IAtlasPreferences = { sortField: null, isPanelOpen: false };

/**
 * Two stores, and the line between them is what is PERSONAL.
 *
 * A sort order and a panel's state are not: they go in the plain store, where a
 * person can read them in devtools and nothing is lost by that. The operator's
 * name is, so it goes in the encrypted twin — where the KEY is hashed as well as
 * the value, because a key name in storage tells you what is stored under it and
 * leaving it in the clear leaves half the information outside.
 *
 * What the secret buys is worth saying plainly: it is baked into the build, so
 * it is obfuscation rather than protection against a script running on this
 * page. What it does is keep personal data out of `localStorage` as plain text.
 */
export class AtlasPreferences {
	private readonly secret: string;

	public constructor(secret: string) {
		this.secret = secret;
	}

	public async read(): Promise<IAtlasPreferences> {
		const stored = await lankaStorage.getLocal(PREFERENCES_KEY);
		if (stored === null) return DEFAULTS;

		try {
			return { ...DEFAULTS, ...(JSON.parse(stored) as Partial<IAtlasPreferences>) };
		} catch {
			// A value somebody else wrote, or one from a build whose shape has moved.
			// Defaults beat a crash on start-up for a preference nobody would miss.
			return DEFAULTS;
		}
	}

	public async write(preferences: IAtlasPreferences): Promise<void> {
		await lankaStorage.setLocal(PREFERENCES_KEY, JSON.stringify(preferences));
	}

	/** The operator's name, under a key the store hashes. */
	public async rememberOperator(name: string): Promise<void> {
		await lankaEncryptedStorage.init(this.secret, "atlas:");
		await lankaEncryptedStorage.setLocal(OPERATOR_KEY, name);
	}

	public async operator(): Promise<string | null> {
		await lankaEncryptedStorage.init(this.secret, "atlas:");

		return lankaEncryptedStorage.getLocal(OPERATOR_KEY);
	}

	/**
	 * Everything personal, gone — and nothing else.
	 *
	 * `lankaStorage.clearLocal()` would empty the whole page's storage, including
	 * keys this application never wrote: the ambient store was given the real
	 * `localStorage` and has no key space of its own. The encrypted store
	 * namespaces itself, so this clears only what it wrote.
	 */
	public async forgetOperator(): Promise<void> {
		await lankaEncryptedStorage.init(this.secret, "atlas:");
		await lankaEncryptedStorage.clearLocal();
	}
}
