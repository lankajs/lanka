import type { LankaBlobCachePolicy } from "../lanka-blob-cache-policy/LankaBlobCachePolicy";

export interface ILankaBlobCacheLifecycleOptions {
	/** The cache whose side effects this call manages. */
	cache: Pick<LankaBlobCachePolicy, "clear" | "releaseObjectUrls">;
	/**
	 * Subscription to the end of a session. The application supplies its own
	 * event; the call must return an unsubscribe function.
	 *
	 * Unset means there is NO sign-out cleanup, and that is the application's
	 * decision: the package has no opinion about what counts as a session ending.
	 */
	subscribeToSessionEnd?: (handler: () => void) => () => void;
}

/**
 * The cache's side effects, so neither the application bootstrap nor any
 * ViewModel.
 *
 * Two duties:
 *
 * - **Cleanup on sign-out.** Cached images are other people's faces. On a shared
 *   device the next sign-in must not inherit them, so the store is cleared WITH
 *   the session rather than living to its TTL.
 * - **Releasing object URLs on page hide.** Every live object URL pins its blob
 *   in memory; revoking them on hide stops a long session accumulating blobs.
 *   The stored bytes remain, and the next resolve simply mints a URL again.
 *
 * Both the cache and the subscription arrive as parameters: a package that
 * reached into a locator and subscribed to an application's own scenario would
 * know that application's event names and require a bootstrapped framework.
 *
 * Returns an unsubscribe function.
 */
export const setupLankaBlobCacheLifecycle = (
	options: ILankaBlobCacheLifecycleOptions,
): (() => void) => {
	const { cache, subscribeToSessionEnd } = options;

	const unsubscribeSession = subscribeToSessionEnd?.(() => {
		void cache.clear();
	});

	const handlePageHide = (): void => {
		cache.releaseObjectUrls();
	};

	// `window` is absent outside a browser, and not every engine sends
	// `pagehide`. Missing it costs only the memory optimisation: the stored bytes
	// and the sign-out cleanup do not depend on it.
	const hasWindow = typeof window !== "undefined";
	if (hasWindow) {
		window.addEventListener("pagehide", handlePageHide);
	}

	return () => {
		unsubscribeSession?.();
		if (hasWindow) {
			window.removeEventListener("pagehide", handlePageHide);
		}
	};
};
