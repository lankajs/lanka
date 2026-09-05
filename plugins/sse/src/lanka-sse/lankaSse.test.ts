import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka, type ILankaInstance } from "lanka";
import { ALankaStreamBridge } from "lanka/stream";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaSse } from "./lankaSse";

/**
 * The plugin, as an application installs it.
 *
 * The assembly is `lankaStream`'s and is pinned in core. What is pinned HERE is
 * what this package adds on top: the default connection is an `EventSource`, the
 * bridges factory is handed a field called `sse`, and a transport the
 * application brought is used untouched.
 */

class FakeEventSource {
	public static instances: FakeEventSource[] = [];

	public onopen: (() => void) | null = null;
	public onerror: (() => void) | null = null;
	public onmessage: ((event: MessageEvent) => void) | null = null;
	public closed = false;
	public readonly typed = new Map<string, (event: MessageEvent) => void>();

	public readonly url: string;

	public constructor(url: string) {
		this.url = url;
		FakeEventSource.instances.push(this);
	}

	public addEventListener(type: string, handler: (event: MessageEvent) => void): void {
		this.typed.set(type, handler);
	}

	public close(): void {
		this.closed = true;
	}

	public emit(type: string, data: unknown): void {
		this.typed.get(type)?.({ data: JSON.stringify(data) } as MessageEvent);
	}
}

const lastSource = (): FakeEventSource => {
	const source = FakeEventSource.instances.at(-1);
	if (!source) throw new Error("no connection was opened");
	return source;
};

/** An application's bridge: the package knows no event type. */
class TestBridge extends ALankaStreamBridge {
	public readonly seen: { id: unknown; fromServer: boolean }[] = [];

	public register(): void {
		this.on("gap.updated", (payload) => {
			this.seen.push({ id: payload.id, fromServer: this.trigger.isActive() });
		});
	}
}

let lanka: ILankaInstance;

beforeEach(() => {
	FakeEventSource.instances = [];
	vi.stubGlobal("EventSource", FakeEventSource);
	lanka = createLanka({ host: lankaTestHost });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("lankaSse", () => {
	it("opens an EventSource when nothing else was supplied", () => {
		lanka.use(lankaSse({ path: "/events", connectOnInstall: true }));

		expect(lastSource().url).toContain("/events");
	});

	it("opens no connection by itself", () => {
		// The stream is opened for an AUTHENTICATED user, and when that happens is
		// the application's knowledge. A plugin that connects by itself would open a
		// connection on the sign-in screen.
		lanka.use(lankaSse());

		expect(FakeEventSource.instances).toHaveLength(0);
	});

	it("hands the bridges factory the connection under the name `sse`", () => {
		// The one thing this package adds to the shared assembly, and the reason it
		// is not called `stream`: every consumer's bridge file already types `sse`.
		let bridge!: TestBridge;
		lanka.use(
			lankaSse({
				connectOnInstall: true,
				bridges: ({ sse, trigger }) => {
					bridge = new TestBridge(sse, trigger);
					return [bridge];
				},
			}),
		);

		lastSource().emit("gap.updated", { id: 7 });

		expect(bridge.seen).toEqual([{ id: 7, fromServer: true }]);
	});

	it("uses the transport the application brought, and opens nothing else", () => {
		const connect = vi.fn();
		const plugin = lankaSse({
			connectOnInstall: true,
			transport: {
				isSupported: () => true,
				connect,
				disconnect: () => undefined,
				on: () => () => undefined,
				onReconnect: () => () => undefined,
			},
		});

		lanka.use(plugin);

		expect(connect).toHaveBeenCalledTimes(1);
		expect(FakeEventSource.instances).toHaveLength(0);
	});

	it("removing the plugin detaches the bridges and closes the stream", () => {
		// Otherwise a dev module reload leaves the previous subscriptions behind and
		// one server event reaches the scenarios twice.
		let bridge!: TestBridge;
		const remove = lanka.use(
			lankaSse({
				connectOnInstall: true,
				bridges: ({ sse, trigger }) => {
					bridge = new TestBridge(sse, trigger);
					return [bridge];
				},
			}),
		);
		const source = lastSource();

		remove();
		source.emit("gap.updated", { id: 7 });

		expect(bridge.seen).toEqual([]);
		expect(source.closed).toBe(true);
	});

	it("disposing the framework instance does the same", () => {
		let bridge!: TestBridge;
		lanka.use(
			lankaSse({
				connectOnInstall: true,
				bridges: ({ sse, trigger }) => {
					bridge = new TestBridge(sse, trigger);
					return [bridge];
				},
			}),
		);
		const source = lastSource();

		lanka.dispose();
		source.emit("gap.updated", { id: 7 });

		expect(bridge.seen).toEqual([]);
		expect(source.closed).toBe(true);
	});

	it("registers under this package's name", () => {
		// A duplicate registration is refused by name, and the name has to be one a
		// reader can go and look at.
		expect(lankaSse().name).toBe("@lankajs/plugin-sse");
	});

	it("leaves the marker off outside a handler", () => {
		const plugin = lankaSse();
		lanka.use(plugin);

		expect(plugin.trigger.isActive()).toBe(false);
	});
});
