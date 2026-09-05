import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka, resetActiveLanka, type ILankaInstance } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaGrpc } from "./lankaGrpc";
import type { ILankaServerEventTransport } from "lanka/stream";

/**
 * The plugin, at the edges the playground does not reach.
 *
 * A scene always brings bridges, because that is what an application does. What
 * is pinned here is what happens when it does not: an installation with nothing
 * attached has to be a no-op rather than a throw.
 */

const recordingStream = () => {
	const state = { connects: 0, disconnects: 0 };

	const transport: ILankaServerEventTransport = {
		isSupported: () => true,
		connect: () => {
			state.connects += 1;
		},
		disconnect: () => {
			state.disconnects += 1;
		},
		on: () => () => undefined,
		onReconnect: () => () => undefined,
	};

	return { transport, state };
};

let lanka: ILankaInstance;

beforeEach(() => {
	lanka = createLanka({ host: lankaTestHost });
});

afterEach(() => {
	lanka.dispose();
	resetActiveLanka();
	vi.unstubAllGlobals();
});

describe("lankaGrpc", () => {
	it("installs and is removed with no bridges attached", () => {
		const wire = recordingStream();

		const remove = lanka.use(lankaGrpc({ transport: wire.transport }));

		expect(() => remove()).not.toThrow();
		expect(wire.state.disconnects).toBe(1);
	});

	it("opens no call merely by being installed", () => {
		// The stream is opened for an AUTHENTICATED user, and when that happens is
		// the application's knowledge.
		const wire = recordingStream();

		lanka.use(lankaGrpc({ transport: wire.transport }));

		expect(wire.state.connects).toBe(0);
	});

	it("opens one when the application asked for it up front", () => {
		const wire = recordingStream();

		lanka.use(lankaGrpc({ transport: wire.transport, connectOnInstall: true }));

		expect(wire.state.connects).toBe(1);
	});

	it("hands the bridges factory the stream it was given", () => {
		const wire = recordingStream();
		const plugin = lankaGrpc({
			transport: wire.transport,
			bridges: ({ stream, trigger }) => {
				expect(stream).toBe(wire.transport);
				expect(trigger).toBe(plugin.trigger);
				return [];
			},
		});

		lanka.use(plugin);
		expect(plugin.stream).toBe(wire.transport);
	});

	it("registers under this package's name", () => {
		// A duplicate registration is refused by name, and the name has to be one a
		// reader can go and look at.
		expect(lankaGrpc({ transport: recordingStream().transport }).name).toBe(
			"@lankajs/plugin-grpc",
		);
	});
});
