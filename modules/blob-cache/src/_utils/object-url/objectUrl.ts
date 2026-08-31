/**
 * Object-URL helpers that cannot throw.
 *
 * `URL.createObjectURL` is absent in some hardened WebViews and throws for some
 * inputs in others. Both call sites are in paths where an exception is
 * expensive: the image cache resolves during RENDER, where a throw is a white
 * screen, and image selection resolves inside a ViewModel action, where a throw
 * cancels the choice the user just made.
 *
 * `null` is the honest failure value: every caller has something reasonable to do
 * with it — serve the network URL, skip the local preview — so the fallback is a
 * decision at the call site rather than a hidden default here.
 */
export const createObjectUrlSafely = (source: Blob | File): string | null => {
	try {
		if (typeof URL === "undefined") return null;
		if (typeof URL.createObjectURL !== "function") return null;
		return URL.createObjectURL(source);
	} catch {
		return null;
	}
};

/**
 * Revokes a URL, ignoring platforms that cannot.
 *
 * A URL we fail to revoke is a leak we cannot prevent; throwing would break the
 * cleanup path this call lives in: sign-out, page hide, replacing a chosen
 * image.
 */
export const revokeObjectUrlSafely = (url: string | null | undefined): void => {
	if (!url) return;
	try {
		if (typeof URL === "undefined") return;
		if (typeof URL.revokeObjectURL !== "function") return;
		URL.revokeObjectURL(url);
	} catch {
		// Silent deliberately — see the docblock.
	}
};
