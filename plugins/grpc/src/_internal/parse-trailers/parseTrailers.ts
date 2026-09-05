/**
 * The trailers block: `name: value` lines, as HTTP writes them.
 *
 * Names are lower-cased because HTTP header names are case-insensitive and the
 * one field anybody reads — `grpc-status` — has been seen spelled three ways by
 * three proxies. A reader that matched exactly would report a missing status for
 * a response that carried one, and a missing status is read as a schema failure.
 *
 * `\r\n` is the specified separator and `\n` alone is what several
 * implementations send; both are accepted, because refusing the second loses the
 * status entirely rather than loudly.
 */
export const parseTrailers = (text: string): Record<string, string> => {
	const trailers: Record<string, string> = {};

	for (const line of text.split(/\r?\n/)) {
		const at = line.indexOf(":");
		if (at <= 0) continue;

		trailers[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
	}

	return trailers;
};
