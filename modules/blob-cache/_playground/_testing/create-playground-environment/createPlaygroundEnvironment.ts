import type { ILankaBlobCacheEnvironment } from "../../../src/index";
import type { IPlaygroundNetwork } from "../../_interfaces/IPlaygroundNetwork";

/** The environment, plus every object URL currently alive. */
export interface IPlaygroundEnvironment extends ILankaBlobCacheEnvironment {
	urls: string[];
}

/**
 * The browser, as far as the cache can tell.
 *
 * Object URLs are tracked rather than counted: a cache that issues one per
 * render and revokes none leaks until the tab dies, and only the LIVE set makes
 * that visible.
 */
export const createPlaygroundEnvironment = (
	network: IPlaygroundNetwork,
): IPlaygroundEnvironment => {
	const urls: string[] = [];
	let issued = 0;

	globalThis.fetch = (input: RequestInfo | URL) => {
		// A `Request` has no useful string form, so it is read rather than coerced:
		// stringifying one yields "[object Object]", and every assertion about which
		// URL was fetched would then pass against the same wrong answer.
		const url =
			typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		network.fetched.push(url);

		const blob = network.answers.get(url);
		if (!blob) return Promise.resolve(new Response(null, { status: 404 }));

		return Promise.resolve(new Response(blob, { status: 200 }));
	};

	return {
		urls,
		now: () => Date.now(),
		createObjectUrl: () => {
			issued += 1;
			const url = `blob:playground/${String(issued)}`;
			urls.push(url);
			return url;
		},
		revokeObjectUrl: (url: string) => {
			const at = urls.indexOf(url);
			if (at !== -1) urls.splice(at, 1);
		},
	};
};
