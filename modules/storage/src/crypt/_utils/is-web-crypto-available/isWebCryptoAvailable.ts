/**
 * Is the Web Crypto subtle API usable here?
 *
 * `crypto.subtle` is only exposed in a SECURE CONTEXT, and the gap is not
 * theoretical: a device opening a plain-`http://` tunnel during local testing, an
 * embedded WebView with a partial `crypto`, or a hardened build can all leave it
 * undefined — and `crypto.subtle.digest` on `undefined` throws.
 *
 * Callers use this to decide BEFORE building an encryptor, so a missing API becomes
 * a supported state instead of a rejected promise deep inside a storage adapter.
 */
export const isWebCryptoAvailable = (): boolean => {
	try {
		if (typeof crypto === "undefined") return false;
		if (typeof crypto.subtle !== "object" || crypto.subtle === null) {
			return false;
		}
		if (typeof crypto.subtle.digest !== "function") return false;
		if (typeof crypto.subtle.importKey !== "function") return false;
		if (typeof crypto.getRandomValues !== "function") return false;
		return true;
	} catch {
		// Reading `crypto` itself can throw in a few hardened environments.
		return false;
	}
};
