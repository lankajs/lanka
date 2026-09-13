import { createServer } from "node:http";
import { answerAtlasGraphql } from "../answer-atlas-graphql/answerAtlasGraphql";
import { answerAtlasGrpc } from "../grpc/answer-atlas-grpc/answerAtlasGrpc";
import { atlasCorsHeaders } from "../routing/atlas-cors-headers/atlasCorsHeaders";
import { AtlasIdempotency } from "../atlas-idempotency/AtlasIdempotency";
import { AtlasSessions } from "../atlas-sessions/AtlasSessions";
import { AtlasSocket } from "../web-socket/atlas-socket/AtlasSocket";
import { AtlasWorld } from "../atlas-world/AtlasWorld";
import { acceptAtlasHandshake } from "../web-socket/accept-atlas-handshake/acceptAtlasHandshake";
import { attachAtlasBoard } from "../web-socket/attach-atlas-board/attachAtlasBoard";
import { attachAtlasGraphqlStream } from "../web-socket/attach-atlas-graphql-stream/attachAtlasGraphqlStream";
import { createAtlasCrewRoutes } from "../rest/create-atlas-crew-routes/createAtlasCrewRoutes";
import { createAtlasMissionRoutes } from "../rest/create-atlas-mission-routes/createAtlasMissionRoutes";
import { createAtlasProbeRoutes } from "../rest/create-atlas-probe-routes/createAtlasProbeRoutes";
import { createAtlasSessionRoutes } from "../rest/create-atlas-session-routes/createAtlasSessionRoutes";
import { matchAtlasRoute } from "../routing/match-atlas-route/matchAtlasRoute";
import { readAtlasBody } from "../routing/read-atlas-body/readAtlasBody";
import { sendAtlasJson } from "../routing/send-atlas-json/sendAtlasJson";
import { streamAtlasEvents } from "../stream-atlas-events/streamAtlasEvents";
import type { IAtlasApi } from "../_interfaces/IAtlasApi";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";

export interface IAtlasServerConfig {
	/** Protected calls a fresh token answers, before a refresh is required. */
	callsPerToken?: number;
}

/** A running API, and the world behind it. */
export interface IAtlasServer {
	world: AtlasWorld;
	sessions: AtlasSessions;
	/** Starts listening, and answers the base URL an application should be given. */
	listen: (port?: number) => Promise<string>;
	close: () => Promise<void>;
}

/** Everything this server answers lives under one prefix. */
const PREFIX = "/api";

const withoutPrefix = (url: string): string | null => {
	const path = new URL(url, "http://atlas.invalid").pathname;

	if (path === PREFIX) return "/";

	return path.startsWith(`${PREFIX}/`) ? path.slice(PREFIX.length) : null;
};

/**
 * The API, assembled.
 *
 * Every wire an application here talks over, on node builtins alone: no express,
 * no ws, no graphql, no grpc runtime. That is not minimalism for its own sake —
 * it is what makes "the applications actually run" a claim somebody can check in
 * one command, on a machine with nothing installed, against a server whose whole
 * behaviour is readable in an afternoon.
 */
export const createAtlasServer = (config: IAtlasServerConfig = {}): IAtlasServer => {
	const api: IAtlasApi = {
		world: new AtlasWorld(),
		sessions: new AtlasSessions({ callsPerToken: config.callsPerToken }),
		created: new AtlasIdempotency(),
	};

	const routes = [
		...createAtlasSessionRoutes(api),
		...createAtlasMissionRoutes(api),
		...createAtlasCrewRoutes(api),
		...createAtlasProbeRoutes(),
	];

	const answer = async (
		request: IncomingMessage,
		response: ServerResponse,
		path: string,
	): Promise<void> => {
		const match = matchAtlasRoute(routes, request.method ?? "GET", path);
		if (!match) return sendAtlasJson(response, 404, { code: "NO_SUCH_ROUTE", path });

		await match.route.run({
			request,
			response,
			params: match.params,
			query: new URL(request.url ?? "/", "http://atlas.invalid").searchParams,
			body: await readAtlasBody(request),
		});
	};

	const route = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
		const path = withoutPrefix(request.url ?? "/");
		if (path === null) return sendAtlasJson(response, 404, { code: "NOT_UNDER_API" });

		// Before the table, because none of the three answers with JSON: a stream
		// that went through `sendAtlasJson` would be a stream with a content-length.
		if (path === "/sse/events") return streamAtlasEvents(request, response, api.world.changes);
		if (path === "/graphql" && request.method === "POST") {
			return answerAtlasGraphql(
				{
					request,
					response,
					params: {},
					query: new URLSearchParams(),
					body: await readAtlasBody(request),
				},
				api.world,
			);
		}
		if (path.startsWith("/grpc/")) {
			const answered = answerAtlasGrpc(
				request,
				response,
				api.world,
				path.slice("/grpc".length),
			);
			if (answered) return;
		}

		await answer(request, response, path);
	};

	const server = createServer((request, response) => {
		if (request.method === "OPTIONS") {
			// A preflight carries no body and must not be routed: the browser is
			// asking whether the real request is allowed, not making it.
			response.writeHead(204, atlasCorsHeaders(request.headers.origin));
			response.end();
			return;
		}

		void route(request, response).catch((error: unknown) => {
			sendAtlasJson(response, 500, { code: "SERVER_FAULT", detail: String(error) });
		});
	});

	/**
	 * Every socket that left the HTTP server through an upgrade.
	 *
	 * Tracked because an upgraded socket is no longer the HTTP server's: `close()`
	 * does not wait for one and `closeAllConnections()` does not reach one, so a
	 * server with an open board socket shuts down only when the process does. In
	 * a test suite that reads as a run that hangs after the last assertion passed.
	 */
	const upgraded = new Set<Duplex>();

	server.on("upgrade", (request: IncomingMessage, socket: Duplex) => {
		const key = request.headers["sec-websocket-key"];
		const path = withoutPrefix(request.url ?? "/");
		if (typeof key !== "string" || path === null) return void socket.destroy();

		upgraded.add(socket);
		socket.on("close", () => upgraded.delete(socket));

		socket.write(
			"HTTP/1.1 101 Switching Protocols\r\n" +
				"upgrade: websocket\r\n" +
				"connection: Upgrade\r\n" +
				`sec-websocket-accept: ${acceptAtlasHandshake(key)}\r\n\r\n`,
		);

		const opened = new AtlasSocket(socket);
		if (path === "/graphql/stream") attachAtlasGraphqlStream(opened, api.world);
		else attachAtlasBoard(opened, api.world);
	});

	return {
		world: api.world,
		sessions: api.sessions,
		listen: (port = 0) =>
			new Promise((resolve) => {
				server.listen(port, "127.0.0.1", () => {
					const address = server.address();
					const actual = typeof address === "object" && address ? address.port : port;
					resolve(`http://127.0.0.1:${String(actual)}${PREFIX}`);
				});
			}),
		close: () =>
			new Promise((resolve) => {
				// Both, and in this order: a held-open SSE stream is an HTTP
				// connection the first call reaches, and a board socket is one it
				// does not — an upgrade hands the socket over and the HTTP server
				// stops counting it. Missing either leaves a server that was asked
				// to stop and did not.
				server.closeAllConnections();
				for (const socket of [...upgraded]) socket.destroy();
				server.close(() => resolve());
			}),
	};
};
