import { atlasCorsHeaders } from "../routing/atlas-cors-headers/atlasCorsHeaders";
import type { AtlasChanges } from "../atlas-changes/AtlasChanges";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * How often to write a comment line nobody reads.
 *
 * Proxies and load balancers close a connection that has carried nothing for a
 * while, and an SSE stream on a quiet afternoon carries nothing for a while by
 * definition. The client survives it — it reconnects — but every reconnection
 * makes every screen refetch, so the quiet link is the one worth keeping open.
 */
const KEEP_ALIVE_MS = 15_000;

/**
 * Holds one server-sent stream open and writes every change to it.
 *
 * Named events (`event: mission.completed`) rather than anonymous ones, because
 * that is what `@lankajs/plugin-sse` subscribes with: a bridge asks for a type,
 * and the transport attaches a listener for exactly that name. An anonymous
 * stream would work too — the transport reads `type` out of the body — but then
 * every client receives every event and filters it themselves.
 *
 * The envelope is `{ trigger, payload }`, which is the shape the transport
 * unwraps. A bare payload is also accepted there; this sends the full one
 * because it is the shape that survives a second reader being added.
 */
export const streamAtlasEvents = (
	request: IncomingMessage,
	response: ServerResponse,
	changes: AtlasChanges,
): void => {
	response.writeHead(200, {
		"content-type": "text/event-stream; charset=utf-8",
		"cache-control": "no-cache, no-transform",
		connection: "keep-alive",
		...atlasCorsHeaders(request.headers.origin),
	});

	// A first write, immediately: until something crosses, a browser has not
	// finished opening the stream, and `onopen` on the client has not fired.
	response.write(": the atlas stream is open\n\n");

	const stop = changes.listen((change) => {
		response.write(
			`event: ${change.type}\n` +
				`data: ${JSON.stringify({ trigger: change.type, payload: change.payload })}\n\n`,
		);
	});

	const keepAlive = setInterval(() => response.write(": still here\n\n"), KEEP_ALIVE_MS);

	// Both, and on the REQUEST: a client that navigates away closes the socket
	// without ending the response, and a listener left behind writes to a dead
	// stream on every change for the life of the process.
	request.on("close", () => {
		clearInterval(keepAlive);
		stop();
	});
};
