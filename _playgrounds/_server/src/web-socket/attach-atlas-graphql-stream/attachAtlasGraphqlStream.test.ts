import { Duplex } from "node:stream";
import { describe, expect, it } from "vitest";
import { attachAtlasGraphqlStream } from "./attachAtlasGraphqlStream";
import { AtlasSocket } from "../atlas-socket/AtlasSocket";
import { AtlasWorld } from "../../atlas-world/AtlasWorld";
import { readAtlasSocketFrames } from "../read-atlas-socket-frames/readAtlasSocketFrames";

const clientFrame = (value: unknown): Buffer => {
	const payload = Buffer.from(JSON.stringify(value), "utf8");
	const key = Buffer.of(1, 2, 3, 4);
	const body = Buffer.from(payload.map((byte, index) => byte ^ key[index % 4]));
	const head =
		payload.length < 126
			? Buffer.of(0x81, 0x80 | payload.length)
			: Buffer.concat([Buffer.of(0x81, 0x80 | 126), lengthOf(payload.length)]);

	return Buffer.concat([head, key, body]);
};

const lengthOf = (length: number): Buffer => {
	const bytes = Buffer.alloc(2);
	bytes.writeUInt16BE(length, 0);

	return bytes;
};

const stream = () => {
	const chunks: Buffer[] = [];
	const wire = new Duplex({
		read: () => undefined,
		write: (chunk: Buffer, _encoding, done: () => void) => {
			chunks.push(Buffer.from(chunk));
			done();
		},
	});
	const socket = new AtlasSocket(wire);
	const world = new AtlasWorld();
	attachAtlasGraphqlStream(socket, world);

	return {
		world,
		socket,
		send: (value: unknown) => void wire.emit("data", clientFrame(value)),
		sent: (): Record<string, unknown>[] =>
			readAtlasSocketFrames(Buffer.concat(chunks))
				.frames.filter((frame) => frame.opcode === 1)
				.map((frame) => JSON.parse(frame.payload.toString()) as Record<string, unknown>),
	};
};

const COMPLETED = "subscription { missionCompleted { id } }";

describe("attachAtlasGraphqlStream", () => {
	it("acknowledges the handshake before anything else happens", () => {
		const link = stream();

		link.send({ type: "connection_init" });

		expect(link.sent()).toEqual([{ type: "connection_ack" }]);
	});

	it("ignores a subscribe that arrives before the acknowledgement", () => {
		// A conforming server closes with 4401 here, and a client reads that as a
		// dropped link and retries against a socket that works. Answering it would
		// hide the mistake until the application met a stricter server.
		const link = stream();

		link.send({ id: "1", type: "subscribe", payload: { query: COMPLETED } });
		link.world.change("m-2", { status: "done" });

		expect(link.sent()).toEqual([]);
	});

	it("delivers a change to the subscription that asked for it", () => {
		const link = stream();
		link.send({ type: "connection_init" });
		link.send({ id: "1", type: "subscribe", payload: { query: COMPLETED } });

		link.world.change("m-2", { status: "done" });

		const next = link.sent().find((message) => message.type === "next");
		expect(next?.id).toBe("1");
		expect(next?.payload).toHaveProperty("data.missionCompleted");
	});

	it("carries the data under payload.data, which is where a client looks", () => {
		// A client unwrapping one level would hand a bridge the envelope.
		const link = stream();
		link.send({ type: "connection_init" });
		link.send({ id: "1", type: "subscribe", payload: { query: COMPLETED } });

		link.world.change("m-2", { status: "done" });

		const next = link.sent().find((message) => message.type === "next");
		const data = (next?.payload as { data: Record<string, unknown> }).data;
		expect(data.missionCompleted).toHaveProperty("id", "m-2");
	});

	it("does not deliver a change nobody subscribed to", () => {
		const link = stream();
		link.send({ type: "connection_init" });
		link.send({ id: "1", type: "subscribe", payload: { query: COMPLETED } });

		link.world.change("m-2", { title: "Restock the forward depot" });

		expect(link.sent().some((message) => message.type === "next")).toBe(false);
	});

	it("refuses a subscription this server does not publish, and says so on that id", () => {
		const link = stream();
		link.send({ type: "connection_init" });

		link.send({ id: "9", type: "subscribe", payload: { query: "subscription { weather }" } });

		expect(link.sent().find((message) => message.type === "error")?.id).toBe("9");
	});

	it("stops delivering once the client completes the subscription", () => {
		const link = stream();
		link.send({ type: "connection_init" });
		link.send({ id: "1", type: "subscribe", payload: { query: COMPLETED } });
		link.send({ id: "1", type: "complete" });

		link.world.change("m-2", { status: "done" });

		expect(link.sent().some((message) => message.type === "next")).toBe(false);
	});

	it("answers a ping with a pong at the protocol level too", () => {
		const link = stream();

		link.send({ type: "ping" });

		expect(link.sent()).toEqual([{ type: "pong" }]);
	});

	it("lets go of the world when the socket closes", () => {
		const link = stream();
		link.send({ type: "connection_init" });

		link.socket.close();

		expect(link.world.changes.listenerCount()).toBe(0);
	});
});
