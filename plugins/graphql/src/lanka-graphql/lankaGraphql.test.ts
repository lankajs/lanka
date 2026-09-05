import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka, resetActiveLanka, type ILankaInstance } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaGraphql } from "./lankaGraphql";
import type { ILankaGraphqlSocketEvents } from "../lanka-graphql-subscription-transport/LankaGraphqlSubscriptionTransport";

/**
 * The plugin, at the edges the playground does not reach.
 *
 * A scene always brings bridges and always brings a socket, because that is what
 * an application does. What is pinned here is what happens when it does not: the
 * defaults have to construct, and an installation with nothing attached has to be
 * a no-op rather than a throw.
 */

class FakeSocket {
	public static instances: FakeSocket[] = [];

	public closed = false;
	public readonly sent: string[] = [];

	public constructor(events: ILankaGraphqlSocketEvents) {
		void events;
		FakeSocket.instances.push(this);
	}

	public send(frame: string): void {
		this.sent.push(frame);
	}

	public close(): void {
		this.closed = true;
	}
}

let lanka: ILankaInstance;

beforeEach(() => {
	FakeSocket.instances = [];
	lanka = createLanka({ host: lankaTestHost });
});

afterEach(() => {
	lanka.dispose();
	resetActiveLanka();
	vi.unstubAllGlobals();
});

describe("lankaGraphql", () => {
	it("installs and is removed with nothing attached to it", () => {
		// An application that installs the plugin before it has written a bridge
		// must not be told off for it.
		const plugin = lankaGraphql({
			openSocket: (_url, events) => new FakeSocket(events),
		});

		const remove = lanka.use(plugin);

		expect(() => remove()).not.toThrow();
	});

	it("builds a `graphql-ws` connection when none was supplied", () => {
		// The default path, and the one every consumer takes: nothing in the
		// GUIDE's first example passes a transport.
		vi.stubGlobal(
			"WebSocket",
			class {
				public onopen: (() => void) | null = null;
				public onmessage: (() => void) | null = null;
				public onerror: (() => void) | null = null;
				public onclose: (() => void) | null = null;
				public readonly url: string;
				public readonly protocol: string;
				// Fields declared explicitly: `erasableSyntaxOnly` forbids parameter
				// properties, the one TypeScript construct that emits code.
				public constructor(url: string, protocol: string) {
					this.url = url;
					this.protocol = protocol;
				}
				public send(): void {
					/* nothing goes out in this scene */
				}
				public close(): void {
					/* nor is anything closed */
				}
			},
		);

		const plugin = lankaGraphql();

		expect(plugin.subscriptions.isSupported()).toBe(true);
		expect(plugin.name).toBe("@lankajs/plugin-graphql");
	});

	it("hands its own connection to the bridges factory", () => {
		const plugin = lankaGraphql({
			openSocket: (_url, events) => new FakeSocket(events),
			bridges: ({ subscriptions, trigger }) => {
				expect(subscriptions).toBe(plugin.subscriptions);
				expect(trigger).toBe(plugin.trigger);
				return [];
			},
		});

		lanka.use(plugin);
	});

	it("closes the connection when the instance goes", () => {
		const plugin = lankaGraphql({
			connectOnInstall: true,
			openSocket: (_url, events) => new FakeSocket(events),
		});
		lanka.use(plugin);

		lanka.dispose();

		expect(FakeSocket.instances.at(-1)?.closed).toBe(true);
	});
});
