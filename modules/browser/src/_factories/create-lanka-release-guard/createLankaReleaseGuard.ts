import { createLocalStorageMemory } from "../../_internal/create-local-storage-memory/createLocalStorageMemory";
import { dropCacheStorage } from "../../_internal/drop-cache-storage/dropCacheStorage";
import type { ILankaReleaseMemory } from "../../_interfaces/ILankaReleaseMemory";
import type { TLankaReleaseOutcome } from "../../_types/TLankaReleaseOutcome";

/** What the guard needs to know, and what it is allowed to replace. */
export interface ILankaReleaseGuardConfig {
	/**
	 * This build's version, however the application knows it.
	 *
	 * Required and unguessable: a framework cannot know the bundler. With vite it
	 * is a fetch of a manifest the build stamps; with a service worker it is the
	 * worker; with an env variable it is two words.
	 */
	readVersion: () => Promise<string | null> | string | null;
	/** Where the last seen version lives. `localStorage` by default. */
	memory?: ILankaReleaseMemory;
	/** What a new release invalidates. Every Cache Storage cache by default. */
	dropCaches?: () => Promise<void>;
	/** Told what happened, and about anything that went wrong. */
	report?: (message: string) => void;
}

/**
 * Notices that a new build shipped, and drops the caches the old one filled.
 *
 * The failure it prevents: a returning visitor holds Cache Storage entries from
 * a build that no longer exists — avatars keyed by a URL scheme that changed, a
 * polyfilled cache whose shape moved — and the new code reads them as its own.
 * The framework CREATES those caches (`@lankajs/blob-cache`, the Cache Storage
 * polyfill), which is why noticing is its business.
 *
 * It answers rather than acts. Reloading the page is the commonest response and
 * the worst default: a visitor halfway through a form would lose it.
 */
export const createLankaReleaseGuard = (config: ILankaReleaseGuardConfig) => {
	const memory = config.memory ?? createLocalStorageMemory();
	const dropCaches = config.dropCaches ?? dropCacheStorage;

	return {
		async check(): Promise<TLankaReleaseOutcome> {
			try {
				const version = await config.readVersion();
				if (version === null || version === "") {
					// Not knowing is not a release. Dropping the caches whenever the
					// version is unreadable would empty them on every failed request.
					config.report?.("release guard: no version to compare");
					return "unknown";
				}

				if (memory.read() === version) return "unchanged";

				await dropCaches();
				memory.write(version);
				config.report?.(`release guard: caches dropped for ${version}`);

				return "released";
			} catch (error) {
				// Contained on purpose: a guard that throws takes down the start-up
				// of an application whose only problem was a cache it could not read.
				config.report?.(
					`release guard: ${error instanceof Error ? error.message : "failed"}`,
				);
				return "unknown";
			}
		},
	};
};
