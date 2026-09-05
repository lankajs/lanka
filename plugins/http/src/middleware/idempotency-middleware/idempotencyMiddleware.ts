import { generateUuid } from "lanka/internal";
import type { TLankaRequestMiddleware } from "lanka/gateway";
import { lankaUnsafeMethods } from "../../config/lankaUnsafeMethods";

export interface ILankaHttpIdempotencyConfig {
	/** Methods the key is added to. All unsafe ones by default. */
	methods?: readonly string[];
	/** Header name. Defaults to `Idempotency-Key`. */
	header?: string;
	/**
	 * How the key is produced. A uuid by default.
	 *
	 * The value must NOT be built from user text: backends usually restrict the
	 * key to a narrow character set and reject the rest, so the request fails
	 * somewhere other than where the mistake was made.
	 */
	generateKey?: () => string;
}

/**
 * The key by which a server recognises a retried request and does not perform it
 * twice.
 *
 * ## Why the key is issued HERE rather than inside the retry loop
 *
 * This is the one mistake that makes retry MORE dangerous than its absence. A key
 * minted per attempt turns a retry into an honest second request: the server sees
 * a different key, reads it as a new intent and creates a second object — a
 * payment, an invitation. Without retry the user would see an error and press
 * again; with this retry they see nothing and there are two objects.
 *
 * So this middleware registers FIRST and wraps retry: the key is issued once per
 * logical intent and every attempt inside carries it.
 */
export const createIdempotencyMiddleware = (
	config: ILankaHttpIdempotencyConfig,
): TLankaRequestMiddleware => {
	const methods = (config.methods ?? lankaUnsafeMethods).map((method) => method.toUpperCase());
	const header = config.header ?? "Idempotency-Key";
	const generateKey = config.generateKey ?? generateUuid;

	return (ctx, next) => {
		const options = (ctx.options ?? {}) as RequestInit;
		const method = (options.method ?? "GET").toUpperCase();
		if (!methods.includes(method)) return next(ctx);

		const headers = new Headers(options.headers);
		// A caller's own key is not overridden: they may have built it so that
		// repeating the user's GESTURE also counts as the same intent.
		if (!headers.has(header)) headers.set(header, generateKey());

		return next({ ...ctx, options: { ...options, headers } });
	};
};
