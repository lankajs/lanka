import { describe, expect, it, vi } from "vitest";
import { createLankaSseBridge } from "./createLankaSseBridge";
import type { ILankaServerEventTransport } from "../../_interfaces/ILankaServerEventTransport";
import type { ILankaSseTriggerContext } from "../create-lanka-sse-trigger-context/createLankaSseTriggerContext";

const transportThatRecords = () => {
	const events = new Map<string, (data: Record<string, unknown>) => void>();
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
		deliver: (eventType: string, data: Record<string, unknown>) =>
			events.get(eventType)?.(data),
		reopen: () => reconnect?.(),
		subscriptions: () => events.size,
	};
};

/** The marker the base sets around every handler. */
const trigger: ILankaSseTriggerContext = {
	run: (work) => work(),
	isActive: () => false,
};

describe("a bridge written by calling", () => {
	it("subscribes what the register function asked for", () => {
		const wire = transportThatRecords();
		const heard = vi.fn();
		const bridge = createLankaSseBridge(({ on }) => {
			on("message", heard);
		})(wire.transport, trigger);

		bridge.register();
		wire.deliver("message", { text: "hello" });

		expect(heard).toHaveBeenCalledWith({ text: "hello" });
	});

	it("carries an event with no payload", () => {
		const wire = transportThatRecords();
		const heard = vi.fn();
		const bridge = createLankaSseBridge(({ onSignal }) => {
			onSignal("ping", heard);
		})(wire.transport, trigger);

		bridge.register();
		wire.deliver("ping", {});

		expect(heard).toHaveBeenCalledTimes(1);
	});

	it("catches up after a reconnect", () => {
		const wire = transportThatRecords();
		const refetch = vi.fn();
		const bridge = createLankaSseBridge(({ onReconnect }) => {
			onReconnect(refetch);
		})(wire.transport, trigger);

		bridge.register();
		wire.reopen();

		// What the rung is for: everything that happened while the connection was
		// down was missed, so a screen refetches rather than assuming it is current.
		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it("lets go of everything it subscribed", () => {
		const wire = transportThatRecords();
		const bridge = createLankaSseBridge(({ on }) => {
			on("message", vi.fn());
		})(wire.transport, trigger);

		bridge.register();
		bridge.dispose();

		expect(wire.subscriptions()).toBe(0);
	});
});
