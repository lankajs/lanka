import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAtlasServer } from "./createAtlasServer";
import type { IAtlasServer } from "./createAtlasServer";

let api: IAtlasServer;
let base: string;

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	base = await api.listen(0);
});

afterAll(async () => {
	await api.close();
});

/** Opens a socket and answers when it is ready, so a test never sends too early. */
const openSocket = async (path: string): Promise<WebSocket> => {
	const socket = new WebSocket(`${base.replace("http", "ws")}${path}`);

	await new Promise<void>((resolve, reject) => {
		socket.addEventListener("open", () => resolve(), { once: true });
		socket.addEventListener("error", () => reject(new Error("the socket would not open")), {
			once: true,
		});
	});

	return socket;
};

/** Waits for the first message satisfying a test, and REJECTS on its deadline. */
const nextMessage = (
	socket: WebSocket,
	wanted: (message: Record<string, unknown>) => boolean,
	timeoutMs = 2000,
): Promise<Record<string, unknown>> =>
	new Promise((resolve, reject) => {
		// Rejecting rather than resolving late: a wait that gives up quietly is how
		// a suite acquires tests that pass without the thing having happened.
		const timer = setTimeout(() => reject(new Error("no such message arrived")), timeoutMs);

		const onMessage = (event: MessageEvent) => {
			const message = JSON.parse(String(event.data)) as Record<string, unknown>;
			if (!wanted(message)) return;

			clearTimeout(timer);
			socket.removeEventListener("message", onMessage);
			resolve(message);
		};

		socket.addEventListener("message", onMessage);
	});

describe("the server-sent stream", () => {
	it("opens immediately, before anything has happened", async () => {
		// Until something crosses, a browser has not finished opening the stream
		// and `onopen` has not fired on the client.
		const response = await fetch(`${base}/sse/events`);
		const reader = response.body?.getReader();
		const first = await reader?.read();

		expect(new TextDecoder().decode(first?.value)).toContain("the atlas stream is open");
		await reader?.cancel();
	});

	it("writes a named event carrying the trigger envelope", async () => {
		const response = await fetch(`${base}/sse/events`);
		const reader = response.body?.getReader();
		await reader?.read();

		api.world.change("m-2", { status: "done" });
		const next = await reader?.read();
		const text = new TextDecoder().decode(next?.value);

		expect(text).toContain("event: mission.completed");
		expect(text).toContain('"trigger":"mission.completed"');
		await reader?.cancel();
	});

	it("lets go of the world when the reader goes away", async () => {
		const response = await fetch(`${base}/sse/events`);
		const reader = response.body?.getReader();
		await reader?.read();
		await reader?.cancel();

		// The close travels over a socket, so it is not instant. Waiting for the
		// count rather than asserting straight away is the difference between a
		// test and a race.
		await expect.poll(() => api.world.changes.listenerCount(), { timeout: 2000 }).toBe(0);
	});
});

describe("the board socket", () => {
	it("greets a client that connects", async () => {
		const socket = await openSocket("/ws/board");

		const greeting = await nextMessage(socket, (message) => message.type === "board.opened");

		expect(greeting.payload).toHaveProperty("missions");
		socket.close();
	});

	it("carries a change of the world to a listening client", async () => {
		const socket = await openSocket("/ws/board");
		await nextMessage(socket, (message) => message.type === "board.opened");

		api.world.change("m-3", { crewId: "c-3" });
		const change = await nextMessage(socket, (message) => message.type === "mission.assigned");

		expect(change.payload).toHaveProperty("crewId", "c-3");
		socket.close();
	});

	it("carries what one client says to another", async () => {
		const listener = await openSocket("/ws/board");
		const speaker = await openSocket("/ws/board");

		speaker.send(JSON.stringify({ type: "board.say", payload: { text: "ridge clear" } }));
		const said = await nextMessage(listener, (message) => message.type === "board.said");

		expect(said.payload).toHaveProperty("text", "ridge clear");
		listener.close();
		speaker.close();
	});
});

describe("the graphql subscription stream", () => {
	it("acknowledges, subscribes and delivers", async () => {
		const socket = await openSocket("/graphql/stream");
		socket.send(JSON.stringify({ type: "connection_init" }));
		await nextMessage(socket, (message) => message.type === "connection_ack");

		socket.send(
			JSON.stringify({
				id: "1",
				type: "subscribe",
				payload: { query: "subscription { missionCompleted { id } }" },
			}),
		);

		// A round trip before changing anything. The protocol acknowledges the
		// CONNECTION and not a subscription, so without this the change can be
		// announced before the `subscribe` frame has been read — and the test then
		// fails on a server that is working.
		socket.send(JSON.stringify({ type: "ping" }));
		await nextMessage(socket, (message) => message.type === "pong");

		api.world.change("m-5", { status: "done" });

		const next = await nextMessage(socket, (message) => message.type === "next");

		expect(next.payload).toHaveProperty("data.missionCompleted");
		socket.close();
	});
});
