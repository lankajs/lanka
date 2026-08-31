import { afterEach, describe, expect, it, vi } from "vitest";
import { createLankaSseBridge, createLankaSseTransport, LankaSseTransport } from "../src/index";
import { resetActiveLanka } from "lanka";
import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaSse } from "../src/index";
import {
	PlaygroundChatBridge,
	PlaygroundSocketTransport,
	playgroundMessageArrived,
	startPlaygroundChat,
} from "./app";

/**
 * The package, used as a chat screen uses it.
 *
 * The seam is the product: a wire message becomes a scenario the rest of the
 * application already understands, and a handler running because of one can
 * tell. Neither is visible from a unit — the first needs a connection and a
 * bridge and a scenario, the second needs something to be running.
 */
type TChat = ReturnType<typeof startPlaygroundChat>;

let app: TChat | null = null;

afterEach(() => {
	app?.lanka.dispose();
	app = null;
	resetActiveLanka();
});

describe("the sse playground", () => {
	it("opens NO connection merely by being installed", () => {
		// A stream opened on the sign-in screen is a request for a session that
		// does not exist yet, and a reconnect loop against a 401.
		app = startPlaygroundChat();

		expect(app.isConnected()).toBe(false);
	});

	it("opens the stream once the application signs in", () => {
		app = startPlaygroundChat();

		app.signIn();

		expect(app.connection().url).toContain("/events");
	});

	it("turns a server message into a scenario the application understands", () => {
		app = startPlaygroundChat();
		app.signIn();
		const heard = vi.fn();
		const stop = playgroundMessageArrived.subscribe(heard);

		app.connection().deliver("message", { text: "hello" });

		expect(heard).toHaveBeenCalledWith({ text: "hello" });
		stop();
	});

	it("delivers every message, not only the first", () => {
		app = startPlaygroundChat();
		app.signIn();
		const heard = vi.fn();
		const stop = playgroundMessageArrived.subscribe(heard);

		app.connection().deliver("message", { text: "one" });
		app.connection().deliver("message", { text: "two" });

		expect(heard).toHaveBeenCalledTimes(2);
		stop();
	});

	it("marks work as coming from outside while a server message is handled", () => {
		// What the marker is for: a handler can tell "the user did this" from "the
		// server said so", and a screen that echoes back what it just received is
		// the failure it prevents.
		app = startPlaygroundChat();
		app.signIn();
		let insideHandler = false;
		const stop = playgroundMessageArrived.subscribe(() => {
			insideHandler = app?.isFromOutside() ?? false;
		});

		app.connection().deliver("message", { text: "hello" });

		expect(insideHandler).toBe(true);
		stop();
	});

	it("does not mark ordinary work as coming from outside", () => {
		app = startPlaygroundChat();

		expect(app.isFromOutside()).toBe(false);
	});

	it("ignores an event type no bridge registered", () => {
		app = startPlaygroundChat();
		app.signIn();
		const heard = vi.fn();
		const stop = playgroundMessageArrived.subscribe(heard);

		app.connection().deliver("something-else", { text: "hello" });

		expect(heard).not.toHaveBeenCalled();
		stop();
	});

	it("closes the connection when the instance is disposed", () => {
		app = startPlaygroundChat();
		app.signIn();
		const connection = app.connection();

		app.lanka.dispose();

		expect(connection.closed).toBe(true);
		app = null;
	});
});

describe("a transport the application brought itself", () => {
	it("carries the same bridges with no EventSource anywhere", () => {
		const socket = new PlaygroundSocketTransport();
		const lanka = createLanka({ host: lankaTestHost });
		lanka.activate();
		const plugin = lankaSse({
			transport: socket,
			bridges: ({ sse, trigger }) => [new PlaygroundChatBridge(sse, trigger)],
		});
		lanka.use(plugin);
		const heard = vi.fn();
		const stop = playgroundMessageArrived.subscribe(heard);

		plugin.sse.connect();
		socket.deliver("message", { text: "over a socket" });

		// The bridge, the scenario and the plugin are unchanged; only the thing
		// carrying bytes is different, which is what the port is for.
		expect(heard).toHaveBeenCalledWith({ text: "over a socket" });
		stop();
		lanka.dispose();
	});

	it("closes the application's transport when the instance goes", () => {
		const socket = new PlaygroundSocketTransport();
		const lanka = createLanka({ host: lankaTestHost });
		lanka.activate();
		lanka.use(lankaSse({ transport: socket }));
		socket.connect();

		lanka.dispose();

		expect(socket.connected).toBe(false);
	});
});

describe("either style builds the same transport", () => {
	it("reports the same support for this engine", () => {
		const built = createLankaSseTransport({ path: "/events" });
		const constructed = new LankaSseTransport({ path: "/events" });

		expect(built.isSupported()).toBe(constructed.isSupported());
	});
});

describe("a bridge written by calling", () => {
	it("carries the same scenario as one written as a class", () => {
		const socket = new PlaygroundSocketTransport();
		const lanka = createLanka({ host: lankaTestHost });
		lanka.activate();

		const buildBridge = createLankaSseBridge(({ on }) => {
			on("message", (payload) => {
				playgroundMessageArrived.trigger(payload as { text: string });
			});
		});

		const plugin = lankaSse({
			transport: socket,
			bridges: ({ sse, trigger }) => [buildBridge(sse, trigger)],
		});
		lanka.use(plugin);

		const heard = vi.fn();
		const stop = playgroundMessageArrived.subscribe(heard);
		plugin.sse.connect();
		socket.deliver("message", { text: "either style" });

		// The plugin cannot tell: what it received is an `ALankaSseBridge`, and the
		// "from outside" marker is set by the base in both cases.
		expect(heard).toHaveBeenCalledWith({ text: "either style" });
		stop();
		lanka.dispose();
	});
});
