/**
 * SHA-256 of a string, as lower-case hex.
 *
 * Here for ONE caller: the storage key scheme `LankaCipher` used before the hash
 * was keyed, which it still has to recognise so that an application upgrading
 * does not read `null` for everything it had stored. Its whole property — that
 * anybody can compute it without the secret — is what made it wrong to store a
 * key name under, and what makes it the right shape to go looking for.
 *
 * New code has no reason to call it. `LankaEncryptor.hashKey` is the keyed hash
 * that replaced it.
 */
export const sha256Hex = async (text: string): Promise<string> => {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));

	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
};
