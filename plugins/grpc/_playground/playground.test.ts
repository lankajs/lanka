import { afterEach, describe, expect, it, vi } from "vitest";
import { createLanka, resetActiveLanka } from "lanka";
import { LankaError } from "lanka/errors";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import {
	createLankaGrpcJsonCodec,
	createLankaGrpcRequest,
	createLankaGrpcStreamTransport,
	createLankaStreamBridge,
	lankaGrpc,
	LankaGrpcRequest,
	LankaGrpcStreamTransport,
} from "../src/index";
import {
	createPlaygroundGrpcServer,
	createPlaygroundGrpcStream,
	createPlaygroundTagGateway,
	PlaygroundTodoGateway,
	playgroundTodoCompleted,
	startPlaygroundDesk,
} from "./app";

/**
 * The package, used as a desk uses it.
 *
 * Two seams, and each is invisible from a unit. A status only becomes a tagged
 * failure once a gateway, a codec, real framing and a real trailers block are in
 * the same call; a stream message only becomes a scenario once a stream, a
 * bridge and a scenario are all present.
 */
type TDesk = ReturnType<typeof startPlaygroundDesk>;

/** The stream is read asynchronously; let the reader run. */
const settle = async (): Promise<void> => {
	for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
};

let app: TDesk | null = null;

afterEach(() => {
	app?.lanka.dispose();
	app = null;
	resetActiveLanka();
});

describe("calling over gRPC-Web", () => {
	it("answers the decoded message, not the frame around it", async () => {
		app = startPlaygroundDesk([
			{ message: { todos: [{ id: "1", title: "write it", done: false }] } },
		]);

		await expect(app.todos.list(1)).resolves.toEqual({
			todos: [{ id: "1", title: "write it", done: false }],
		});
	});

	it("sends the request framed, at the path the method declared", async () => {
		const server = createPlaygroundGrpcServer([{ message: { todos: [] } }]);
		const lanka = createLanka({ host: lankaTestHost });
		const todos = new PlaygroundTodoGateway({
			request: createLankaGrpcRequest({ transport: server.transport }),
		});

		await todos.list(3);

		expect(server.calls()[0]).toContain("/playground.Todos/List");
		expect(server.lastMessage()).toEqual({ page: 3 });
		lanka.dispose();
	});

	it("turns a refusal into a failure the application can branch on", async () => {
		// `PERMISSION_DENIED` is the server reaching the handler and saying no. That
		// is `domain`, which retry policy leaves alone.
		app = startPlaygroundDesk([{ status: 7, statusMessage: "Not your todo" }]);

		const failure = await app.todos.list(1).catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("domain");
		expect((failure as LankaError).code).toBe("PERMISSION_DENIED");
		expect((failure as LankaError).message).toBe("Not your todo");
	});

	it("keeps a cancelled call quiet", async () => {
		// `aborted` is the one kind nothing shows: the user left the screen, and an
		// error toast about it is a bug report from a person who did nothing wrong.
		app = startPlaygroundDesk([{ status: 1 }]);

		const failure = await app.todos.list(1).catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("aborted");
	});

	it("invites a retry when the server was not reachable", async () => {
		app = startPlaygroundDesk([{ status: 14 }]);

		const failure = await app.todos.list(1).catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("network");
	});

	it("reads a status the server put in the HTTP headers", async () => {
		// A call refused before any message is a trailers-ONLY response: there is no
		// body to find the status in, and a reader that only knew the trailers would
		// report a schema failure for an ordinary permission denial.
		app = startPlaygroundDesk([{ status: 16, inHeaders: true }]);

		const failure = await app.todos.list(1).catch((error: unknown) => error);

		expect((failure as LankaError).code).toBe("UNAUTHENTICATED");
	});

	it("reports a failure below gRPC as `http`", async () => {
		app = startPlaygroundDesk([{ httpStatus: 502 }]);

		const failure = await app.todos.list(1).catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("http");
		expect((failure as LankaError).status).toBe(502);
	});

	it("refuses a success that carried no message", async () => {
		// Answering empty bytes would hand the codec a message it decodes into
		// defaults, and a screen would render zeroes as data.
		app = startPlaygroundDesk([{ status: 0 }]);

		const failure = await app.todos.list(1).catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("schema");
	});

	it("answers a mock without reaching the wire", async () => {
		// A mock answers a RESPONSE and a codec encodes REQUESTS, so there is
		// nothing for the wire path to decode. Worth knowing rather than hiding: a
		// development run against mocks proves nothing about the `.proto`.
		const lanka = createLanka({ host: lankaTestHost, flags: { isMockMode: true } });
		const todos = new PlaygroundTodoGateway({
			request: createLankaGrpcRequest({
				transport: createPlaygroundGrpcServer([{ status: 13 }]).transport,
			}),
			useMock: true,
		});

		await expect(
			todos.complete("7", () => Promise.resolve({ id: "7", title: "mocked", done: true })),
		).resolves.toEqual({ id: "7", title: "mocked", done: true });
		lanka.dispose();
	});
});

