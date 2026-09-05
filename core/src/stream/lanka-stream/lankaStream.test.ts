import { describe, expect, it, vi } from "vitest";
import { lankaStream } from "./lankaStream";
import { createLanka } from "../../bootstrap/_factories/create-lanka/createLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { ALankaStreamBridge } from "../_abstractions/lanka-stream-bridge/ALankaStreamBridge";
import type { ILankaServerEventTransport } from "../_interfaces/ILankaServerEventTransport";

const transportThatRecords = () => {
	const events = new Map<string, (payload: Record<string, unknown>) => void>();
	const state = { connects: 0, disconnects: 0 };

	const transport: ILankaServerEventTransport = {
		isSupported: () => true,
		connect: () => {
			state.connects += 1;
		},
		disconnect: () => {
			state.disconnects += 1;
		},
		on: (eventType, callback) => {
			events.set(eventType, callback);
			return () => events.delete(eventType);
		},
		onReconnect: () => () => undefined,
	};

	return {
		transport,
		state,
		deliver: (eventType: string, payload: Record<string, unknown>) =>
			events.get(eventType)?.(payload),
		subscriptions: () => events.size,
	};
};

class RecordingBridge extends ALankaStreamBridge {
	public readonly seen: unknown[] = [];

	public register(): void {
		this.on("gap.updated", (payload) => {
			this.seen.push(payload.id);
		});
	}
}

describe("lankaStream", () => {
	it("registers the application's bridges on install", () => {
		const wire = transportThatRecords();
		const lanka = createLanka({ host: lankaTestHost });
		let bridge!: RecordingBridge;

		lanka.use(
			lankaStream({
				transport: wire.transport,
				bridges: ({ stream, trigger }) => {
					bridge = new RecordingBridge(stream, trigger);
					return [bridge];
				},
			}),
		);
		wire.deliver("gap.updated", { id: 7 });

		expect(bridge.seen).toEqual([7]);
		lanka.dispose();
	});

	it("opens no connection merely by being installed", () => {
		// The stream is opened for an AUTHENTICATED user, and when that happens is
		// the application's knowledge. A plugin that connects by itself would open a
		// connection on the sign-in screen.
		const wire = transportThatRecords();
		const lanka = createLanka({ host: lankaTestHost });

		lanka.use(lankaStream({ transport: wire.transport }));

		expect(wire.state.connects).toBe(0);
		lanka.dispose();
	});

	it("opens one when the application asked for it up front", () => {
		const wire = transportThatRecords();
		const lanka = createLanka({ host: lankaTestHost });

		lanka.use(lankaStream({ transport: wire.transport, connectOnInstall: true }));

		expect(wire.state.connects).toBe(1);
		lanka.dispose();
	});

	it("detaches the bridges BEFORE closing the connection", () => {
		// The other order leaves a window in which a dying connection delivers one
		// last event into scenarios belonging to an instance being disposed.
		const wire = transportThatRecords();
		const order: string[] = [];
		const lanka = createLanka({ host: lankaTestHost });
		const transport: ILankaServerEventTransport = {
			...wire.transport,
			disconnect: () => order.push("disconnect"),
		};

		lanka.use(
			lankaStream({
				transport,
				bridges: ({ stream, trigger }) => [
					new (class extends ALankaStreamBridge {
						public register(): void {
							/* Nothing to subscribe: the order is what is under test. */
						}

						public override dispose(): void {
							order.push("dispose");
							super.dispose();
						}
					})(stream, trigger),
				],
			}),
		);
		lanka.dispose();

		expect(order).toEqual(["dispose", "disconnect"]);
	});

	it("removing the plugin releases what it subscribed", () => {
		const wire = transportThatRecords();
		const lanka = createLanka({ host: lankaTestHost });
		const remove = lanka.use(
			lankaStream({
				transport: wire.transport,
				bridges: ({ stream, trigger }) => [new RecordingBridge(stream, trigger)],
			}),
		);

		remove();

		expect(wire.subscriptions()).toBe(0);
		lanka.dispose();
	});

	it("carries a name a duplicate registration can be traced to", () => {
		const wire = transportThatRecords();

		expect(lankaStream({ transport: wire.transport }).name).toBe("lanka/stream");
		expect(lankaStream({ transport: wire.transport, name: "@lankajs/plugin-sse" }).name).toBe(
			"@lankajs/plugin-sse",
		);
	});

	it("hands the same marker to every bridge of one installation", () => {
		// Two markers would let one bridge's handler look like a user action to
		// another's, which is the failure the marker exists to prevent.
		const wire = transportThatRecords();
		const lanka = createLanka({ host: lankaTestHost });
		const seen = vi.fn();
		const plugin = lankaStream({
			transport: wire.transport,
			bridges: ({ stream, trigger }) => [
				new (class extends ALankaStreamBridge {
					public register(): void {
						this.on("gap.updated", () => seen(trigger.isActive()));
					}
				})(stream, trigger),
			],
		});

		lanka.use(plugin);
		wire.deliver("gap.updated", {});

		expect(seen).toHaveBeenCalledWith(true);
		expect(plugin.trigger.isActive()).toBe(false);
		lanka.dispose();
	});
});
