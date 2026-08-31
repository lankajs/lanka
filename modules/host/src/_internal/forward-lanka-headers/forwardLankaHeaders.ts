import { isRecord } from "lanka/internal";
import type { TLankaRequestMiddleware } from "lanka/gateway";

/**
 * Puts the caller's identity on every request this scope makes.
 *
 * Without it, a server-rendered screen fetches as a stranger: the browser's
 * cookie never left the browser, so the API answers 401 and the page renders
 * signed out — then hydrates signed in, because the client-side fetch DOES carry
 * the cookie. That flash is the single most common way a data layer fails in SSR,
 * and it fails silently.
 *
 * A gateway's own header wins: if a request already sets `authorization`, this
 * does not overwrite it. Whoever wrote the call knew something this does not.
 */
export const forwardLankaHeaders = (
	headers: Readonly<Record<string, string>>,
): TLankaRequestMiddleware => {
	const entries = Object.entries(headers);

	return async (ctx, next) => {
		if (entries.length === 0) return next(ctx);

		// A gateway that needs nothing of its transport passes no options at all —
		// `execute(endpoint)` is the common case — so "nothing there yet" is the
		// path that matters most, not an edge. Anything that is neither absent nor
		// a plain object belongs to a transport this does not know, and is left
		// exactly as it came.
		if (ctx.options !== undefined && !isRecord(ctx.options)) return next(ctx);

		const options = isRecord(ctx.options) ? ctx.options : {};
		const existing = isRecord(options.headers) ? options.headers : {};
		const merged: Record<string, unknown> = { ...existing };

		for (const [key, value] of entries) {
			const alreadySet = Object.keys(existing).some(
				(name) => name.toLowerCase() === key.toLowerCase(),
			);
			if (!alreadySet) merged[key] = value;
		}

		return next({ ...ctx, options: { ...options, headers: merged } });
	};
};
