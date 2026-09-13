import type { IncomingMessage } from "node:http";

/** How much a client may send before the server stops listening. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Reads a request body, and answers `null` when there was none.
 *
 * `null` rather than `{}`, because a PATCH carrying no body and a PATCH carrying
 * `{}` mean different things: the first is a mistake and the second is "change
 * nothing". A reader that flattened them would accept the mistake silently.
 *
 * The ceiling is not decoration either. Without one, a client that opens a
 * request and never finishes it holds a buffer that grows for as long as it
 * cares to send — which is a memory leak with a user agent attached.
 */
export const readAtlasBody = async (request: IncomingMessage): Promise<unknown> => {
	const chunks: Buffer[] = [];
	let size = 0;

	for await (const chunk of request) {
		const bytes = chunk as Buffer;
		size += bytes.length;
		if (size > MAX_BODY_BYTES) throw new Error("the request body is too large");
		chunks.push(bytes);
	}

	const text = Buffer.concat(chunks).toString("utf8").trim();
	if (text.length === 0) return null;

	return JSON.parse(text) as unknown;
};
