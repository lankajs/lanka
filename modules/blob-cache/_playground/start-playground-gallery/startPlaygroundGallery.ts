import { LANKA_BLOB_CACHE_CONFIG } from "../../src/index";
import { LankaBlobCachePolicy } from "../../src/index";
import { setupLankaBlobCacheLifecycle } from "../../src/index";
import { createPlaygroundEnvironment } from "../_testing/create-playground-environment/createPlaygroundEnvironment";
import type { IPlaygroundNetwork } from "../_interfaces/IPlaygroundNetwork";

/**
 * An avatar list: the case this cache is for, and the only one it is safe for.
 *
 * Content-addressed URLs, where the key carries a uuid and the answer is
 * immutable, so a stale entry cannot exist. Everything the application decides —
 * store names, blocked hosts, what counts as the end of a session — is
 * configured from outside, and this is where that configuration is EXERCISED
 * rather than described.
 */
export const startPlaygroundGallery = (network: IPlaygroundNetwork) => {
	const env = createPlaygroundEnvironment(network);
	const policy = new LankaBlobCachePolicy(env, {
		...LANKA_BLOB_CACHE_CONFIG,
		// The application's own decision, which the package refuses to guess: a
		// host whose CORS forbids reading the bytes can never be cached, and
		// trying anyway costs a request per render.
		corsBlockedOrigins: ["blocked.invalid"],
	});

	let endSession: (() => void) | null = null;

	return {
		policy,
		env,
		/** What a screen calls before painting: a cached avatar has no flash. */
		initialSrc: (src: string): string | undefined => policy.getInitialSrc(src),
		/** What a screen calls after painting: warm it for next time. */
		warm: (src: string): void => {
			policy.warmCache(src);
		},
		/** The application decides what ends a session; the package does not. */
		attachLifecycle(subscribeToSessionEnd: (onEnd: () => void) => () => void): void {
			endSession = setupLankaBlobCacheLifecycle({ cache: policy, subscribeToSessionEnd });
		},
		detachLifecycle(): void {
			endSession?.();
			endSession = null;
		},
	};
};
