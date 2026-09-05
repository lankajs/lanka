import { afterEach, describe, expect, it, vi } from "vitest";
import { createLanka, resetActiveLanka } from "lanka";
import { LankaError } from "lanka/errors";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import {
	createLankaGraphqlRequest,
	createLankaGraphqlSubscriptionTransport,
	createLankaStreamBridge,
	lankaGraphql,
	LankaGraphqlRequest,
	LankaGraphqlSubscriptionTransport,
	readLankaGraphqlDocument,
	type TLankaGraphqlSocketOpener,
} from "../src/index";
import {
	createPlaygroundGraphqlServer,
	createPlaygroundTagGateway,
	PlaygroundGraphqlSocket,
	PlaygroundTodoGateway,
	playgroundTodoCompleted,
	startPlaygroundBoard,
} from "./app";

/**
 * The package, used as a board uses it.
 *
 * Two seams, and each is invisible from a unit. An operation only becomes a
 * tagged failure once a gateway, a request kind and a real `errors` body are in
 * the same call; a subscription only becomes a scenario once a socket, a
 * handshake, a bridge and a scenario are all present.
 */
type TBoard = ReturnType<typeof startPlaygroundBoard>;

let app: TBoard | null = null;

afterEach(() => {
	app?.lanka.dispose();
	app = null;
	resetActiveLanka();
});

describe("reading over GraphQL", () => {
	it("answers `data`, not the envelope around it", async () => {
		// A screen wants the todos. Handing it `{ data: { todos } }` would make
		// every ViewModel unwrap the protocol.
		app = startPlaygroundBoard([
			{ body: { data: { todos: [{ id: "1", title: "write it", done: false }] } } },
		]);

		await expect(app.todos.list()).resolves.toEqual({
			todos: [{ id: "1", title: "write it", done: false }],
		});
	});

	it("sends one POST with the document and its variables", async () => {
		const server = createPlaygroundGraphqlServer([{ body: { data: { completeTodo: {} } } }]);
		const lanka = createLanka({ host: lankaTestHost });
		const todos = new PlaygroundTodoGateway({
			request: createLankaGraphqlRequest({ transport: server.transport }),
		});

		await todos.complete("7");

		expect(server.sent()[0]?.variables).toEqual({ id: "7" });
		expect(server.lastHeaders()["content-type"]).toBe("application/json");
		lanka.dispose();
	});

	it("turns a 200 carrying `errors` into a failure the application can branch on", async () => {
		// The whole reason this package exists: through an ordinary JSON request
		// this is a SUCCESS, and the screen shows a spinner over a failed mutation.
		app = startPlaygroundBoard([
			{
				body: {
					data: null,
					errors: [{ message: "Not your todo", extensions: { code: "FORBIDDEN" } }],
				},
			},
		]);

		const failure = await app.todos.complete("7").catch((error: unknown) => error);

		expect(LankaError.is(failure)).toBe(true);
		expect((failure as LankaError).kind).toBe("domain");
		expect((failure as LankaError).code).toBe("FORBIDDEN");
		expect((failure as LankaError).message).toBe("Not your todo");
	});

	it("keeps a partial result rather than throwing the page away", async () => {
		// One nullable field resolved to `null` and said why; the rest of the page
		// rendered. Refusing it discards a page that worked.
		const partial: unknown[] = [];
		const server = createPlaygroundGraphqlServer([
			{
				body: {
					data: { todos: [{ id: "1", title: "write it", done: false }] },
					errors: [{ message: "author unavailable" }],
				},
			},
		]);
		const lanka = createLanka({ host: lankaTestHost });
		const todos = new PlaygroundTodoGateway({
			request: createLankaGraphqlRequest({
				transport: server.transport,
				onPartialErrors: (errors) => partial.push(...errors),
			}),
		});

		await expect(todos.list()).resolves.toEqual({
			todos: [{ id: "1", title: "write it", done: false }],
		});
		expect(partial).toEqual([{ message: "author unavailable" }]);
		lanka.dispose();
	});

	it("reports a non-2xx as `http`, not as a refused operation", async () => {
		// The server never reached the resolvers, so what failed is the transport
		// layer and the status is what says how.
		app = startPlaygroundBoard([{ body: {}, status: 503 }]);

		const failure = await app.todos.list().catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("http");
		expect((failure as LankaError).status).toBe(503);
	});

	it("reports a misrouted endpoint as `schema`", async () => {
		// A dev server whose `/graphql` fell through to the SPA fallback answers
		// `200 text/html`. Called a network failure it invites a retry.
		app = startPlaygroundBoard([{ body: null, text: "<!doctype html><html>" }]);

		const failure = await app.todos.list().catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("schema");
	});
});

