import { describe, expect, it, vi } from "vitest";
import { ALankaStreamBridge } from "./ALankaStreamBridge";
import { createLankaStreamTriggerContext } from "../../_factories/create-lanka-stream-trigger-context/createLankaStreamTriggerContext";
import type { ILankaServerEventTransport } from "../../_interfaces/ILankaServerEventTransport";

const transportThatRecords = () => {
	const events = new Map<string, (payload: Record<string, unknown>) => void>();
	let reconnect: (() => void) | null = null;

	const transport: ILankaServerEventTransport = {
		isSupported: () => true,
		connect: () => undefined,
		disconnect: () => undefined,
		on: (eventType, callback) => {
			events.set(eventType, callback);
			return () => events.delete(eventType);
		},
		onReconnect: (callback) => {
			reconnect = callback;
			return () => {
				reconnect = null;
			};
		},
	};

	return {
		transport,
		deliver: (eventType: string, payload: Record<string, unknown>) =>
			events.get(eventType)?.(payload),
		reopen: () => reconnect?.(),
		subscriptions: () => events.size,
	};
};

/** An application's bridge: the framework knows no event type. */
class TestBridge extends ALankaStreamBridge {
	public readonly seen: { id: unknown; fromServer: boolean }[] = [];
	public caughtUp = 0;

	public register(): void {
		this.on("gap.updated", (payload) => {
			this.seen.push({ id: payload.id, fromServer: this.trigger.isActive() });
		});
		this.onReconnect(() => {
			this.caughtUp += 1;
		});
	}
}

describe("ALankaStreamBridge", () => {
	it("a handler knows it was triggered by the server", () => {
		// Without the marker the screen notifies the user about their OWN action,
		// and an optimistic update is rolled back by a "foreign" response that in
		// fact confirms it.
		const wire = transportThatRecords();
		const bridge = new TestBridge(wire.transport, createLankaStreamTriggerContext());
		bridge.register();

		wire.deliver("gap.updated", { id: 7 });

		expect(bridge.seen).toEqual([{ id: 7, fromServer: true }]);
	});

	it("a catch-up handler carries the marker too", () => {
		// A refetch triggered by a reconnect is not the user asking for it, and
		// anything reading the marker must see the same answer either way.
		const wire = transportThatRecords();
		const trigger = createLankaStreamTriggerContext();
		let insideCatchUp = false;
		const bridge = new (class extends ALankaStreamBridge {
			public register(): void {
				this.onReconnect(() => {
					insideCatchUp = trigger.isActive();
				});
			}
		})(wire.transport, trigger);
		bridge.register();

		wire.reopen();

		expect(insideCatchUp).toBe(true);
	});

	it("leaves the marker off outside a handler", () => {
		const wire = transportThatRecords();
		const trigger = createLankaStreamTriggerContext();
		new TestBridge(wire.transport, trigger).register();

		expect(trigger.isActive()).toBe(false);
	});

	it("releases every subscription on dispose", () => {
		// A bridge that never unsubscribes cannot notice the problem while it lives
		// as long as the application — but a plugin is removed, an instance is
		// disposed, a dev server reloads the module.
		const wire = transportThatRecords();
		const bridge = new TestBridge(wire.transport, createLankaStreamTriggerContext());
		bridge.register();

		bridge.dispose();
		wire.deliver("gap.updated", { id: 7 });
		wire.reopen();

		expect(bridge.seen).toEqual([]);
		expect(bridge.caughtUp).toBe(0);
		expect(wire.subscriptions()).toBe(0);
	});

	it("disposing twice releases nothing a second time", () => {
		const unsubscribe = vi.fn();
		const wire = transportThatRecords();
		const bridge = new (class extends ALankaStreamBridge {
			public register(): void {
				this.on("x", vi.fn());
			}
		})({ ...wire.transport, on: () => unsubscribe }, createLankaStreamTriggerContext());
		bridge.register();

		bridge.dispose();
		bridge.dispose();

		expect(unsubscribe).toHaveBeenCalledTimes(1);
	});

	it("carries an event with no payload", () => {
		const wire = transportThatRecords();
		const heard = vi.fn();
		const bridge = new (class extends ALankaStreamBridge {
			public register(): void {
				this.onSignal("ping", heard);
			}
		})(wire.transport, createLankaStreamTriggerContext());
		bridge.register();

		wire.deliver("ping", {});

		expect(heard).toHaveBeenCalledWith();
	});
});
