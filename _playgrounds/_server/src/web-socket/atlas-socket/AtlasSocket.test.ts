import { Duplex } from "node:stream";
import { describe, expect, it } from "vitest";
import { AtlasSocket } from "./AtlasSocket";
import { readAtlasSocketFrames } from "../read-atlas-socket-frames/readAtlasSocketFrames";

/** A client frame: masked, the way every browser sends one. */
const clientFrame = (opcode: number, text: string): Buffer => {
	const payload = Buffer.from(text, "utf8");
	const key = Buffer.of(1, 2, 3, 4);
	const body = Buffer.from(payload.map((byte, index) => byte ^ key[index % 4]));

	return Buffer.concat([Buffer.of(0x80 | opcode, 0x80 | payload.length), key, body]);
};

/**
 * A duplex with the two directions kept apart.
 *
 * A `PassThrough` would not do: it loops what is written straight back into what
 * is read, so the client's own frame would appear in the server's output and
 * every assertion about what the server SENT would be reading what the test
 * sent.
 */
const wire = (): { stream: Duplex; written: () => Buffer; deliver: (bytes: Buffer) => void } => {
	const chunks: Buffer[] = [];
	const stream = new Duplex({
		read: () => undefined,
		write: (chunk: Buffer, _encoding, done: () => void) => {
			chunks.push(Buffer.from(chunk));
			done();
		},
	});

	return {
		stream,
		written: () => Buffer.concat(chunks),
		// Emitted rather than pushed: `push` delivers on a later tick, and a test
		// that asserted before it arrived would pass while reading nothing.
		deliver: (bytes) => void stream.emit("data", bytes),
	};
};

describe("AtlasSocket", () => {
	it("hands a text frame to every listener as a parsed object", () => {
		const { stream, deliver } = wire();
		const socket = new AtlasSocket(stream);
		const heard: Record<string, unknown>[] = [];
		socket.listen((message) => heard.push(message));

		deliver(clientFrame(1, JSON.stringify({ type: "board.say" })));

		expect(heard).toEqual([{ type: "board.say" }]);
	});

	it("answers a ping with a pong, so a heartbeat does not read as a dead link", () => {
		const { stream, written, deliver } = wire();
		const socket = new AtlasSocket(stream);
		socket.listen(() => undefined);

		deliver(clientFrame(9, ""));

		expect(readAtlasSocketFrames(written()).frames[0].opcode).toBe(10);
	});

	it("drops a frame that is not JSON rather than taking the process with it", () => {
		// A socket that dies on an unknown frame dies the first time somebody adds
		// a keep-alive at the other end.
		const { stream, deliver } = wire();
		const socket = new AtlasSocket(stream);
		const heard: unknown[] = [];
		socket.listen((message) => heard.push(message));

		deliver(clientFrame(1, "not json at all"));
		deliver(clientFrame(1, "[1,2,3]"));

		expect(heard).toEqual([]);
	});

	it("joins a message split across two chunks", () => {
		const { stream, deliver } = wire();
		const socket = new AtlasSocket(stream);
		const heard: unknown[] = [];
		socket.listen((message) => heard.push(message));

		const frame = clientFrame(1, JSON.stringify({ type: "board.say" }));
		deliver(frame.subarray(0, 4));
		deliver(frame.subarray(4));

		expect(heard).toEqual([{ type: "board.say" }]);
	});

	it("tells everyone once when the socket goes, whatever ended it", () => {
		const { stream } = wire();
		const socket = new AtlasSocket(stream);
		let closed = 0;
		socket.onClose(() => (closed += 1));

		socket.close();
		stream.emit("close");

		expect(closed).toBe(1);
	});

	it("stops writing once it is closed, rather than throwing at a caller", () => {
		const { stream, written } = wire();
		const socket = new AtlasSocket(stream);

		socket.close();
		const afterClose = written().length;
		socket.send({ type: "too.late" });

		expect(written()).toHaveLength(afterClose);
	});

	it("echoes a close frame, so the other end does not sit in CLOSING", () => {
		const { stream, written, deliver } = wire();
		new AtlasSocket(stream);

		deliver(clientFrame(8, ""));

		expect(readAtlasSocketFrames(written()).frames.some((frame) => frame.opcode === 8)).toBe(
			true,
		);
	});
});
