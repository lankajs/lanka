import type { AtlasSocket } from "../atlas-socket/AtlasSocket";
import type { AtlasWorld } from "../../atlas-world/AtlasWorld";

const textIn = (message: Record<string, unknown>): string | null => {
	const payload = message.payload;
	const text = (payload as { text?: unknown } | undefined)?.text;

	return typeof text === "string" && text.trim().length > 0 ? text.trim() : null;
};

const missionIdIn = (message: Record<string, unknown>): string | null => {
	const payload = message.payload;
	const id = (payload as { id?: unknown } | undefined)?.id;

	return typeof id === "string" ? id : null;
};

/**
 * The dispatch board: everything that happens, both ways.
 *
 * The inbound half is the reason a WebSocket is here at all rather than a
 * server-sent stream. Note what happens to a message a client sends: it is
 * announced to EVERYONE, the sender included. That is not an oversight — it is
 * the case the "from outside" marker exists for, and an application that cannot
 * tell its own message from a stranger's will notify a person about their own
 * action.
 */
export const attachAtlasBoard = (socket: AtlasSocket, world: AtlasWorld): void => {
	const stop = world.changes.listen((change) => {
		socket.send({ type: change.type, payload: change.payload });
	});

	socket.onClose(stop);

	socket.listen((message) => {
		if (message.type === "board.say") {
			const text = textIn(message);
			if (text) world.changes.announce("board.said", { text, at: new Date().toISOString() });
			return;
		}

		if (message.type === "mission.complete") {
			const id = missionIdIn(message);
			if (id) world.change(id, { status: "done" });
		}
	});

	socket.send({ type: "board.opened", payload: { missions: world.missions().length } });
};