describe("either style builds the same gateway", () => {
	it("reads through the same request kind and the same endpoint", async () => {
		const server = createPlaygroundGraphqlServer([{ body: { data: { tags: [] } } }]);
		const lanka = createLanka({ host: lankaTestHost });
		const tags = createPlaygroundTagGateway({
			request: createLankaGraphqlRequest({ transport: server.transport }),
		});

		await expect(tags.list()).resolves.toEqual({ tags: [] });
		expect(server.sent()[0]?.query).toContain("query Tags");
		lanka.dispose();
	});

	it("reports the same failure as the class style would", async () => {
		const answers = [{ body: { data: null, errors: [{ message: "no tags for you" }] } }];
		const lanka = createLanka({ host: lankaTestHost });
		const byCalling = createPlaygroundTagGateway({
			request: createLankaGraphqlRequest({
				transport: createPlaygroundGraphqlServer(answers).transport,
			}),
		});
		const asClass = new PlaygroundTodoGateway({
			request: createLankaGraphqlRequest({
				transport: createPlaygroundGraphqlServer(answers).transport,
			}),
		});

		const fromFactory = await byCalling.list().catch((error: unknown) => error);
		const fromClass = await asClass.list().catch((error: unknown) => error);

		expect((fromFactory as LankaError).kind).toBe((fromClass as LankaError).kind);
		expect((fromFactory as LankaError).message).toBe((fromClass as LankaError).message);
		lanka.dispose();
	});
});

