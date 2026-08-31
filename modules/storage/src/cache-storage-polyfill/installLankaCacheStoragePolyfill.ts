/**
 * Polyfills Cache Storage over localStorage where it is missing.
 *
 * ## A function to call rather than code on import
 *
 * Running on module load has three consequences, all bad:
 *
 * - **the library silently writes to the global `window.caches`**, changing the
 *   behaviour of everything on the page by the mere fact of being imported;
 * - **`sideEffects: false` in the manifest becomes untrue**, so a bundler is
 *   entitled to drop the module and the polyfill with it — or to keep both;
 * - **in node it throws `window is not defined`** on first import. No vitest run
 *   in jsdom can catch that, because there `window` always exists.
 *
 * The polyfill is now requested explicitly, by the application — the one
 * entitled to decide for its own page.
 */
export function installLankaCacheStoragePolyfill(): void {
	if (typeof window === "undefined" || window.caches) return;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(window as any).caches = {
		open: async (cacheName: string) => {
			const storageKey = `cache_${cacheName}`;
			return {
				put: async (key: string, value: Response) => {
					const text = await value.text();
					localStorage.setItem(`${storageKey}_${key}`, text);
				},
				match: async (key: string) => {
					const text = localStorage.getItem(`${storageKey}_${key}`);
					if (text) {
						return new Response(text);
					}
					return undefined;
				},
				delete: async (key: string) => {
					localStorage.removeItem(`${storageKey}_${key}`);
					return true;
				},
				keys: async () => {
					const keys = [];
					for (let i = 0; i < localStorage.length; i++) {
						const k = localStorage.key(i);
						if (k?.startsWith(storageKey)) {
							keys.push(new Request(k.replace(storageKey + "_", "")));
						}
					}
					return keys;
				},
			};
		},
		delete: async (cacheName: string) => {
			const storageKey = `cache_${cacheName}`;
			for (let i = localStorage.length - 1; i >= 0; i--) {
				const k = localStorage.key(i);
				if (k?.startsWith(storageKey)) {
					localStorage.removeItem(k);
				}
			}
			return true;
		},
	};
}
