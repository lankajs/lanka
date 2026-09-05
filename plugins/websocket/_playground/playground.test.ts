import { afterEach, describe, expect, it, vi } from "vitest";
import { createLanka, resetActiveLanka } from "lanka";
import { lankaStream } from "lanka/stream";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import {
	createLankaStreamBridge,
	createLankaWebSocketTransport,
	LankaWebSocketTransport,
	lankaWebSocket,
} from "../src/index";
import {
	PlaygroundNativeChannel,
	PlaygroundRoomBridge,
	PlaygroundWebSocket,
	playgroundMessageArrived,
	startPlaygroundRoom,
} from "./app";

/**
 * The package, used as a chat room uses it.
 *
 * The seam is the product, and on this wire it has two directions: a frame
 * becomes a scenario the application already understands, and a click becomes a
 * frame. Neither is visible from a unit — the first needs a socket and a bridge
 * and a scenario, the second needs a connection that is not open yet.
 */
type TRoom = ReturnType<typeof startPlaygroundRoom>;

let app: TRoom | null = null;

afterEach(() => {
	app?.lanka.dispose();
	app = null;
	resetActiveLanka();
});

describe("the websocket playground", () => {
	it("opens NO connection merely by being installed", () => {
		// A socket opened on the sign-in screen is a handshake for a session that
		// does not exist yet, and a reconnect loop against a rejected upgrade.
		app = startPlaygroundRoom();

		expect(app.isConnected()).toBe(false);
	});

	it("opens the socket once the application signs in", () => {
		app = startPlaygroundRoom();

		app.signIn();

		expect(app.connection().url).toBe("wss://api.test/room");
	});

	it("turns a server frame into a scenario the application understands", () => {
		app = startPlaygroundRoom();
		app.signIn();
		app.connection().accept();
		const heard = vi.fn();
		const stop = playgroundMessageArrived.subscribe(heard);

		app.connection().deliver({ type: "room.message", payload: { text: "hello" } });

		expect(heard).toHaveBeenCalledWith({ text: "hello" });
		stop();
	});

	it("understands a flat frame as well as a wrapped one", () => {
		// Both shapes are what backends send. Refusing the second would lose every
		// event silently, which is the worst way to be strict.
		app = startPlaygroundRoom();
		app.signIn();
		app.connection().accept();
		const heard = vi.fn();
		const stop = playgroundMessageArrived.subscribe(heard);

		app.connection().deliver({ type: "room.message", text: "flat" });

		expect(heard).toHaveBeenCalledWith({ text: "flat" });
		stop();
	});

	it("marks work as coming from outside while a server frame is handled", () => {
		// What the marker is for: a handler can tell "the user did this" from "the
		// server said so", and a room that echoes back what it just received is the
		// failure it prevents.
		app = startPlaygroundRoom();
		app.signIn();
		app.connection().accept();
		let insideHandler = false;
		const stop = playgroundMessageArrived.subscribe(() => {
			insideHandler = app?.isFromOutside() ?? false;
		});

		app.connection().deliver({ type: "room.message", payload: { text: "hello" } });

		expect(insideHandler).toBe(true);
		stop();
	});

	it("does not mark ordinary work as coming from outside", () => {
		app = startPlaygroundRoom();

		expect(app.isFromOutside()).toBe(false);
	});

	it("ignores a frame no bridge registered", () => {
		app = startPlaygroundRoom();
		app.signIn();
		app.connection().accept();
		const heard = vi.fn();
		const stop = playgroundMessageArrived.subscribe(heard);

		app.connection().deliver({ type: "room.somebody-left", payload: {} });

		expect(heard).not.toHaveBeenCalled();
		stop();
	});

	it("closes the connection when the instance is disposed", () => {
		app = startPlaygroundRoom();
		app.signIn();
		const connection = app.connection();

		app.lanka.dispose();

		expect(connection.readyState).toBe(3);
		app = null;
	});
});

describe("saying something", () => {
	it("goes out over the open socket", () => {
		app = startPlaygroundRoom();
		app.signIn();
		app.connection().accept();

		const wentOut = app.say("hello");

		expect(wentOut).toBe(true);
		expect(app.connection().frames()).toEqual([
			{ type: "room.say", payload: { text: "hello" } },
		]);
	});

	it("is held while the link is down, and flushed when it opens", () => {
		// A reconnect is invisible from a screen. Losing the click that happened
		// during one is not a behaviour anybody chose.
		app = startPlaygroundRoom();
		app.signIn();

		const wentOut = app.say("said too early");
		expect(wentOut).toBe(false);
		expect(app.connection().sent).toEqual([]);

		app.connection().accept();

		expect(app.connection().frames()).toEqual([
			{ type: "room.say", payload: { text: "said too early" } },
		]);
	});

	it("keeps the newest when the outbox is full", () => {
		// An unbounded outbox on a link that never comes back is a leak that looks
		// like patience, and the oldest message is the one least worth sending.
		app = startPlaygroundRoom({ maxQueuedMessages: 2 });
		app.signIn();

		app.say("one");
		app.say("two");
		app.say("three");
		app.connection().accept();

		expect(
			app
				.connection()
				.frames()
				.map((frame) => frame.payload.text),
		).toEqual(["two", "three"]);
	});

	it("drops it outright where holding is worse than losing", () => {
		app = startPlaygroundRoom({ queueWhileClosed: false });
		app.signIn();

		app.say("stale the moment it is late");
		app.connection().accept();

		expect(app.connection().sent).toEqual([]);
	});
});

