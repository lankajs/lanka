import { installLankaCacheStoragePolyfill } from "../../src/index";

/**
 * What an application does once, before anything reads a storage.
 *
 * The Cache Storage API is missing in jsdom and in older WebViews, and the
 * polyfill is requested EXPLICITLY rather than installed on import: installing
 * on import would make a bare `import` of this package fail in node, where
 * `window` does not exist.
 */
export const startPlaygroundStorage = (): void => {
	installLankaCacheStoragePolyfill();
};