describe("subscriptions", () => {
	it("opens NO socket merely by being installed", () => {
		app = startPlaygroundBoard();

		expect(app.isConnected()).toBe(false);
	});

	it("sends the handshake before anything else", () => {
		app = startPlaygroundBoard();

		app.signIn();
		app.connection().accept();

		expect(app.connection().sent[0]).toEqual({ type: "connection_init" });
	});

	it("subscribes only after the server acknowledged", () => {
		// A `subscribe` sent before `connection_ack` is answered with `4401` by a
		// conforming server, and the reconnect ladder then loops against a socket
		// that is working.
		app = startPlaygroundBoard();
		app.signIn();
		app.connection().accept();

		expect(app.connection().framesOf("subscribe")).toEqual([]);

		app.connection().acknowledge();

		expect(app.connection().framesOf("subscribe")).toHaveLength(1);
	});

	it("turns a subscription frame into a scenario the application understands", () => {
		app = startPlaygroundBoard();
		app.signIn();
		app.connection().accept();
		app.connection().acknowledge();
		const heard = vi.fn();
		const stop = playgroundTodoCompleted.subscribe(heard);

		const id = app.connection().subscriptionIds()[0];
		app.connection().deliver({
			id,
			type: "next",
			payload: { data: { todoCompleted: { id: "7" } } },
		});

		expect(heard).toHaveBeenCalledWith({ id: "7" });
		stop();
	});

	it("marks that work as coming from outside", () => {
		app = startPlaygroundBoard();
		app.signIn();
		app.connection().accept();
		app.connection().acknowledge();
		let insideHandler = false;
		const stop = playgroundTodoCompleted.subscribe(() => {
			insideHandler = app?.isFromOutside() ?? false;
		});

		const id = app.connection().subscriptionIds()[0];
		app.connection().deliver({
			id,
			type: "next",
			payload: { data: { todoCompleted: { id: "7" } } },
		});

		expect(insideHandler).toBe(true);
		stop();
	});

	it("answers a ping so the server does not hang up", () => {
		app = startPlaygroundBoard();
		app.signIn();
		app.connection().accept();
		app.connection().acknowledge();

		app.connection().deliver({ type: "ping" });

		expect(app.connection().framesOf("pong")).toHaveLength(1);
	});

	it("subscribes again after the link came back", async () => {
		// The far end forgot every subscription. A transport that does not ask again
		// is connected, quiet, and permanently wrong.
		vi.useFakeTimers();
		try {
			app = startPlaygroundBoard();
			app.signIn();
			app.connection().accept();
			app.connection().acknowledge();

			app.connection().drop();
			await vi.advanceTimersByTimeAsync(1000);
			app.connection().accept();
			app.connection().acknowledge();

			expect(PlaygroundGraphqlSocket.instances).toHaveLength(2);
			expect(app.connection().framesOf("subscribe")).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("treats a handshake that is never acknowledged as a lost link", async () => {
		// Otherwise the socket is upgraded, useless, and nothing says so: no frame
		// arrives, nothing errors, and the ladder never starts.
		vi.useFakeTimers();
		try {
			app = startPlaygroundBoard();
			app.signIn();
			app.connection().accept();

			await vi.advanceTimersByTimeAsync(10_000);
			await vi.advanceTimersByTimeAsync(1000);

			expect(PlaygroundGraphqlSocket.instances).toHaveLength(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it("closes the socket when the instance is disposed", () => {
		app = startPlaygroundBoard();
		app.signIn();
		const socket = app.connection();

		app.lanka.dispose();

		expect(socket.closed).toBe(true);
		app = null;
	});
});

describe("either style builds the same subscription transport", () => {
	it("reports the same support for this engine", () => {
		const opener: TLankaGraphqlSocketOpener = (url, events) =>
			new PlaygroundGraphqlSocket(url, events);
		const built = createLankaGraphqlSubscriptionTransport({ openSocket: opener });
		const constructed = new LankaGraphqlSubscriptionTransport({ openSocket: opener });

		expect(built.isSupported()).toBe(constructed.isSupported());
	});
});

describe("a bridge written by calling", () => {
	it("carries the same scenario as one written as a class", () => {
		const lanka = createLanka({ host: lankaTestHost });
		lanka.activate();
		PlaygroundGraphqlSocket.instances = [];

		const buildBridge = createLankaStreamBridge(({ on }) => {
			on("todo.completed", (payload) => {
				const completed = payload.todoCompleted as { id: string } | undefined;
				if (completed) playgroundTodoCompleted.trigger(completed);
			});
		});

		const plugin = lankaGraphql({
			operations: { "todo.completed": { document: `subscription { todoCompleted { id } }` } },
			openSocket: (url, events) => new PlaygroundGraphqlSocket(url, events),
			bridges: ({ subscriptions, trigger }) => [buildBridge(subscriptions, trigger)],
		});
		lanka.use(plugin);

		const heard = vi.fn();
		const stop = playgroundTodoCompleted.subscribe(heard);
		plugin.subscriptions.connect();
		const socket = PlaygroundGraphqlSocket.instances.at(-1);
		socket?.accept();
		socket?.acknowledge();
		socket?.deliver({
			id: socket.subscriptionIds()[0],
			type: "next",
			payload: { data: { todoCompleted: { id: "9" } } },
		});

		// The plugin cannot tell: what it received is an `ALankaStreamBridge`, and
		// the "from outside" marker is set by the base in both cases.
		expect(heard).toHaveBeenCalledWith({ id: "9" });
		stop();
		lanka.dispose();
	});
});

describe("the document", () => {
	it("is taken as text when that is what the caller had", () => {
		expect(readLankaGraphqlDocument(`query Todos { todos { id } }`)).toContain("query Todos");
	});

	it("is read out of a generated document node", () => {
		// A code generator answers one of these, and demanding a string would put
		// `print(doc)` on every call site — which means shipping a parser.
		const generated = { kind: "Document", loc: { source: { body: `query Todos { id }` } } };

		expect(readLankaGraphqlDocument(generated)).toBe(`query Todos { id }`);
	});

	it("refuses what would go out as an empty operation", () => {
		// A body with no query comes back as a server error about syntax, which
		// sends the reader looking at the backend for a mistake made here.
		expect(() => readLankaGraphqlDocument({ notADocument: true })).toThrow(TypeError);
	});
});

describe("either style builds the same request kind", () => {
	it("reads the same answer, and refuses the same one", async () => {
		const answers = [{ body: { data: null, errors: [{ message: "no" }] } }];
		const lanka = createLanka({ host: lankaTestHost });
		const built = createLankaGraphqlRequest({
			transport: createPlaygroundGraphqlServer(answers).transport,
		});
		const constructed = new LankaGraphqlRequest({
			transport: createPlaygroundGraphqlServer(answers).transport,
		});

		const fromFactory = await built.execute("/graphql").catch((error: unknown) => error);
		const fromClass = await constructed.execute("/graphql").catch((error: unknown) => error);

		expect((fromFactory as LankaError).kind).toBe((fromClass as LankaError).kind);
		expect((fromFactory as LankaError).message).toBe((fromClass as LankaError).message);
		lanka.dispose();
	});
});
