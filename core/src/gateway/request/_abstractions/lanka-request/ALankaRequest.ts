import type { TLankaRequestInit } from "../../../_types/TLankaRequestInit";
import type { TLankaErrorHandler } from "../../../../errors/_types/TLankaErrorHandler";
import type { ILankaRequest } from "../../../_interfaces/ILankaRequest";
import type { TLankaExecuteOptions } from "../../../_types/TLankaExecuteOptions";
import { handleLankaApiError } from "../../../../errors/handle-lanka-api-error/handleLankaApiError";
import { getLankaFlags } from "../../../../config/get-lanka-flags/getLankaFlags";
import { getLankaHost } from "../../../../config/get-lanka-host/getLankaHost";
import { lankaHttpInFlight } from "../../../inflight/lankaHttpInFlight";
import { LankaError } from "../../../../errors/lanka-error/LankaError";
import { getActiveRuntime } from "../../../../_internal/active-runtime/activeRuntime";
import { composeLankaRequestMiddleware } from "../../lankaRequestMiddleware";
import type { ILankaRequestContext } from "../../lankaRequestMiddleware";

/**
 * Tags whatever the transport threw with a kind.
 *
 * Here rather than in the transports: `execute` is the single point EVERY
 * request passes through, and tagging in each of the four transports would be
 * four places to forget it.
 *
 * A real `fetch` throws `TypeError` on a broken connection and a `DOMException`
 * named `AbortError` on cancellation; it does not throw on a status code at all.
 *
 * An already-tagged error is NOT re-tagged: a request-policy plugin may report
 * `domain`, and rewriting that to `network` would lose the one thing the kind
 * exists for.
 */
function classifyTransportError(error: unknown, timedOut: boolean): LankaError {
	if (LankaError.is(error)) return error;

	// The name is read off ANYTHING, not only off `Error`.
	//
	// `DOMException` — how `fetch` reports cancellation — does not extend `Error`
	// everywhere: in a browser yes, in jsdom no. An `instanceof Error` check lets
	// cancellation past the tagging, and a raw `AbortError` reaches the app with
	// neither `kind` nor `status`: retry policy reads it as non-retryable and the
	// app as an unknown error, so a cancelled request is shown to the user as a
	// failure.
	const name = readErrorName(error);
	const isAbort = name === "AbortError" || name === "TimeoutError";
	if (isAbort) {
		// Only whoever assembled the lifetime knows who aborted: `AbortSignal` has
		// one `abort` for everyone. The distinction carries a decision — a timeout
		// is shown, a cancellation is not.
		const timedOutHere = timedOut || name === "TimeoutError";
		return new LankaError({
			kind: timedOutHere ? "timeout" : "aborted",
			message: timedOutHere ? getLankaHost().timeoutErrorMessage() : readErrorMessage(error),
			cause: error,
		});
	}

	// `network` ONLY for what looks like a transport failure. A real `fetch`
	// throws `TypeError`; everything else comes from code we did not write — the
	// app's error handler, a response transformer, a broken plugin — and calling
	// that a network failure would invite the user to retry a request that
	// arrived and was processed.
	//
	// Unknown stays unknown and passes through. The framework asserts only what
	// it knows.
	if (error instanceof TypeError) {
		return new LankaError({
			kind: "network",
			message: getLankaHost().networkErrorMessage(),
			issues: [error.message],
			cause: error,
		});
	}

	return error as LankaError;
}

/** The error name, off `Error`, `DOMException` or anything else carrying one. */
function readErrorName(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) return undefined;
	const name: unknown = (error as { name?: unknown }).name;
	return typeof name === "string" ? name : undefined;
}

/**
 * The error text, when there is one.
 *
 * An object without `message` is not stringified: `String({})` yields
 * `[object Object]`, which occupies the message slot and says nothing. Empty is
 * more honest.
 */
function readErrorMessage(error: unknown): string {
	if (typeof error === "string") return error;
	if (typeof error !== "object" || error === null) return "";
	const message: unknown = (error as { message?: unknown }).message;
	return typeof message === "string" ? message : "";
}

/**
 * How a gateway request goes on the wire.
 *
 * A subclass declares one method, `request()`, and does only its own work there:
 * `LankaFetchJsonRequest` returns parsed JSON, `LankaFetchRequest` returns the
 * whole response, a custom kind returns whatever it likes.
 *
 * Overriding `request()` customises the request flow, failure handling, mock
 * substitution, response transformation and log interception.
 */
export abstract class ALankaRequest<
	TOptions = TLankaRequestInit,
