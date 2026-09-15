import { createServer } from "node:http";
import { createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { readAtlasMissionsForRequest } from "./Core/Server/readAtlasMissionsForRequest";
import { startAtlasNode } from "./startAtlasNode";
import { watchAtlasMissions } from "./Modules/AtlasWatchModule/watchAtlasMissions";
import type { IAtlasMissionChange } from "./Modules/AtlasWatchModule/watchAtlasMissions";
import type { IAtlasNodeConfig } from "./startAtlasNode";
import type { Server } from "node:http";

export interface IAtlasNodeServiceConfig extends IAtlasNodeConfig {
	/** Where to listen. `0` takes a free port, which is what a test wants. */
	port?: number;
}

/** A running service: its address, what it has seen, and how to stop it. */
export interface IAtlasNodeService {
	server: Server;
	/** The address it is listening on, once `listen` has resolved. */
	url: string;
	/** Every change the watcher noticed, oldest first. */
	changes: readonly IAtlasMissionChange[];
	/** Asks the process's own ViewModel to refresh. */
	refresh: () => Promise<void>;
	stop: () => Promise<void>;
}

/**
 * Atlas as a SERVICE: no screen, two lifetimes, and the difference between them
 * is the whole lesson.
 *
 * **The process has one.** It starts the framework once, builds one ViewModel,
 * and watches it with `subscribe`. That ViewModel is this service's own view of
 * the world — a cache, a dashboard's source, whatever the deployment wants — and
 * one per process is exactly right for it.
 *
 * **A request has its own.** `/missions` answers for a CALLER, so it runs inside
 * `runLankaRequest` with that caller's headers and touches no ViewModel at all.
 * Two overlapping requests never share a bus, a locator cache or a session.
 *
 * Getting those two backwards is the failure this file is shaped to make
 * visible: a ViewModel read inside a request would be one user's state answered
 * to another, and a request scope around the watcher would be a scope that ends
 * while its subscription is still running.
 */
export const createAtlasNodeService = async (
	config: IAtlasNodeServiceConfig,
): Promise<IAtlasNodeService> => {
	const node = await startAtlasNode(config);
	const missionsVM = createAtlasMissionsVM(node.app.missionGateway);

	const changes: IAtlasMissionChange[] = [];
	const stopWatching = watchAtlasMissions({
		missionsVM,
		onChange: (change) => changes.push(change),
	});

	const server = createServer((request, response) => {
		if (request.url !== "/missions") {
			response.writeHead(404).end();
			return;
		}

		void readAtlasMissionsForRequest(request.headers)
			.then((missions) => {
				response.writeHead(200, { "content-type": "application/json" });
				response.end(JSON.stringify({ missions }));
			})
			// The failure the gateway named, as a status — not a stack. A service
			// that leaked the throw would be answering with the shape of its own
			// internals, and the ViewModel layer already decided what a failure means.
			.catch(() => {
				response.writeHead(502, { "content-type": "application/json" });
				response.end(JSON.stringify({ error: "upstream" }));
			});
	});

	const url = await new Promise<string>((resolve) => {
		server.listen(config.port ?? 0, "127.0.0.1", () => {
			const address = server.address();

			resolve(
				typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "",
			);
		});
	});

	return {
		server,
		url,
		changes,
		refresh: () => missionsVM.getState().fetchMissions(),
		stop: async () => {
			stopWatching();
			node.stop();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		},
	};
};
