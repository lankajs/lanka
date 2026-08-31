import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka, type ILankaInstance } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { ALankaSseBridge } from "./ALankaSseBridge";
import { lankaSse } from "../../index";

/**
 * The bridge and the "from outside" marker.
 *
 * What is pinned is not event delivery — that is the transport's job — but the
 * two things lost in any port: a handler KNOWS it was triggered by the server,
 * and a bridge's subscriptions are removed together with the plugin.
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
class TestBridge extends ALankaSseBridge {
	public readonly seen: { id: unknown; fromServer: boolean }[] = [];

	public register(): void {
		this.on("gap.updated", (data) => {
			this.seen.push({ id: data.id, fromServer: this.trigger.isActive() });
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

describe("ALankaSseBridge", () => {
	it("a handler knows it was triggered by the server", () => {
		// Without the marker the screen notifies the user about their OWN action,
		// and an optimistic update is rolled back by a "foreign" response that in
		// fact confirms it.
		let bridge!: TestBridge;
		const plugin = lankaSse({
			connectOnInstall: true,
			bridges: (context) => {
				bridge = new TestBridge(context.sse, context.trigger);
				return [bridge];
			},
		});
		lanka.use(plugin);

		lastSource().emit("gap.updated", { id: 7 });

		expect(bridge.seen).toEqual([{ id: 7, fromServer: true }]);
	});

	it("outside a handler there is no marker", () => {
		const plugin = lankaSse();
		lanka.use(plugin);

		expect(plugin.trigger.isActive()).toBe(false);
	});

	it("the marker is cleared even when the handler threw", () => {
		// A marker left set would make EVERY later user action count as coming from
		// the server — quietly, until a reload.
		const plugin = lankaSse();
		lanka.use(plugin);

		expect(() =>
			plugin.trigger.run(() => {
				throw new Error("the handler threw");
			}),
		).toThrow("the handler threw");
		expect(plugin.trigger.isActive()).toBe(false);
	});

	it("a nested call does not clear the outer marker", () => {
		const plugin = lankaSse();
		lanka.use(plugin);
		const seen: boolean[] = [];

		plugin.trigger.run(() => {
			plugin.trigger.run(() => undefined);
			seen.push(plugin.trigger.isActive());
		});

		expect(seen).toEqual([true]);
	});

	it("removing the plugin detaches the bridges and closes the stream", () => {
		// Otherwise a dev module reload leaves the previous subscriptions behind and
		// one server event reaches the scenarios twice.
		let bridge!: TestBridge;
		const remove = lanka.use(
			lankaSse({
				connectOnInstall: true,
				bridges: (context) => {
					bridge = new TestBridge(context.sse, context.trigger);
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
				bridges: (context) => {
					bridge = new TestBridge(context.sse, context.trigger);
					return [bridge];
				},
			}),
		);
		const source = lastSource();

		lanka.dispose();
		source.emit("gap.updated", { id: 7 });

		expect(bridge.seen).toEqual([]);
	});

	it("the plugin opens no connection by itself", () => {
		// The stream is opened for an AUTHENTICATED user, and when that happens is
		// the application's knowledge. A plugin that connects by itself would open a
		// connection on the sign-in screen.
		lanka.use(lankaSse());

		expect(FakeEventSource.instances).toHaveLength(0);
	});
});
