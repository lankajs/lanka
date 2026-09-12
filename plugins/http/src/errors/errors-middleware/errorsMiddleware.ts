import { LankaError } from "lanka/errors";
import type { ILankaFieldError } from "lanka/errors";
import type { TLankaRequestMiddleware } from "lanka/gateway";
import { lankaCodeFromErrorCode } from "../lanka-code-from-error-code/lankaCodeFromErrorCode";

export interface ILankaHttpErrorsConfig {
	/**
	 * Extracts the domain failure code from the body. Defaults to `errorCode`, else
	 * `error`.
	 */
	extractCode?: (body: unknown) => string | undefined;
	/**
	 * Extracts the message from the body. Called ALWAYS and beats what core found:
	 * core knows one shape (`message` as a string), while the application knows
	 * which shape this backend uses.
	 */
	extractMessage?: (body: unknown) => string | undefined;
	/**
	 * Extracts the failures that have an INPUT to be shown at, each with its
	 * address. `lankaFieldsFromErrorMap` reads the common `{ errors: { field:
	 * [...] } }`.
	 *
	 * Beside `extractMessage` rather than instead of it: a banner shows one
	 * sentence, a form shows one message per input, and a 422 usually deserves
	 * both. What comes back lands on `LankaError.fields`, where a ViewModel reads
	 * it with `readLankaFieldErrors` and hands it to whatever holds the inputs.
	 */
	extractFieldErrors?: (body: unknown) => readonly ILankaFieldError[] | undefined;
	/**
	 * Called on every server failure. Where an application hangs its analytics.
	 *
	 * One application reports every failure, another reports none. The difference
	 * is configuration, not a branch inside the plugin.
	 */
	onRequestFailed?: (info: { status?: number; code?: string; endpoint: string }) => void;
}

/**
 * Completes a server failure into something the application can branch on.
 *
 * Core provides `LankaError{kind:"http"}` with the status, the host's text and
 * the PARSED body. Here the domain code is extracted from that body — the part a
 * screen decides on.
 *
 * ## Middleware rather than a gateway error handler
 *
 * A `Response` is read once. A handler placed second would get a drained stream
 * and an empty body — silently. The body travels with the error, and parsing
 * works from it.
 */
export const createErrorsMiddleware = (config: ILankaHttpErrorsConfig): TLankaRequestMiddleware => {
	const extractCode = config.extractCode ?? lankaCodeFromErrorCode;

	return async (ctx, next) => {
		try {
			return await next(ctx);
		} catch (error) {
			// Not a server failure, not our business. A network failure, a
			// cancellation and a broken schema are already named by kind, and
			// rewriting them here would take from the caller the one thing the kind
			// exists for.
			if (!LankaError.is(error) || error.kind !== "http") throw error;

			const code = read(extractCode, error.body);
			const message = read(config.extractMessage, error.body);
			const fields = read(config.extractFieldErrors, error.body);

			notify(config.onRequestFailed, {
				status: error.status,
				code,
				endpoint: ctx.endpoint,
			});

			if (code === undefined && message === undefined && fields === undefined) throw error;

			throw new LankaError({
				kind: "http",
				message: message ?? error.message,
				status: error.status,
				code,
				issues: message ? [message] : error.issues,
				fields,
				body: error.body,
				cause: error.cause,
			});
		}
	};
};

/**
 * An extractor must not replace the failure it was reading.
 *
 * Each one is the CONSUMER'S code running inside a failure path, over a body
 * whose shape is the server's guess. When it throws, the alternative to
 * answering nothing is showing the user the failure of the failure REPORT —
 * "cannot read property of undefined" where the server said something useful —
 * and losing the original cause with it. Answering nothing falls back to the
 * status and the host's text, which is always renderable.
 */
function read<TFound>(
	extract: ((body: unknown) => TFound | undefined) | undefined,
	body: unknown,
): TFound | undefined {
	if (!extract) return undefined;
	try {
		return extract(body);
	} catch {
		return undefined;
	}
}

/**
 * A notification must not break the request.
 *
 * Analytics observes a failure without being part of it. An exception inside it
 * would replace the server's error with the error of reporting it: the user
 * would see the wrong thing and the original cause would vanish.
 */
function notify(
	onRequestFailed: ILankaHttpErrorsConfig["onRequestFailed"],
	info: { status?: number; code?: string; endpoint: string },
): void {
	if (!onRequestFailed) return;
	try {
		onRequestFailed(info);
	} catch {
		/* see the docblock */
	}
}