describe("a link that comes back", () => {
	it("re-opens and tells the screens they missed something", async () => {
		vi.useFakeTimers();
		try {
			app = startPlaygroundRoom();
			app.signIn();
			app.connection().accept();
			const caughtUp = vi.fn();
			const stop = playgroundMessageArrived.subscribe(caughtUp);

			app.connection().drop();
			await vi.advanceTimersByTimeAsync(1000);
			app.connection().accept();
			app.connection().deliver({ type: "room.message", payload: { text: "after" } });

			expect(caughtUp).toHaveBeenCalledWith({ text: "after" });
			stop();
		} finally {
			vi.useRealTimers();
		}
	});

	it("re-sends nothing it already sent", async () => {
		vi.useFakeTimers();
		try {
			app = startPlaygroundRoom();
			app.signIn();
			app.connection().accept();
			app.say("before the drop");

			app.connection().drop();
			await vi.advanceTimersByTimeAsync(1000);
			app.connection().accept();

			expect(app.connection().sent).toEqual([]);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("a channel the application brought itself", () => {
	it("carries the same bridges with no WebSocket anywhere", () => {
		const channel = new PlaygroundNativeChannel();
		const lanka = createLanka({ host: lankaTestHost });
		lanka.activate();
		const plugin = lankaWebSocket({
			transport: channel,
			bridges: ({ socket, trigger }) => [new PlaygroundRoomBridge(socket, trigger)],
		});
		lanka.use(plugin);
		const heard = vi.fn();
		const stop = playgroundMessageArrived.subscribe(heard);

		plugin.socket.connect();
		channel.accept();
		channel.deliver("room.message", { text: "over a native bridge" });

		// The bridge, the scenario and the plugin are unchanged; only the thing
		// carrying bytes is different, which is what the port is for.
		expect(heard).toHaveBeenCalledWith({ text: "over a native bridge" });
		stop();
		lanka.dispose();
	});

	it("answers through the same `send`", () => {
		const channel = new PlaygroundNativeChannel();
		const lanka = createLanka({ host: lankaTestHost });
		lanka.activate();
		const plugin = lankaWebSocket({ transport: channel });
		lanka.use(plugin);

		plugin.socket.connect();
		channel.accept();
		plugin.socket.send("room.say", { text: "hello" });

		expect(channel.sent).toEqual([{ type: "room.say", payload: { text: "hello" } }]);
		lanka.dispose();
	});

	it("closes the application's channel when the instance goes", () => {
		const channel = new PlaygroundNativeChannel();
		const lanka = createLanka({ host: lankaTestHost });
		lanka.activate();
		lanka.use(lankaWebSocket({ transport: channel }));
		channel.connect();

		lanka.dispose();

		expect(channel.closed).toBe(1);
	});
});

describe("either style builds the same thing", () => {
	it("the transport reports the same support for this engine", () => {
		(globalThis as { WebSocket?: unknown }).WebSocket = PlaygroundWebSocket;
		const built = createLankaWebSocketTransport({ path: "/room" });
		const constructed = new LankaWebSocketTransport({ path: "/room" });

		expect(built.isSupported()).toBe(constructed.isSupported());
	});

	it("a bridge written by calling carries the same scenario as one written as a class", () => {
		const channel = new PlaygroundNativeChannel();
		const lanka = createLanka({ host: lankaTestHost });
		lanka.activate();

		const buildBridge = createLankaStreamBridge(({ on }) => {
			on("room.message", (payload) => {
				playgroundMessageArrived.trigger(payload as { text: string });
			});
		});

		const plugin = lankaWebSocket({
			transport: channel,
			bridges: ({ socket, trigger }) => [buildBridge(socket, trigger)],
		});
		lanka.use(plugin);

		const heard = vi.fn();
		const stop = playgroundMessageArrived.subscribe(heard);
		plugin.socket.connect();
		channel.accept();
		channel.deliver("room.message", { text: "either style" });

		// The plugin cannot tell: what it received is an `ALankaStreamBridge`, and
		// the "from outside" marker is set by the base in both cases.
		expect(heard).toHaveBeenCalledWith({ text: "either style" });
		stop();
		lanka.dispose();
	});
});

describe("bridges with no protocol package at all", () => {
	it("`lankaStream` wires an application's own channel to its scenarios", () => {
		// The case the shared half exists for: an application that already has a
		// connection — a native bridge, an IPC channel, a socket opened for
		// something else — wants the bridge, the marker and the lifetime, and
		// nothing about a protocol.
		const channel = new PlaygroundNativeChannel();
		const lanka = createLanka({ host: lankaTestHost });
		lanka.activate();

		const plugin = lankaStream({
			transport: channel,
			connectOnInstall: true,
			bridges: ({ stream, trigger }) => [new PlaygroundRoomBridge(stream, trigger)],
		});
		lanka.use(plugin);

		const heard = vi.fn();
		const stop = playgroundMessageArrived.subscribe(heard);
		channel.accept();
		channel.deliver("room.message", { text: "no plugin package involved" });

		expect(heard).toHaveBeenCalledWith({ text: "no plugin package involved" });
		stop();

		lanka.dispose();
		expect(channel.closed).toBe(1);
	});
});