> implements ILankaRequest<TOptions> {
	protected readonly errorHandler?: TLankaErrorHandler;
	protected readonly useMock: boolean;

	protected constructor(config: { errorHandler?: TLankaErrorHandler; useMock?: boolean }) {
		const flags = getLankaFlags();

		// The default error-body handler lives HERE because the request is the only
		// thing that sees the `Response`. Put on the gateway it would sit in a field
		// nobody reads — the request takes the handler from ITS OWN config — and a
		// consumer passing `errorHandler` to the gateway would get silence.
		//
		// The parse is cheap: core reads the body once and takes `message` from it;
		// backend-specific shapes are parsed by `@lankajs/plugin-http`.
		this.errorHandler = config.errorHandler ?? handleLankaApiError;

		this.useMock = config.useMock ?? flags.isMockMode ?? false;
	}

	/**
	 * Performs the request and returns its result — a response, JSON or a custom
	 * type.
	 *
	 * @param endpoint Full URL
	 * @param options Transport-specific options
	 * @param mockHandler Mock, when there is one
	 */
	protected abstract request<TReturn = Response>(
		endpoint: string,
		options?: TOptions,
		mockHandler?: () => Promise<TReturn>,
	): Promise<TReturn>;

	/**
	 * The single point EVERY gateway request passes through.
	 *
	 * Hence the in-flight accounting here: intent prefetch stands down while
	 * anything else is on the wire. The `finally` matters more than the increment —
	 * a rejected request that never decremented would disable prefetching for the
	 * rest of the session.
	 */
	public async execute<TReturn = Response>(
		endpoint: string,
		options?: TLankaExecuteOptions<TOptions>,
		mockHandler?: () => Promise<TReturn>,
	): Promise<TReturn> {
		const runtime = getActiveRuntime();
		const { signal, timeoutMs, ...rest } = (options ?? {}) as TLankaExecuteOptions<TOptions>;
		// The caller's deadline travels IN THE CONTEXT, not only in the closure:
		// otherwise a policy assigning deadlines per request class could not tell
		// "no deadline given" from "given by the caller" and would override an
		// explicit request with a blanket default.
		const fallbackDeadline = runtime?.requestTimeoutMs;

		// No options passed means none are produced. Destructuring yields `{}` even
		// from `undefined`, and handing that empty object to the transport would
		// change the request: "no options" and "empty options" are different
		// statements, and the transport is entitled to tell them apart.
		const passedOptions: unknown = options === undefined ? undefined : rest;

		/*
		 * The lifetime is assembled PER ATTEMPT, not per call, and that does two
		 * things at once.
		 *
		 * Under retry a shared deadline would start the third attempt with whatever
		 * the first two left, so the retry aborts before reaching the server.
		 *
		 * And it is the only way to let middleware set the deadline: `ctx.timeoutMs`
		 * is read on every attempt, which is how a request-policy plugin assigns a
		 * deadline per request CLASS — a file upload and a list read cannot share
		 * one value.
		 *
		 * Caller cancellation stays end-to-end: one `signal` for all attempts.
		 */
		let lastTimedOut = false;

		// Tagging happens INSIDE, around the request itself, not in the outer
		// catch: middleware must receive an already-tagged error, or a retrying
		// middleware cannot tell a network failure from a domain rejection and
		// retries what must not be retried. The outer catch stays as a backstop.
		const perform = async (ctx: ILankaRequestContext): Promise<unknown> => {
			const lifetime = createRequestLifetime(signal, ctx.timeoutMs ?? fallbackDeadline);
			try {
				return await this.request<TReturn>(
					ctx.endpoint,
					withSignal(ctx.options, lifetime.signal) as TOptions,
					mockHandler,
				);
			} catch (error) {
				lastTimedOut = lifetime.timedOut();
				throw classifyTransportError(error, lastTimedOut);
			} finally {
				lifetime.dispose();
			}
		};

		const run = composeLankaRequestMiddleware(runtime?.requestMiddleware ?? [], perform);

		lankaHttpInFlight.begin();
		try {
			// The chain runs INSIDE the same guard as the request. A catch placed
			// outside would leave a permanent +1 when a plugin throws, disabling
			// prefetch for the rest of the session — the very defect this `finally`
			// exists to prevent.
			return (await run({
				endpoint,
				options: passedOptions,
				attempt: 1,
				timeoutMs,
			})) as TReturn;
		} catch (error) {
			throw classifyTransportError(error, lastTimedOut);
		} finally {
			lankaHttpInFlight.end();
		}
	}
}

interface IRequestLifetime {
	readonly signal: AbortSignal | undefined;
	/** Whether OUR timer aborted the request rather than the caller. */
	timedOut(): boolean;
	dispose(): void;
}

/**
 * Combines the caller's signal and our own timeout into one request lifetime.
 *
 * The outcome looks the same — an interrupted request — but the decisions
 * differ: a timeout is shown and offered for retry, a user cancellation is not
 * shown at all. `AbortSignal` does not distinguish them: one `abort`, whose
 * reason belongs to whoever got there first. Hence the private flag.
 *
 * Not `AbortSignal.timeout` alone: it cannot combine with a foreign signal
 * without `AbortSignal.any`, which older engines lack. Assembling by hand works
 * everywhere and costs one listener.
 */
function createRequestLifetime(
	external: AbortSignal | undefined,
	timeoutMs: number | undefined,
): IRequestLifetime {
	if (!external && !timeoutMs) {
		return { signal: undefined, timedOut: () => false, dispose: () => undefined };
	}

	const controller = new AbortController();
	let expired = false;

	const timer =
		timeoutMs === undefined
			? undefined
			: setTimeout(() => {
					expired = true;
					controller.abort(new DOMException("Request timed out", "TimeoutError"));
				}, timeoutMs);

	const onExternalAbort = (): void => {
		controller.abort(external?.reason);
	};

	if (external) {
		if (external.aborted) onExternalAbort();
		else external.addEventListener("abort", onExternalAbort, { once: true });
	}

	return {
		signal: controller.signal,
		timedOut: () => expired,
		dispose: () => {
			if (timer !== undefined) clearTimeout(timer);
			external?.removeEventListener("abort", onExternalAbort);
		},
	};
}

/**
 * Attaches the signal to the options, inventing nothing.
 *
 * With no options and no signal the transport receives `undefined` — exactly
 * what the caller passed. An empty object instead looks harmless but is a
 * different statement, and the transport is entitled to tell them apart.
 */
function withSignal(options: unknown, signal: AbortSignal | undefined): unknown {
	if (signal === undefined) return options;
	return { ...(options ?? {}), signal };
}
