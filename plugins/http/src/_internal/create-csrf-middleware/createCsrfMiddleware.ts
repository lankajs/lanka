import type { TLankaRequestMiddleware } from "lanka/gateway";
import { lankaUnsafeMethods } from "../../config/lankaUnsafeMethods";
import type { ILankaHttpConfig } from "../../_interfaces/ILankaHttpConfig";

type TCsrfConfig = NonNullable<ILankaHttpConfig["csrf"]>;

/**
 * Adds the origin-confirmation header to unsafe methods.
 *
 * Headers are ADDED, never replaced: the request may carry its own, and
 * replacing the set would silently drop `content-type`, after which the server
 * reads the body wrongly or not at all.
 */
export const createCsrfMiddleware = (config: TCsrfConfig): TLankaRequestMiddleware => {
	const methods = (config.methods ?? lankaUnsafeMethods).map((method) => method.toUpperCase());

	return (ctx, next) => {
		const options = (ctx.options ?? {}) as RequestInit;
		// `GET` is the default: `fetch` without a method is a GET, and treating it as
		// unsafe would add the header to everything.
		const method = (options.method ?? "GET").toUpperCase();
		if (!methods.includes(method)) return next(ctx);

		const headers = new Headers(options.headers);
		headers.set(config.header, config.value);

		return next({ ...ctx, options: { ...options, headers } });
	};
};
