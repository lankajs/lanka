import type { ILankaApiError } from "../_interfaces/ILankaApiError";
import type { ILankaFieldError } from "../_interfaces/ILankaFieldError";

/**
 * How a request ended.
 *
 * Six kinds rather than one, for one reason: each demands something DIFFERENT of
 * the interface. A distinction that implies no different behaviour is
 * superfluous, which is why there is no seventh.
 */
export type TLankaErrorKind =
	/** Never reached the server: dropped link, DNS failure, no network. Offer a retry. */
	| "network"
	/** Reached it; the response never came. Also a retry, but a different message. */
	| "timeout"
	/** Cancelled by the caller. Nothing to show: the user left. */
	| "aborted"
	/** The server answered with an error status; what to show depends on it. */
	| "http"
	/** A response arrived in the wrong shape. A break, not the user's fault. */
	| "schema"
	/** The server refused deliberately and named the reason. Show what it said. */
	| "domain";

export interface ILankaErrorInit {
	kind: TLankaErrorKind;
	message: string;
	/** HTTP status, when there was one. */
	status?: number;
	/** The domain failure code — what the application branches on. */
	code?: string;
	/** Details: server messages, or paths to the fields that failed validation. */
	issues?: readonly string[];
	/**
	 * The failures that have an input to be shown at, with the path in segments.
	 *
	 * Beside `issues` rather than instead of it: `issues` is the banner's list and
	 * is promised; this is the form's, and a failure may have either, both or
	 * neither. Absent means "nothing here has an address", not "unknown".
	 */
	fields?: readonly ILankaFieldError[];
	/**
	 * The parsed ERROR response body, when there was one and it was JSON.
	 *
	 * Travels with the error because a `Response` is read once: without this field
	 * a plugin extracting the domain failure code would read an already-drained
	 * stream and get nothing. Core does not look into the body; it carries it.
	 */
	body?: unknown;
	/** The app went to the background during the attempt. See `LankaError.isFromBackground`. */
	isFromBackground?: boolean;
	/** The original error, when this one wraps it. */
	cause?: unknown;
}

/**
 * One failure type for every layer of the framework.
 *
 * Without a tagged kind, an app cannot tell a network failure from a timeout,
 * from a broken schema, from a deliberate domain refusal — so it builds its own
 * error contract ON TOP of the framework, and builds it once per application.
 *
 * Implements `ILankaApiError`: `status` and `errors` are present, so code reading
 * them the old way keeps working.
 *
 * What is NOT here: parsing a particular response body format. Which JSON a
 * backend sends is policy, and policy lives in `@lankajs/plugin-http`. Core knows
 * only that it has a failure and must name its kind.
 */
export class LankaError extends Error implements ILankaApiError {
	readonly kind: TLankaErrorKind;
	readonly status?: number;
	readonly code?: string;
	readonly issues?: readonly string[];
	/**
	 * The failures with an input to be shown at. See `ILankaErrorInit.fields`.
	 *
	 * The array given is the array kept — unlike `errors`, which copies `issues`
	 * on every read. `readonly` carries the promise, and this is read on the way
	 * to a form, once, where a copy would buy nothing.
	 */
	readonly fields?: readonly ILankaFieldError[];
	/** The parsed error response body; core carries it without reading it. */
	readonly body?: unknown;
	/**
	 * The app went to the background while the attempt was on the wire: the page
	 * was seen to hide, or to unload. Set by the framework on the `network` and
	 * `aborted` failures it tags; `false` everywhere else.
	 *
	 * What it tells is WHEN, not why. On a mobile WebView it usually means the
	 * page was frozen and the platform cut the request; on a desktop tab that kept
	 * running, the server may just as well have failed. Segment telemetry by it —
	 * do not drop what it marks. Never on a `timeout`: the deadline stops while
	 * the page is hidden, so one that still ran out was slow in plain sight.
	 *
	 * Read it as truthy: a `LankaError` from an older copy of the framework in
	 * the same tree passes `LankaError.is` without it.
	 */
	readonly isFromBackground: boolean;

	constructor(init: ILankaErrorInit) {
		super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
		this.name = "LankaError";
		this.kind = init.kind;
		this.status = init.status;
		this.code = init.code;
		this.issues = init.issues;
		this.fields = init.fields;
		this.body = init.body;
		this.isFromBackground = init.isFromBackground ?? false;

		// The prototype chain is pinned explicitly: without it `instanceof` breaks
		// for a consumer whose bundler downlevels to ES5, and breaks silently —
		// `catch` simply fails to recognise its own error.
		Object.setPrototypeOf(this, LankaError.prototype);
	}

	/** The `ILankaApiError` field. The details are the message list. */
	get errors(): string[] | undefined {
		return this.issues ? [...this.issues] : undefined;
	}

	/**
	 * Whether to show this to the user.
	 *
	 * A cancelled request is the one failure that must NOT be reported: its cause
	 * is that the user left before the response, and a toast would catch them on
	 * another screen.
	 */
	get isSilent(): boolean {
		return this.kind === "aborted";
	}

	/**
	 * Recognises our error among others.
	 *
	 * Checks the name rather than `instanceof` alone: a consumer may end up with
	 * two copies of the package — adjacent majors in the dependency tree — and
	 * then `instanceof` answers `false` for an error that is ours by every other
	 * sign.
	 */
	static is(value: unknown): value is LankaError {
		return (
			value instanceof LankaError || (value instanceof Error && value.name === "LankaError")
		);
	}
}
