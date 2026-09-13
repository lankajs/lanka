import type { LankaStorage } from "@lankajs/storage";

const TOKEN_KEY = "auth.access token";
const OPERATOR_KEY = "atlas.operator";

/**
 * The session as a device keeps it: the token behind the lock, a flag beside it.
 *
 * Two stores for one fact, deliberately. The TOKEN goes in the keychain, where
 * it is ciphertext at rest and where reading it is slow. The fact that somebody
 * is signed in goes in the fast store, because the first frame has to decide
 * which screen to mount and cannot wait for a keychain.
 *
 * The key is written the way a person would write it — with a space in it. A
 * keychain accepts only letters, digits, `.`, `-` and `_`, and the adapter
 * encodes on the way in and decodes on the way out, so an application never has
 * to know that.
 */
export class AtlasDeviceSession {
	private readonly storage: LankaStorage;

	public constructor(storage: LankaStorage) {
		this.storage = storage;
	}

	public async remember(name: string, token: string): Promise<void> {
		await this.storage.setSession(TOKEN_KEY, token);
		// Written after the token, so a crash between the two leaves the
		// application signed OUT with a token nobody reads, rather than signed in
		// with no token.
		this.storage.setLocalSync(OPERATOR_KEY, name);
	}

	public token(): Promise<string | null> {
		return this.storage.getSession(TOKEN_KEY);
	}

	public operator(): string | null {
		return this.storage.getLocalSync(OPERATOR_KEY);
	}

	/**
	 * Signs out, and takes the token with it.
	 *
	 * `clearSession()` on the keychain store removes only what THIS adapter wrote,
	 * because it walks an index of its own. Without that index a sign-out could
	 * only delete keys the caller happened to name, and a token some earlier
	 * screen wrote would outlive the session.
	 */
	public async forget(): Promise<void> {
		await this.storage.clearSession();
		this.storage.removeLocalSync(OPERATOR_KEY);
	}
}
