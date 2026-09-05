import type { ILankaTransport } from "../_interfaces/ILankaTransport";
import type { TLankaRequestInit } from "../_types/TLankaRequestInit";

/** What an unencoded body is sent as, and the header that says so. */
const CONTENT_TYPE = "content-type";
const JSON_CONTENT_TYPE = "application/json";

/**
 * The network seam: `fetch`, plus the two things `fetch` cannot be told.
 *
 * ## Why there is ONE of these
 *
 * There were three — a plain one, a JSON one and a multipart one — and the split
 * was wrong at birth. `ILankaTransport` exists so a consumer can change the
 * PROTOCOL: a native bridge, a socket, a double that never leaves the process.
 * The three differed in a `content-type` header. That is not a protocol, it is an
 * encoding, and an encoding is a property of the CALL: a gateway with fourteen
 * JSON endpoints and one upload had no way to say so, because its request kind —
 * and with it its transport — was fixed in its constructor. The application that
 * hit this added a `useFormData` flag to its own options and wrote its own
 * transport to read it.
 *
 * So the encoding is decided here, per call, by looking at the body. A gateway
 * posts `FormData` to one endpoint and an object to the next, and neither it nor
 * the request kind has to know.
 *
 * ## What does NOT belong here
 *
 * The base URL (`ALankaGateway` prefixes `apiBaseUrl`), credentials, static
 * headers, CSRF, retry, auth refresh, idempotency keys and deadlines. Every one
 * of those is policy around a request rather than a way of sending one, and every
 * one is a middleware — `useRequestMiddleware`, which `@lankajs/plugin-http`
 * occupies. A transport that grew them would be a second composition mechanism
 * beside the one core already publishes, and "where does a header get added"
 * would have two answers.
 */
export class LankaFetchTransport implements ILankaTransport<TLankaRequestInit> {
	async request(resource: RequestInfo, options?: TLankaRequestInit): Promise<Response> {
		// Nothing to encode: the object the caller assembled reaches `fetch`
		// unchanged, `undefined` included. "No options" and "empty options" are
		// different statements and `fetch` is entitled to tell them apart.
		if (options === undefined || options.body === undefined || options.body === null) {
			return await fetch(resource, options as RequestInit | undefined);
		}

		const { body, headers } = options;

		// Multipart: the header is REMOVED, not set. The boundary is generated with
		// the body, and a hand-written `content-type` carries none — the server then
		// reads zero fields out of a request that looks correct.
		if (isFormData(body)) {
			if (headers === undefined) return await fetch(resource, options as RequestInit);

			const stripped = new Headers(headers);
			stripped.delete(CONTENT_TYPE);
			return await fetch(resource, { ...options, headers: stripped } as RequestInit);
		}

		// Already something `fetch` understands: untouched.
		if (isEncodedBody(body)) return await fetch(resource, options as RequestInit);

		return await fetch(resource, {
			...options,
			headers: withJsonContentType(headers),
			body: JSON.stringify(body),
		});
	}
}

/**
 * The header set, with `content-type` filled in only if the caller left it out.
 *
 * Not overwritten: `application/merge-patch+json` and `application/ld+json` are
 * JSON that a server distinguishes, and a transport that flattened them to
 * `application/json` would turn a PATCH into a request the server refuses — for
 * a header the caller had already written correctly.
 */
function withJsonContentType(headers: HeadersInit | undefined): Headers {
	const result = new Headers(headers);
	if (!result.has(CONTENT_TYPE)) result.set(CONTENT_TYPE, JSON_CONTENT_TYPE);
	return result;
}

/**
 * Whether `fetch` can already send this body.
 *
 * Every global here is guarded by `typeof`: core runs in node and React Native
 * as well as a browser, and `ReadableStream` in particular is absent on engines
 * this framework supports. An unguarded `instanceof` against a missing global is
 * a `ReferenceError` on the first request, from a transport, in production.
 *
 * Cheapest and most common first. A string — an already-serialised body — stops
 * on line one.
 */
function isEncodedBody(body: unknown): body is BodyInit {
	if (typeof body === "string") return true;
	if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return true;
	if (typeof Blob !== "undefined" && body instanceof Blob) return true;
	if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return true;
	return typeof ReadableStream !== "undefined" && body instanceof ReadableStream;
}

/**
 * Multipart, checked separately because it is the one body whose header is
 * removed rather than added.
 */
function isFormData(body: unknown): body is FormData {
	return typeof FormData !== "undefined" && body instanceof FormData;
}
