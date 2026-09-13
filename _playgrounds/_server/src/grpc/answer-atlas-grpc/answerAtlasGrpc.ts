import { atlasCorsHeaders } from "../../routing/atlas-cors-headers/atlasCorsHeaders";
import { frameAtlasGrpcMessage } from "../frame-atlas-grpc-message/frameAtlasGrpcMessage";
import type { AtlasWorld } from "../../atlas-world/AtlasWorld";
import type { IncomingMessage, ServerResponse } from "node:http";

/** The content type of the JSON codec, which is the one these clients use. */
const CONTENT_TYPE = "application/grpc-web+json";

/** `PERMISSION_DENIED`, by its number. The client maps it back to the name. */
const PERMISSION_DENIED = 7;

const headersFor = (request: IncomingMessage): Record<string, string> => ({
	"content-type": CONTENT_TYPE,
	...atlasCorsHeaders(request.headers.origin),
});

/** Writes a message and then the trailers that say the call succeeded. */
const answerOne = (response: ServerResponse, message: unknown): void => {
	response.write(frameAtlasGrpcMessage(Buffer.from(JSON.stringify(message), "utf8")));
	response.end(frameAtlasGrpcMessage(Buffer.from("grpc-status:0\r\n", "utf8"), true));
};

/** How the board looks right now, as one message. */
const summaryOf = (world: AtlasWorld): Record<string, number> => {
	const missions = world.missions();

	return {
		queued: missions.filter((one) => one.status === "queued").length,
		active: missions.filter((one) => one.status === "active").length,
		done: missions.filter((one) => one.status === "done").length,
	};
};

/**
 * A server stream: one frame per change, for as long as the client is there.
 *
 * The first frame goes out immediately. A stream whose first message waits for
 * something to happen is indistinguishable, from the client's side, from a
 * stream that never connected.
 */
const watch = (request: IncomingMessage, response: ServerResponse, world: AtlasWorld): void => {
	response.writeHead(200, headersFor(request));
	response.write(
		frameAtlasGrpcMessage(Buffer.from(JSON.stringify({ kind: "opened", ...summaryOf(world) }))),
	);

	const stop = world.changes.listen((change) => {
		response.write(
			frameAtlasGrpcMessage(
				Buffer.from(JSON.stringify({ kind: change.type, ...summaryOf(world) })),
			),
		);
	});

	request.on("close", stop);
};

/**
 * A refusal the server MEANT, in the place a refusal actually arrives.
 *
 * Trailers-only: a call refused before any message has no body to put the status
 * in, so it goes in the HTTP headers. A client that knew only the trailers would
 * report a schema failure for an ordinary permission denial — which is why
 * `LankaGrpcRequest` reads both, and why this route exists to prove it.
 */
const refuse = (request: IncomingMessage, response: ServerResponse): void => {
	response.writeHead(200, {
		...headersFor(request),
		"grpc-status": String(PERMISSION_DENIED),
		"grpc-message": encodeURIComponent("the board is not yours to watch"),
	});
	response.end();
};

/**
 * gRPC-Web over HTTP, for the three shapes a client has to get right.
 *
 * A unary call, a server stream, and a refusal that arrives in the headers.
 * There is no protobuf here and there will not be: the codec belongs to whatever
 * generated the message types, and `application/grpc-web+json` is the one the
 * framework ships a codec for — which is also the one whose wire a person can
 * read while debugging.
 */
export const answerAtlasGrpc = (
	request: IncomingMessage,
	response: ServerResponse,
	world: AtlasWorld,
	path: string,
): boolean => {
	if (path === "/atlas.v1.Board/Summary") {
		response.writeHead(200, headersFor(request));
		answerOne(response, summaryOf(world));
		return true;
	}

	if (path === "/atlas.v1.Board/Watch") {
		watch(request, response, world);
		return true;
	}

	if (path === "/atlas.v1.Board/Restricted") {
		refuse(request, response);
		return true;
	}

	return false;
};
