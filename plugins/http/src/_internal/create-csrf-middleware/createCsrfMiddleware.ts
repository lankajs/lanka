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
const isOwnOrigin = (endpoint: string, configured: readonly string[]): boolean => {
	if (!namesItsOwnHost(endpoint)) return true;

	const allowed = new Set(configured.map(originOf));
	allowed.add(originOf(getLankaHost().apiBaseUrl));
	if (typeof location !== "undefined") allowed.add(location.origin);

	return allowed.has(originOf(endpoint));
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
	const origins = config.origins ?? [];

	return (ctx, next) => {
		const options = (ctx.options ?? {}) as RequestInit;
		// `GET` is the default: `fetch` without a method is a GET, and treating it as
		// unsafe would add the header to everything.
		const method = (options.method ?? "GET").toUpperCase();
		if (!methods.includes(method)) return next(ctx);
		if (!isOwnOrigin(ctx.endpoint, origins)) return next(ctx);

		const headers = new Headers(options.headers);
		headers.set(config.header, config.value);

		return next({ ...ctx, options: { ...options, headers } });
	};
};
