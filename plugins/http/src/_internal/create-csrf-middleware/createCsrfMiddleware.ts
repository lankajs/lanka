import { getLankaHost } from "lanka/config";
import type { TLankaRequestMiddleware } from "lanka/gateway";
import { lankaUnsafeMethods } from "../../config/lankaUnsafeMethods";
import type { ILankaHttpConfig } from "../../_interfaces/ILankaHttpConfig";

type TCsrfConfig = NonNullable<ILankaHttpConfig["csrf"]>;

/**
 * A scheme or a leading `//`: an address that names its own host.
 *
 * Anything else is resolved against the page, which is where the session cookie
 * lives and therefore exactly where the proof belongs.
 */
const namesItsOwnHost = (endpoint: string): boolean =>
	/^[a-z][a-z\d+\-.]*:/i.test(endpoint) || endpoint.startsWith("//");

/** The origin of an address, or `null` for one the URL parser refuses. */
const originOf = (address: string): string | null => {
	try {
		return new URL(address, "https://lanka.invalid").origin;
	} catch {
		return null;
	}
};

/**
 * Whether the request goes to a host the application owns.
 *
 * The API's origin, the page's own, and any the configuration names. A CSRF
 * token is a secret shared with ONE server; sent to a third party's — a file
 * host, an analytics endpoint, a payment provider a gateway writes the whole
 * URL of — it hands that party the one thing standing between a live cookie and
 * a forged request.
 */
const isOwnOrigin = (endpoint: string, allowed: ReadonlySet<string | null>): boolean => {
	if (!namesItsOwnHost(endpoint)) return true;

	return allowed.has(originOf(endpoint));
};

/**
 * The origins a token may be sent to, parsed once and rebuilt when the host moves.
 *
 * This used to run per REQUEST: a `Set` allocated and `new URL(...)` called for
 * every configured origin plus the API base, every time an unsafe request went
 * out. Measured, that was the difference between 572 and 1301 yardsticks on
 * `lankaHttp`'s unsafe path — `new URL` is `whatwg-url`'s JavaScript parser
 * wherever there is no native one, and this parsed three of them to answer a
 * question whose inputs do not change between requests.
 *
 * Keyed on the base URL rather than computed once and kept: a server creates an
 * instance per request, and a cache that held the first host it saw would answer
 * the second deployment's question with the first one's answer. `location`
 * cannot change without a navigation, and a navigation takes the whole module
 * with it.
 */
const createAllowedOrigins = (origins: readonly string[]): (() => ReadonlySet<string | null>) => {
	const configured = origins.map(originOf);

	let cachedFor: string | null = null;
	let allowed: ReadonlySet<string | null> = new Set<string | null>();

	return () => {
		const base = getLankaHost().apiBaseUrl;

		if (base === cachedFor) return allowed;

		const rebuilt = new Set<string | null>(configured);

		rebuilt.add(originOf(base));
		if (typeof location !== "undefined") rebuilt.add(location.origin);

		cachedFor = base;
		allowed = rebuilt;

		return allowed;
	};
};

/**
 * Adds the origin-confirmation header to unsafe methods sent to the
 * application's own hosts.
 *
 * Headers are ADDED, never replaced: the request may carry its own, and
 * replacing the set would silently drop `content-type`, after which the server
 * reads the body wrongly or not at all.
 */
export const createCsrfMiddleware = (config: TCsrfConfig): TLankaRequestMiddleware => {
	const methods = (config.methods ?? lankaUnsafeMethods).map((method) => method.toUpperCase());
	const allowedOrigins = createAllowedOrigins(config.origins ?? []);

	return (ctx, next) => {
		const options = (ctx.options ?? {}) as RequestInit;
		// `GET` is the default: `fetch` without a method is a GET, and treating it as
		// unsafe would add the header to everything.
		const method = (options.method ?? "GET").toUpperCase();
		if (!methods.includes(method)) return next(ctx);
		if (!isOwnOrigin(ctx.endpoint, allowedOrigins())) return next(ctx);

		const headers = new Headers(options.headers);
		headers.set(config.header, config.value);

		return next({ ...ctx, options: { ...options, headers } });
	};
};
