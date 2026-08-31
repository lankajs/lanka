import { LankaEncryptedStorage, lankaEncryptedStorage } from "../../src/index";
import { bigIntToString, stringToBigInt } from "../../src/index";
import {
	lankaEncryptedStateStorage,
	setLankaLegacyPlaintextKeys,
	setLankaStorageSecret,
} from "../../src/index";

/**
 * A note the visitor wrote, which must not sit in localStorage in the clear.
 *
 * The secret is set by the APPLICATION and has no default: a shared fallback
 * secret is the absence of encryption wearing its presence. That is why the
 * first call here is a registration and not a convenience.
 */
export const createPlaygroundSecretNotes = (secret: string) => {
	setLankaStorageSecret(secret);
	// What the previous, unencrypted version of this app left behind. Deleted
	// once, when encrypted storage first becomes ready — and safe, because an
	// encrypted record is stored under a hashed key these names cannot reach.
	setLankaLegacyPlaintextKeys(["playground-note-plaintext"]);

	// A second encrypted storage, with its own key and its own key space: the
	// CLASS rather than the ambient instance, which is what an application builds
	// when one secret is not enough — a per-tenant vault, or a space a test may
	// fill without touching what the page wrote.
	const vault = new LankaEncryptedStorage();

	return {
		/** Readies both ciphers; nothing may be read or written before it resolves. */
		open: async (): Promise<void> => {
			await lankaEncryptedStorage.init(secret, "playground");
			await vault.init(`${secret}-vault`, "vault");
		},

		/** Written to the second one, and readable only through it. */
		writeToVault: (note: string): Promise<void> => vault.setLocal("playground-note", note),

		readFromVault: (): Promise<string | null> => vault.getLocal("playground-note"),

		/** The zustand-facing form, which a persisted slice is given. */
		stateStorage: lankaEncryptedStateStorage,

		write: (note: string): Promise<void> =>
			lankaEncryptedStorage.setLocal("playground-note", note),

		read: (): Promise<string | null> => lankaEncryptedStorage.getLocal("playground-note"),

		/**
		 * A set of long ids, kept as one number.
		 *
		 * The codec is what makes that survivable: a thousand string ids fill a
		 * quota, and the number they become decodes back to exactly the ids.
		 */
		packIds: (ids: readonly string[]): string =>
			bigIntToString(ids.reduce((acc, id) => (acc << 8n) + (stringToBigInt(id) % 251n), 1n)),
	};
};