describe("either style builds the same gateway", () => {
	it("calls through the same request kind and the same framing", async () => {
		const server = createPlaygroundGrpcServer([
			{ message: { tags: [{ id: "1", name: "now" }] } },
		]);
		const lanka = createLanka({ host: lankaTestHost });
		const tags = createPlaygroundTagGateway({
			request: createLankaGrpcRequest({ transport: server.transport }),
		});

		await expect(tags.list()).resolves.toEqual({ tags: [{ id: "1", name: "now" }] });
		expect(server.calls()[0]).toContain("/playground.Tags/List");
		lanka.dispose();
	});

	it("reports the same failure as the class style would", async () => {
		const answers = [{ status: 5, statusMessage: "gone" }];
		const lanka = createLanka({ host: lankaTestHost });
		const byCalling = createPlaygroundTagGateway({
			request: createLankaGrpcRequest({
				transport: createPlaygroundGrpcServer(answers).transport,
			}),
		});
		const asClass = new PlaygroundTodoGateway({
			request: createLankaGrpcRequest({
				transport: createPlaygroundGrpcServer(answers).transport,
			}),
		});

		const fromFactory = await byCalling.list().catch((error: unknown) => error);
		const fromClass = await asClass.list(1).catch((error: unknown) => error);

		expect((fromFactory as LankaError).code).toBe((fromClass as LankaError).code);
		expect((fromFactory as LankaError).kind).toBe((fromClass as LankaError).kind);
		lanka.dispose();
	});
});

