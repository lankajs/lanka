import type { AtlasSocket } from "../atlas-socket/AtlasSocket";
import type { AtlasWorld } from "../../atlas-world/AtlasWorld";

/**
 * Which change a subscription document is asking about.
 *
 * By the field name in the document, the same shortcut the HTTP half takes and
 * for the same reason. A real server parses; this one answers four words.
 */
const SUBSCRIPTIONS: readonly { field: string; change: string }[] = Object.freeze([
	{ field: "missionCompleted", change: "mission.completed" },
	{ field: "missionAssigned", change: "mission.assigned" },
]);

const queryIn = (message: Record<string, unknown>): string => {
	const payload = message.payload as { query?: unknown } | undefined;

	return typeof payload?.query === "string" ? payload.query : "";
};

const idIn = (message: Record<string, unknown>): string | null =>
	typeof message.id === "string" ? message.id : null;

/**
 * `graphql-transport-ws`, as much of it as a subscription needs.
 *
 * Three things here are the protocol rather than this server's taste, and each
 * is a defect on the client if it is missing:
 *
 * - **Nothing may be subscribed before `connection_ack`.** A conforming server
 *   closes with `4401` on a `subscribe` that arrives first, which a client reads
 *   as a dropped link and retries — against a socket that is working.
 * - **A `ping` is answered with a `pong`.** Otherwise the far end decides the
 *   link is half-open.
 * - **A `next` carries `payload.data`**, not the data itself. A client unwrapping
 *   one level would hand a bridge the envelope.
 */
export const attachAtlasGraphqlStream = (socket: AtlasSocket, world: AtlasWorld): void => {
	/** Subscription id → the change it wants. Empty until acknowledged. */
	const wanted = new Map<string, string>();
	let acknowledged = false;

	const stop = world.changes.listen((change) => {
		for (const [id, change_] of wanted) {
			if (change_ !== change.type) continue;

			const field = SUBSCRIPTIONS.find((one) => one.change === change.type)?.field;
			socket.send({
				id,
				type: "next",
				payload: { data: { [field ?? "change"]: change.payload } },
			});
		}
	});

	socket.onClose(stop);

	socket.listen((message) => {
		if (message.type === "connection_init") {
			acknowledged = true;
			socket.send({ type: "connection_ack" });
			return;
		}

		if (message.type === "ping") {
			socket.send({ type: "pong" });
			return;
		}

		if (message.type === "subscribe") {
			const id = idIn(message);
			// A subscribe before the acknowledgement is the client's mistake, and
			// answering it would hide the mistake until it met a stricter server.
			if (id === null || !acknowledged) return;

			const query = queryIn(message);
			const match = SUBSCRIPTIONS.find((one) => query.includes(one.field));

			if (!match) {
				socket.send({
					id,
					type: "error",
					payload: [{ message: "this server publishes no such subscription" }],
				});
				return;
			}

			wanted.set(id, match.change);
			return;
		}

		if (message.type === "complete") {
			const id = idIn(message);
			if (id !== null) wanted.delete(id);
		}
	});
};
