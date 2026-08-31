import { createLankaReleaseGuard } from "../../src/index";
import type { TLankaReleaseOutcome } from "../../src/index";

/** A deployment, as far as a returning visitor can tell. */
export interface IPlaygroundDeployment {
	/** What the build says it is. The application decides how it knows. */
	version: string | null;
	/** Names of the caches the previous build filled. */
	caches: string[];
	/** Starts the app the way an entry point does, and says what it found. */
	start: () => Promise<TLankaReleaseOutcome>;
}

/**
 * An application that survives its own deployments.
 *
 * The caches here stand in for what `@lankajs/blob-cache` and the Cache Storage
 * polyfill leave behind — the framework's own, which is why noticing a new build
 * is the framework's business and not the application's.
 *
 * Memory is a plain object rather than `localStorage`: the port exists so a
 * scene can hold two visits in a row without a browser.
 */
export const startPlaygroundDeployment = (): IPlaygroundDeployment => {
	let remembered: string | null = null;

	const deployment: IPlaygroundDeployment = {
		version: "1.0.0",
		caches: ["avatars", "polyfilled-state"],
		start: () =>
			createLankaReleaseGuard({
				readVersion: () => deployment.version,
				memory: {
					read: () => remembered,
					write: (version) => {
						remembered = version;
					},
				},
				dropCaches: () => {
					deployment.caches = [];
					return Promise.resolve();
				},
			}).check(),
	};

	return deployment;
};