describe("watching a server stream", () => {
	it("opens NO call merely by being installed", () => {
		app = startPlaygroundDesk();

		expect(app.server.opens()).toBe(0);
	});

	it("turns a stream message into a scenario the application understands", async () => {
		app = startPlaygroundDesk();
		app.signIn();
		await settle();
		const heard = vi.fn();
		const stop = playgroundTodoCompleted.subscribe(heard);

		app.server.push({ kind: "completed", id: "7" });
		await settle();

		expect(heard).toHaveBeenCalledWith({ id: "7" });
		stop();
	});

	it("marks that work as coming from outside", async () => {
		app = startPlaygroundDesk();
		app.signIn();
		await settle();
		let insideHandler = false;
		const stop = playgroundTodoCompleted.subscribe(() => {
			insideHandler = app?.isFromOutside() ?? false;
		});

		app.server.push({ kind: "completed", id: "7" });
		await settle();

		expect(insideHandler).toBe(true);
		stop();
	});

	it("drops a message the application did not name", async () => {
		app = startPlaygroundDesk();
		app.signIn();
		await settle();
		const heard = vi.fn();
		const stop = playgroundTodoCompleted.subscribe(heard);

		app.server.push({ kind: "renamed", id: "7" });
		await settle();

		expect(heard).not.toHaveBeenCalled();
		stop();
	});

	it("reads a message split across two chunks", async () => {
		// Bytes arrive in chunks the network chose. A reader that assumed each held
		// whole frames works in every test and drops messages under load.
		app = startPlaygroundDesk();
		app.signIn();
		await settle();
		const heard = vi.fn();
		const stop = playgroundTodoCompleted.subscribe(heard);

		const body = new TextEncoder().encode(JSON.stringify({ kind: "completed", id: "9" }));
		const framed = new Uint8Array(5 + body.length);
		new DataView(framed.buffer).setUint32(1, body.length, false);
		framed.set(body, 5);

		app.server.pushBytes(framed.slice(0, 3));
		await settle();
		expect(heard).not.toHaveBeenCalled();

		app.server.pushBytes(framed.slice(3));
		await settle();

		expect(heard).toHaveBeenCalledWith({ id: "9" });
		stop();
	});

	it("re-opens the call when the server ends the stream", async () => {
		// A stream that ended and stayed ended is a screen quietly permanently
		// stale, so it enters the same reconnect ladder as a dropped connection.
		vi.useFakeTimers();
		try {
			app = startPlaygroundDesk();
			app.signIn();
			await settle();

			app.server.end();
			await settle();
			await vi.advanceTimersByTimeAsync(1000);

			expect(app.server.opens()).toBe(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it("re-opens after a call the server refused outright", async () => {
		vi.useFakeTimers();
		try {
			app = startPlaygroundDesk();
			app.server.refuseWith(503);
			app.signIn();
			await settle();
			await vi.advanceTimersByTimeAsync(1000);
			await settle();

			expect(app.server.opens()).toBe(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it("stops reading when the instance is disposed", async () => {
		vi.useFakeTimers();
		try {
			app = startPlaygroundDesk();
			app.signIn();
			await settle();

			app.lanka.dispose();
			await vi.advanceTimersByTimeAsync(60_000);

			expect(app.server.opens()).toBe(1);
			app = null;
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("either style builds the same stream transport", () => {
	it("reports the same support for this engine", () => {
		const shape = {
			path: "/playground.Todos/Watch",
			request: { since: 0 },
			codec: createLankaGrpcJsonCodec<{ since: number }, { kind: string }>(),
			eventTypeOf: () => null,
			openStream: createPlaygroundGrpcStream().open,
		};
		const built = createLankaGrpcStreamTransport(shape);
		const constructed = new LankaGrpcStreamTransport(shape);

		expect(built.isSupported()).toBe(constructed.isSupported());
	});
});

describe("a bridge written by calling", () => {
	it("carries the same scenario as one written as a class", async () => {
		const lanka = createLanka({ host: lankaTestHost });
		lanka.activate();
		const server = createPlaygroundGrpcStream();

		const buildBridge = createLankaStreamBridge(({ on }) => {
			on("todo.completed", (payload) => {
				playgroundTodoCompleted.trigger({ id: String(payload.id) });
			});
		});

		const plugin = lankaGrpc({
			transport: createLankaGrpcStreamTransport<
				{ since: number },
				{ kind: string; id: string }
			>({
				path: "/playground.Todos/Watch",
				request: { since: 0 },
				codec: createLankaGrpcJsonCodec<{ since: number }, { kind: string; id: string }>(),
				eventTypeOf: (change) => (change.kind === "completed" ? "todo.completed" : null),
				payloadOf: (change) => ({ id: change.id }),
				openStream: server.open,
			}),
			bridges: ({ stream, trigger }) => [buildBridge(stream, trigger)],
		});
		lanka.use(plugin);

		const heard = vi.fn();
		const stop = playgroundTodoCompleted.subscribe(heard);
		plugin.stream.connect();
		await settle();
		server.push({ kind: "completed", id: "9" });
		await settle();

		// The plugin cannot tell: what it received is an `ALankaStreamBridge`, and
		// the "from outside" marker is set by the base in both cases.
		expect(heard).toHaveBeenCalledWith({ id: "9" });
		stop();
		lanka.dispose();
	});
});

describe("either style builds the same request kind", () => {
	it("reads the same status, and names it the same way", async () => {
		const answers = [{ status: 7, statusMessage: "nope" }];
		const lanka = createLanka({ host: lankaTestHost });
		const built = createLankaGrpcRequest({
			transport: createPlaygroundGrpcServer(answers).transport,
		});
		const constructed = new LankaGrpcRequest({
			transport: createPlaygroundGrpcServer(answers).transport,
		});

		const fromFactory = await built
			.execute("/s/M", { method: "POST" })
			.catch((e: unknown) => e);
		const fromClass = await constructed
			.execute("/s/M", { method: "POST" })
			.catch((e: unknown) => e);

		expect((fromFactory as LankaError).code).toBe((fromClass as LankaError).code);
		expect((fromFactory as LankaError).kind).toBe((fromClass as LankaError).kind);
		lanka.dispose();
	});
});
