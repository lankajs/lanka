import { atlasCorsHeaders } from "../atlas-cors-headers/atlasCorsHeaders";
import type { ServerResponse } from "node:http";

/** Answers with JSON, and with the headers every answer here carries. */
export const sendAtlasJson = (
	response: ServerResponse,
	status: number,
	body: unknown,
	headers: Record<string, string> = {},
): void => {
	const text = JSON.stringify(body);

	response.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"content-length": String(Buffer.byteLength(text)),
		...atlasCorsHeaders(response.req.headers.origin),
		...headers,
	});
	response.end(text);
};
