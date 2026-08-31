import type { TLankaIncomingHeaders } from "../../_types/TLankaIncomingHeaders";

/**
 * Headers that carry WHO is asking, and nothing else.
 *
 * An allow-list rather than "everything the browser sent": `host`,
 * `content-length` and `accept-encoding` describe the browser's connection to the
 * host framework, not the framework's connection to the API, and forwarding them
 * produces requests that are wrong in ways that take an afternoon to find.
 *
 * Module-private: an application that needs another header names it per call
 * through `forward`, which leaves one place to read rather than two.
 */
const FORWARDED = Object.freeze(["cookie", "authorization"]);

/**
 * Whether the host handed over a `Headers`-like object rather than a plain one.
 *
 * A predicate and not an inline check, so the union narrows for the branch after
 * it: read inline, `Object.entries` of a union with a method in it is `any`, and
 * the values would reach the request untyped.
 */
const isHeadersLike = (
	incoming: TLankaIncomingHeaders,
): incoming is { forEach: (visit: (value: string, key: string) => void) => void } =>
	"forEach" in incoming && typeof incoming.forEach === "function";

/** The named headers, lower-cased, from whatever shape the host handed over. */
export const readLankaHeaders = (
	incoming: TLankaIncomingHeaders,
	allow: readonly string[] = FORWARDED,
): Record<string, string> => {
	const wanted = new Set(allow.map((name) => name.toLowerCase()));
	const found: Record<string, string> = {};

	if (isHeadersLike(incoming)) {
		incoming.forEach((value, key) => {
			if (wanted.has(key.toLowerCase())) found[key.toLowerCase()] = value;
		});
		return found;
	}

	for (const [key, value] of Object.entries(incoming)) {
		if (value !== undefined && wanted.has(key.toLowerCase())) found[key.toLowerCase()] = value;
	}

	return found;
};
