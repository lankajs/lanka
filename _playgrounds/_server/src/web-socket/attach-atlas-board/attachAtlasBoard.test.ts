import { Duplex } from "node:stream";
import { describe, expect, it } from "vitest";
import { attachAtlasBoard } from "./attachAtlasBoard";
import { AtlasSocket } from "../atlas-socket/AtlasSocket";
import { AtlasWorld } from "../../atlas-world/AtlasWorld";
import { readAtlasSocketFrames } from "../read-atlas-socket-frames/readAtlasSocketFrames";

const clientFrame = (text: string): Buffer => {
	const payload = Buffer.from(text, "utf8");
	const key = Buffer.of(1, 2, 3, 4);
	const body = Buffer.from(payload.map((byte, index) => byte ^ key[index % 4]));

	return Buffer.concat([Buffer.of(0x81, 0x80 | payload.length), key, body]);
};

const board = () => {
	const chunks: Buffer[] = [];
	const stream = new Duplex({
		read: () => undefined,
		write: (chunk: Buffer, _encoding, done: () => void) => {
			chunks.push(Buffer.from(chunk));
			done();
		},
	});
	const socket = new AtlasSocket(stream);
	const world = new AtlasWorld();
	attachAtlasBoard(socket, world);

	const sent = (): Record<string, unknown>[] =>
		readAtlasSocketFrames(Buffer.concat(chunks))
			.frames.filter((frame) => frame.opcode === 1)
			.map((frame) => JSON.parse(frame.payload.toString("utf8")) as Record<string, unknown>);

	return {
		stream,
		socket,
		world,
		sent,
		say: (text: string) => stream.emit("data", clientFrame(text)),
	};
};

describe("attachAtlasBoard", () => {
	it("greets a client with what is on the board", () => {
		expect(board().sent()[0]).toEqual({ type: "board.opened", payload: { missions: 5 } });
	});

	it("writes every change of the world to the socket", () => {
		const open = board();

		open.world.change("m-2", { status: "done" });

		expect(open.sent().map((message) => message.type)).toContain("mission.completed");
	});

	it("announces what a client said to everybody, the sender included", () => {
		// Not an oversight: this is the case the "from outside" marker exists for.
		// An application that cannot tell its own message from a stranger's will
		// notify a person about their own action.
		const open = board();

		open.say(JSON.stringify({ type: "board.say", payload: { text: "north ridge clear" } }));

		const said = open.sent().find((message) => message.type === "board.said");
		expect((said?.payload as { text: string }).text).toBe("north ridge clear");
	});

	it("ignores a message with nothing in it", () => {
		const open = board();

		open.say(JSON.stringify({ type: "board.say", payload: { text: "   " } }));

		expect(open.sent().some((message) => message.type === "board.said")).toBe(false);
	});

	it("lets a client complete a mission over the socket", () => {
		const open = board();

		open.say(JSON.stringify({ type: "mission.complete", payload: { id: "m-2" } }));

		expect(open.world.mission("m-2")?.status).toBe("done");
	});

	it("stops writing to the world when the socket goes", () => {
		// A listener left behind writes to a dead socket on every change, for the
		// life of the process.
		const open = board();

		open.socket.close();

		expect(open.world.changes.listenerCount()).toBe(0);
	});
});
