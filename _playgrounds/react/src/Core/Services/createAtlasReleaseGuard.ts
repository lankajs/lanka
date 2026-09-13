import { createLankaReleaseGuard } from "@lankajs/browser";
import type { ILankaReleaseGuardConfig } from "@lankajs/browser";

/** Where the build says what it is. */
const MANIFEST = "/build-manifest.json";

/**
 * Notices that a new build shipped, and drops the caches the old one filled.
 *
 * `readVersion` is required and unguessable: a framework cannot know a bundler.
 * Here it is a fetch of a manifest the API stamps, because these applications
 * are served by a dev server that stamps nothing.
 *
 * The guard ANSWERS rather than acts, and that is the design. Reloading is the
 * commonest response and the worst default — somebody halfway through a dispatch
 * would lose it — so what `"released"` means is this application's decision.
 *
 * `"unknown"` is NOT a release. Dropping caches on an unreadable version turns
 * one failed request into an empty cache.
 */
export const createAtlasReleaseGuard = (
	apiBaseUrl: string,
	config: Partial<ILankaReleaseGuardConfig> = {},
) =>
	createLankaReleaseGuard({
		readVersion: async () => {
			const response = await fetch(`${apiBaseUrl}${MANIFEST}`);
			const manifest = (await response.json()) as { version?: unknown };

			return typeof manifest.version === "string" ? manifest.version : null;
		},
		...config,
	});
