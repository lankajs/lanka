import { createLankaSingleton } from "lanka/locator";

/** What the application asks the clock. */
export interface IAtlasClock {
	now: () => number;
	/** How many times anybody has asked, which a diagnostics panel shows. */
	readings: () => number;
}

/**
 * The clock, written by calling — the factory twin of `ALankaSingleton`.
 *
 * A singleton rather than `Date.now` at every call site, because a test that
 * wants to move time should not have to mock a global: it registers a different
 * object under the same name and nothing above notices.
 *
 * The name is PascalCase because what comes back IS a class — the locator
 * resolves `lankaSingletons.atlasClock` by this export name and constructs it on
 * first use. A camelCase name would read as the instance while being the
 * constructor.
 */
export const AtlasClock = createLankaSingleton<IAtlasClock>(() => {
	let readings = 0;

	return {
		now: () => {
			readings += 1;

			return Date.now();
		},
		readings: () => readings,
	};
});
